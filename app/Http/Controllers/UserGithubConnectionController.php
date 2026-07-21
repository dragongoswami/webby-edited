<?php

namespace App\Http\Controllers;

use App\Models\GithubConnection;
use App\Models\Plugin;
use App\Services\GithubService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Per-user library of GitHub App connections. The user access tokens are
 * encrypted at rest and never returned to the browser — present() exposes
 * only non-secret fields.
 */
class UserGithubConnectionController extends Controller
{
    private const MAX_CONNECTIONS = 20;

    public function __construct(private GithubService $github) {}

    // index() and destroy() intentionally omit the githubEnabled() plan gate
    // (which connect/callback enforce): a user whose plan was downgraded must
    // still be able to view and clean up their previously-stored connections.
    public function index(Request $request): JsonResponse
    {
        return response()->json(
            $request->user()->githubConnections()->latest()->get()
                ->map(fn (GithubConnection $c) => $this->present($c))
                ->values()
        );
    }

    /** Redirect to the GitHub App install + authorize page. */
    public function connect(Request $request): RedirectResponse
    {
        abort_unless($request->user()->getCurrentPlan()?->githubEnabled(), 403);
        $config = Plugin::where('slug', 'github')->first()?->config ?? [];
        $slug = $config['app_slug'] ?? null;
        abort_if(! $slug, 422, 'GitHub App slug is not configured.');

        $state = Str::random(40);
        $request->session()->put('github_oauth_state', $state);

        return redirect()->away("https://github.com/apps/{$slug}/installations/new?state={$state}");
    }

    /** GitHub redirects here after install with ?code & ?installation_id. */
    public function callback(Request $request): RedirectResponse
    {
        abort_unless($request->user()->getCurrentPlan()?->githubEnabled(), 403);

        abort_unless(
            hash_equals((string) $request->session()->pull('github_oauth_state', ''), (string) $request->input('state')),
            403,
            'Invalid state parameter.'
        );

        $data = $request->validate([
            'code' => 'required|string',
            'installation_id' => 'required|integer',
        ]);

        abort_if(
            $request->user()->githubConnections()->count() >= self::MAX_CONNECTIONS,
            422,
            'You have reached the maximum number of GitHub connections.'
        );

        $tokens = $this->github->exchangeUserCode($data['code']);
        $account = $this->github->fetchInstallationAccount((int) $data['installation_id']);

        $request->user()->githubConnections()->updateOrCreate(
            ['installation_id' => $data['installation_id']],
            [
                'label' => $account['login'],
                'github_login' => $account['login'],
                'account_type' => $account['account_type'] ?? 'User',
                'user_access_token' => $tokens['access_token'],
                'user_refresh_token' => $tokens['refresh_token'] ?? null,
                'user_token_expires_at' => $tokens['expires_at'] ?? null,
                'scopes' => $tokens['scope'] ?? '',
                'status' => 'active',
            ]
        );

        return redirect('/github')->with('success', 'GitHub connected.');
    }

    public function destroy(Request $request, GithubConnection $connection): JsonResponse
    {
        abort_unless($connection->user_id === $request->user()->id, 403);
        $connection->delete();

        return response()->json(['ok' => true]);
    }

    /**
     * Browser-safe representation (never exposes tokens).
     *
     * @return array<string,mixed>
     */
    private function present(GithubConnection $c): array
    {
        return [
            'id' => $c->id,
            'label' => $c->label,
            'github_login' => $c->github_login,
            'account_type' => $c->account_type,
            'status' => $c->status,
            'last_used_at' => $c->last_used_at,
            'created_at' => $c->created_at,
        ];
    }
}
