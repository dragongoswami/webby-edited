<?php

namespace App\Http\Controllers;

use App\Models\ShopifyConnection;
use App\Services\ShopifyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Per-user library of Shopify store connections. Offline access tokens are
 * encrypted at rest and never returned to the browser — present() exposes only
 * non-secret fields.
 *
 * index() and destroy() intentionally omit the shopifyEnabled() plan gate
 * (which connect/callback enforce): a user whose plan was downgraded must
 * still be able to view and clean up their previously-stored connections.
 */
class UserShopifyConnectionController extends Controller
{
    private const MAX_CONNECTIONS = 20;

    public function __construct(private ShopifyService $shopify) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json(
            $request->user()->shopifyConnections()->latest()->get()
                ->map(fn (ShopifyConnection $c) => $this->present($c))
                ->values()
        );
    }

    /** Redirect to the store's OAuth authorize page. */
    public function connect(Request $request): RedirectResponse
    {
        abort_unless($request->user()->getCurrentPlan()?->shopifyConnectEnabled(), 403);
        $shop = (string) $request->query('shop', '');
        abort_if($shop === '', 422, __('A Shopify store domain is required.'));

        $state = Str::random(40);
        $request->session()->put('shopify_oauth_state', $state);
        $request->session()->put('shopify_oauth_shop', $shop);

        return redirect()->away($this->shopify->authorizeUrl($shop, $state, route('shopify.callback')));
    }

    /** Shopify redirects here after authorization with ?code & ?state & ?shop. */
    public function callback(Request $request): RedirectResponse
    {
        abort_unless($request->user()->getCurrentPlan()?->shopifyConnectEnabled(), 403);

        abort_unless(
            hash_equals((string) $request->session()->pull('shopify_oauth_state', ''), (string) $request->input('state')),
            403,
            __('Invalid state parameter.')
        );

        // Trust the session-stored shop (set in connect()), not the ?shop query param —
        // an attacker could forge ?shop to hijack the token exchange into a different store.
        $shop = (string) $request->session()->pull('shopify_oauth_shop', '');
        abort_if($shop === '', 422, __('OAuth session expired. Please start the connection again.'));

        $queryShop = (string) $request->input('shop', '');
        if ($queryShop !== '' && $queryShop !== $shop) {
            abort(403, __('Shop domain mismatch.'));
        }

        $data = $request->validate(['code' => 'required|string']);

        abort_if(
            $request->user()->shopifyConnections()->count() >= self::MAX_CONNECTIONS,
            422,
            __('You have reached the maximum number of Shopify connections.')
        );

        $tokens = $this->shopify->exchangeUserCode($shop, $data['code']);

        $request->user()->shopifyConnections()->updateOrCreate(
            ['shop_domain' => $shop],
            [
                'label' => $shop,
                'access_token' => $tokens['access_token'],
                'scope' => $tokens['scope'],
                'status' => 'active',
            ]
        );

        return redirect('/shopify')->with('success', __('Shopify store connected.'));
    }

    public function destroy(Request $request, ShopifyConnection $connection): JsonResponse
    {
        abort_unless($connection->user_id === $request->user()->id, 403);
        $connection->delete();

        return response()->json(['ok' => true]);
    }

    /**
     * Browser-safe representation (never exposes the token).
     *
     * @return array<string,mixed>
     */
    private function present(ShopifyConnection $c): array
    {
        return [
            'id' => $c->id,
            'label' => $c->label,
            'shop_domain' => $c->shop_domain,
            'status' => $c->status,
            'last_used_at' => $c->last_used_at,
            'created_at' => $c->created_at,
        ];
    }
}
