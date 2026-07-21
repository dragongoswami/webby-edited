<?php

namespace App\Services;

use App\Models\Plugin;
use App\Models\ShopifyConnection;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class ShopifyService
{
    /** Admin API version pinned for all GraphQL calls. */
    private const API_VERSION = '2025-04';

    /** Shopify custom-app config from the plugin row (decrypted array). */
    public function config(): array
    {
        return Plugin::where('slug', 'shopify')->first()?->config ?? [];
    }

    /**
     * Whether the operator has enabled BYOS store connections (the OAuth
     * connect flow + auto-push). When off, the plugin runs download-only:
     * the connect page, per-project store picker and OAuth routes are gated,
     * and no Shopify app is required. Requires the toggle AND valid OAuth
     * credentials (the toggle can't function without them).
     */
    public function storeConnectionsEnabled(): bool
    {
        $cfg = $this->config();

        return ! empty($cfg['enable_store_connections'])
            && ! empty($cfg['shopify_api_key'])
            && ! empty($cfg['shopify_api_secret'])
            && ! empty($cfg['webhook_secret']);
    }

    /** OAuth scopes requested for theme push. */
    public function scopes(): string
    {
        return 'write_themes,read_themes';
    }

    /**
     * Validate a *.myshopify.com domain and resolve it to a public IP (SSRF
     * guard). Returns the safe host. Throws on a non-Shopify, unresolvable, or
     * non-public host.
     *
     * Mirrors SupabaseService::resolveSafeHost(): collects every A/AAAA record,
     * falls back to gethostbyname() when dns_get_record() is restricted, rejects
     * the host when the resolved IP set is empty (DNS returned zero records), and
     * rejects when ANY record resolves to a private/reserved address.
     */
    public function resolveSafeHost(string $shopDomain): string
    {
        $host = strtolower(trim($shopDomain));
        if (! preg_match('/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/', $host)) {
            throw new RuntimeException('Invalid Shopify store domain.');
        }

        // Collect all A/AAAA records so every address is validated (guards against
        // split-horizon / partial-rebind DNS where one record is private).
        $ips = [];
        foreach (@dns_get_record($host, DNS_A | DNS_AAAA) ?: [] as $r) {
            $ip = $r['ip'] ?? ($r['ipv6'] ?? null);
            if ($ip !== null) {
                $ips[] = $ip;
            }
        }

        // Fallback for environments where dns_get_record() is restricted.
        if ($ips === []) {
            $resolved = gethostbyname($host);
            if ($resolved !== $host) {
                $ips[] = $resolved;
            }
        }

        // Zero records after both paths means the domain is unresolvable — reject
        // rather than letting the caller use an unvalidated hostname.
        if ($ips === []) {
            throw new RuntimeException('Shopify store domain did not resolve.');
        }

        foreach ($ips as $ip) {
            // filter_var's reserved-range flag misses RFC 6598 carrier-grade NAT
            // (100.64.0.0/10), so reject that range explicitly too.
            if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)
                || $this->isCgnat($ip)) {
                throw new RuntimeException('Shopify store domain resolves to a non-public address.');
            }
        }

        return $host;
    }

    /**
     * Reports whether an IPv4 literal is in the RFC 6598 shared address space
     * (100.64.0.0/10 — carrier-grade NAT), which PHP's filter_var reserved-range
     * flag does not exclude. Mirror of SupabaseService::isCgnat().
     */
    private function isCgnat(string $ip): bool
    {
        $parts = explode('.', $ip);
        if (count($parts) !== 4) {
            return false;
        }

        return (int) $parts[0] === 100 && (int) $parts[1] >= 64 && (int) $parts[1] <= 127;
    }

    /** Build the install/authorize redirect URL for a shop. */
    public function authorizeUrl(string $shop, string $state, string $redirectUri): string
    {
        $host = $this->resolveSafeHost($shop);
        $clientId = $this->config()['shopify_api_key'] ?? '';

        return "https://{$host}/admin/oauth/authorize?".http_build_query([
            'client_id' => $clientId,
            'scope' => $this->scopes(),
            'redirect_uri' => $redirectUri,
            'state' => $state,
        ]);
    }

    /** Exchange the OAuth code for an offline access token. */
    public function exchangeUserCode(string $shop, string $code): array
    {
        $host = $this->resolveSafeHost($shop);
        $cfg = $this->config();
        $res = Http::asJson()->post("https://{$host}/admin/oauth/access_token", [
            'client_id' => $cfg['shopify_api_key'] ?? '',
            'client_secret' => $cfg['shopify_api_secret'] ?? '',
            'code' => $code,
        ]);
        if (! $res->successful() || ! $res->json('access_token')) {
            throw new RuntimeException('Shopify token exchange failed.');
        }

        return [
            'access_token' => $res->json('access_token'),
            'scope' => $res->json('scope', $this->scopes()),
        ];
    }

    /** Base URL for the REST Admin API against the connection's (SSRF-checked) store. */
    private function restBase(ShopifyConnection $conn): string
    {
        $host = $this->resolveSafeHost($conn->shop_domain);

        return "https://{$host}/admin/api/".self::API_VERSION;
    }

    /** Verify a Shopify webhook HMAC (base64 of raw body, fails closed). */
    public function verifyWebhook(string $rawBody, ?string $hmacHeader): bool
    {
        $secret = $this->config()['webhook_secret'] ?? null;
        if (! $secret || ! $hmacHeader) {
            return false;
        }
        $expected = base64_encode(hash_hmac('sha256', $rawBody, (string) $secret, true));

        return hash_equals($expected, $hmacHeader);
    }

    /**
     * Create an UNPUBLISHED theme from a source zip URL; returns its GID.
     *
     * Uses the REST Admin theme API (POST /themes.json with `src`), NOT the
     * GraphQL `themeCreate` mutation: GraphQL gates theme creation behind a
     * Shopify-granted "modify themes" exemption that the `write_themes` scope
     * alone does not satisfy (returns ACCESS_DENIED). REST needs only the scope.
     * Throws RuntimeException on a non-2xx response or a missing theme id.
     */
    public function themeCreate(ShopifyConnection $conn, string $name, string $sourceUrl): string
    {
        $res = Http::withHeaders(['X-Shopify-Access-Token' => $conn->access_token])
            ->asJson()
            ->post($this->restBase($conn).'/themes.json', [
                'theme' => ['name' => $name, 'src' => $sourceUrl, 'role' => 'unpublished'],
            ]);

        $id = data_get($res->json(), 'theme.id');
        if (! $res->successful() || ! $id) {
            throw new RuntimeException('themeCreate failed: '.($res->body() ?: (string) $res->status()));
        }

        // Prefer Shopify's own GID; derive it from the numeric id if the payload omits it.
        return data_get($res->json(), 'theme.admin_graphql_api_id') ?: "gid://shopify/Theme/{$id}";
    }

    /** Delete a theme by GID (best-effort; ignores errors). */
    public function themeDelete(ShopifyConnection $conn, string $themeGid): void
    {
        $id = $this->numericThemeId($themeGid);
        Http::withHeaders(['X-Shopify-Access-Token' => $conn->access_token])
            ->delete($this->restBase($conn)."/themes/{$id}.json");
    }

    /** Extract the trailing numeric id from a theme GID. */
    public function numericThemeId(string $gid): string
    {
        return (string) preg_replace('#.*/#', '', $gid);
    }

    /** Shopify unpublished-theme preview URL. */
    public function previewUrl(string $shopDomain, string $gid): string
    {
        return "https://{$shopDomain}/?preview_theme_id=".$this->numericThemeId($gid);
    }
}
