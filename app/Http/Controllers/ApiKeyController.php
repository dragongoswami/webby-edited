<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * Personal API key provisioning (the /api-keys dashboard page).
 *
 * Keys are Sanctum personal access tokens: hashed at rest, plaintext shown
 * exactly once at creation. Every key carries the single 'read' ability.
 */
class ApiKeyController extends Controller
{
    public function index(Request $request): Response
    {
        $this->ensureApiEnabled($request);

        return Inertia::render('ApiKeys/Index');
    }

    public function list(Request $request): JsonResponse
    {
        $this->ensureApiEnabled($request);

        return response()->json([
            'keys' => $request->user()->tokens()
                ->orderByDesc('created_at')
                ->get()
                ->map(fn (PersonalAccessToken $token) => $this->present($token))
                ->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureApiEnabled($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100', Rule::notIn(['API Docs Test Key'])],
            'expires_in' => ['nullable', 'integer', 'in:30,90,365'],
        ], [
            'name.required' => __('Please enter a name for the key.'),
            'name.max' => __('The key name may not be longer than 100 characters.'),
            'name.not_in' => __('That name is reserved. Please choose another.'),
            'expires_in.in' => __('Choose a valid expiration option.'),
        ]);

        $user = $request->user();

        if ($user->tokens()->count() >= (int) config('api.max_keys_per_user', 10)) {
            return response()->json([
                'message' => __('You have reached the maximum number of API keys.'),
            ], 422);
        }

        $expiresAt = isset($validated['expires_in'])
            ? now()->addDays((int) $validated['expires_in'])
            : null;

        $newToken = $user->createToken($validated['name'], ['read'], $expiresAt);

        // Capture the display suffix now — the plaintext is never recoverable.
        $accessToken = $newToken->accessToken;
        $accessToken->forceFill([
            'last_four' => substr($newToken->plainTextToken, -4),
        ])->save();

        return response()->json([
            'token' => $newToken->plainTextToken,
            'key' => $this->present($accessToken->fresh()),
        ], 201);
    }

    public function destroy(Request $request, int $tokenId): JsonResponse
    {
        $this->ensureApiEnabled($request);

        $deleted = $request->user()->tokens()->where('id', $tokenId)->delete();

        abort_unless($deleted > 0, 404);

        return response()->json(['ok' => true]);
    }

    private function ensureApiEnabled(Request $request): void
    {
        abort_unless(
            (bool) $request->user()?->getCurrentPlan()?->apiEnabled(),
            403
        );
    }

    private function present(PersonalAccessToken $token): array
    {
        return [
            'id' => $token->id,
            'name' => $token->name,
            'masked' => config('sanctum.token_prefix', '').'••••'.($token->last_four ?? ''),
            'created_at' => $token->created_at?->toIso8601String(),
            'expires_at' => $token->expires_at?->toIso8601String(),
            'last_used_at' => $token->last_used_at?->toIso8601String(),
        ];
    }
}
