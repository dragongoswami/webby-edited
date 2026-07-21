<?php

namespace App\Services;

use App\Models\GithubConnection;
use App\Models\Plugin;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class GithubService
{
    private const API = 'https://api.github.com';

    /** Admin GitHub App config from the plugin row (decrypted array). */
    private function config(): array
    {
        $plugin = Plugin::where('slug', 'github')->first();

        return $plugin?->config ?? [];
    }

    private function b64url(string $bytes): string
    {
        return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
    }

    /** Build + sign a short-lived (<=10 min) App JWT (RS256). */
    public function appJwt(): string
    {
        $config = $this->config();
        if (empty($config['app_id']) || empty($config['private_key'])) {
            throw new RuntimeException('GitHub App is not configured.');
        }

        $now = time();
        $header = $this->b64url(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
        $payload = $this->b64url(json_encode([
            'iat' => $now - 60,
            'exp' => $now + 540,
            'iss' => (string) $config['app_id'],
        ]));
        $signingInput = "{$header}.{$payload}";

        $signature = '';
        $ok = openssl_sign($signingInput, $signature, $config['private_key'], OPENSSL_ALGO_SHA256);
        if (! $ok) {
            throw new RuntimeException('Failed to sign GitHub App JWT.');
        }

        return "{$signingInput}.{$this->b64url($signature)}";
    }

    /** Mint a per-repo, 1-hour installation access token. */
    public function mintInstallationToken(int $installationId, string $repo): array
    {
        $response = Http::withToken($this->appJwt())
            ->withHeaders(['Accept' => 'application/vnd.github+json', 'X-GitHub-Api-Version' => '2022-11-28'])
            ->post(self::API."/app/installations/{$installationId}/access_tokens", [
                'repositories' => [$repo],
                'permissions' => ['contents' => 'write', 'metadata' => 'read'],
            ]);

        if (! $response->successful()) {
            throw new RuntimeException('Failed to mint installation token: '.mb_substr($response->body(), 0, 200));
        }

        return ['token' => $response->json('token'), 'expires_at' => $response->json('expires_at')];
    }

    /** Exchange an OAuth code (from install-with-authorization) for a user access token. */
    public function exchangeUserCode(string $code): array
    {
        $config = $this->config();
        $response = Http::withHeaders(['Accept' => 'application/json'])
            ->asForm()
            ->post('https://github.com/login/oauth/access_token', [
                'client_id' => $config['client_id'] ?? '',
                'client_secret' => $config['client_secret'] ?? '',
                'code' => $code,
            ]);

        if (! $response->successful() || $response->json('error')) {
            throw new RuntimeException('GitHub OAuth code exchange failed.');
        }
        $expiresIn = (int) ($response->json('expires_in') ?? 0);

        return [
            'access_token' => $response->json('access_token'),
            'refresh_token' => $response->json('refresh_token'),
            'scope' => $response->json('scope') ?? '',
            'expires_at' => $expiresIn > 0 ? now()->addSeconds($expiresIn) : null,
        ];
    }

    /** Resolve the account (login + type) an installation belongs to. */
    public function fetchInstallationAccount(int $installationId): array
    {
        $response = Http::withToken($this->appJwt())
            ->withHeaders(['Accept' => 'application/vnd.github+json', 'X-GitHub-Api-Version' => '2022-11-28'])
            ->get(self::API."/app/installations/{$installationId}");

        if (! $response->successful()) {
            throw new RuntimeException('Failed to fetch installation account.');
        }

        return [
            'login' => $response->json('account.login'),
            'account_type' => $response->json('account.type'),
        ];
    }

    /** Create a fresh repo under the connection's account (personal or org). */
    public function createRepo(GithubConnection $conn, string $name, bool $private): array
    {
        $endpoint = $conn->account_type === 'Organization'
            ? self::API."/orgs/{$conn->github_login}/repos"
            : self::API.'/user/repos';

        $response = Http::withHeaders([
            'Authorization' => "token {$conn->user_access_token}",
            'Accept' => 'application/vnd.github+json',
            'X-GitHub-Api-Version' => '2022-11-28',
        ])->post($endpoint, ['name' => $name, 'private' => $private, 'auto_init' => false]);

        if (! $response->successful()) {
            throw new RuntimeException('Failed to create repository: '.mb_substr($response->body(), 0, 200));
        }

        return [
            'owner' => $response->json('owner.login'),
            'name' => $response->json('name'),
            'id' => (int) $response->json('id'),
        ];
    }

    /** True when the repo has no commits (safe to attach). */
    public function repoIsEmpty(GithubConnection $conn, string $owner, string $name): bool
    {
        $response = Http::withHeaders([
            'Authorization' => "token {$conn->user_access_token}",
            'Accept' => 'application/vnd.github+json',
        ])->get(self::API."/repos/{$owner}/{$name}/commits", ['per_page' => 1]);

        // GitHub returns 409 Conflict ("Git Repository is empty") for a repo with no commits.
        if ($response->status() === 409) {
            return true;
        }

        return $response->successful() && count($response->json()) === 0;
    }
}
