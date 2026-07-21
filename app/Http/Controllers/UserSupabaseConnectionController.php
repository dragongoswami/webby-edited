<?php

namespace App\Http\Controllers;

use App\Models\SupabaseConnection;
use App\Services\SupabaseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Per-user library of BYOD Supabase connections. Secrets (secret_key,
 * db_connection) are encrypted at rest and never returned to the browser —
 * only "has_*" booleans are exposed.
 */
class UserSupabaseConnectionController extends Controller
{
    // index() and destroy() intentionally omit the databaseEnabled() plan gate
    // (which store/update/test enforce): a user whose plan was downgraded must
    // still be able to view and clean up their previously-stored connections.
    // present() never exposes secrets, so listing is safe regardless of plan.
    public function index(Request $request): JsonResponse
    {
        return response()->json(
            $request->user()->supabaseConnections()->latest()->get()
                ->map(fn (SupabaseConnection $c) => $this->present($c))
                ->values()
        );
    }

    /** Per-user cap on stored connections. */
    private const MAX_CONNECTIONS = 20;

    public function store(Request $request): JsonResponse
    {
        $this->authorizeDatabase($request);
        abort_if(
            $request->user()->supabaseConnections()->count() >= self::MAX_CONNECTIONS,
            422,
            'You have reached the maximum number of database connections.'
        );
        $data = $this->validateConn($request, true);
        $conn = $request->user()->supabaseConnections()->create($data);

        return response()->json($this->present($conn), 201);
    }

    public function update(Request $request, SupabaseConnection $connection): JsonResponse
    {
        abort_unless($connection->user_id === $request->user()->id, 403);
        $this->authorizeDatabase($request);
        $data = $this->validateConn($request, false);

        // Empty secret fields mean "keep the stored value".
        foreach (['secret_key', 'db_connection'] as $secret) {
            if (empty($data[$secret])) {
                unset($data[$secret]);
            }
        }

        $connection->update($data);

        return response()->json($this->present($connection->fresh()));
    }

    public function destroy(Request $request, SupabaseConnection $connection): JsonResponse
    {
        abort_unless($connection->user_id === $request->user()->id, 403);
        $connection->delete();

        return response()->json(['ok' => true]);
    }

    public function test(Request $request, SupabaseConnection $connection, SupabaseService $supabase): JsonResponse
    {
        abort_unless($connection->user_id === $request->user()->id, 403);
        $this->authorizeDatabase($request);

        $result = $supabase->testConnection(['db_connection' => (string) $connection->db_connection]);
        if ($result['ok'] ?? false) {
            $connection->update(['last_tested_at' => now()]);
        }

        return response()->json($result);
    }

    private function authorizeDatabase(Request $request): void
    {
        abort_unless((bool) $request->user()->getCurrentPlan()?->databaseEnabled(), 403);
    }

    /**
     * @return array<string,mixed>
     */
    private function validateConn(Request $request, bool $secretsRequired): array
    {
        $req = $secretsRequired ? 'required' : 'nullable';

        return $request->validate([
            'label' => 'required|string|max:100',
            'url' => 'required|url|starts_with:https://|max:255',
            'publishable_key' => 'nullable|string|max:1000',
            'secret_key' => $req.'|string|max:2000',
            'db_connection' => [$req, 'string', 'max:2000', 'regex:#^postgres(ql)?://#i'],
        ]);
    }

    /**
     * Masked, browser-safe representation (never exposes secrets).
     *
     * @return array<string,mixed>
     */
    private function present(SupabaseConnection $c): array
    {
        return [
            'id' => $c->id,
            'label' => $c->label,
            'url' => $c->url,
            'publishable_key' => $c->publishable_key,
            'has_secret_key' => filled($c->secret_key),
            'has_db_connection' => filled($c->db_connection),
            'last_tested_at' => $c->last_tested_at,
        ];
    }
}
