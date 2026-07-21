<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * In-dashboard, localized API reference with an interactive tester.
 * (The external docs/ site intentionally does NOT document the user API.)
 */
class ApiDocsController extends Controller
{
    private const TEST_KEY_NAME = 'API Docs Test Key';

    public function index(Request $request): Response
    {
        abort_unless(
            (bool) $request->user()?->getCurrentPlan()?->apiEnabled(),
            403
        );

        return Inertia::render('ApiDocs/Index', [
            // Derived from the live request (scheme + host), not APP_URL: the
            // docs always show the domain the user is actually browsing, even
            // when APP_URL is misconfigured — and the tester stays same-origin.
            'apiBaseUrl' => $request->getSchemeAndHttpHost().'/api/v1',
        ]);
    }

    /**
     * Mint a short-lived key for the docs tester. Self-replacing (at most one
     * per user, by fixed name) and 1-hour expiry, so it is exempt from the
     * 10-key cap and never accumulates.
     */
    public function testKey(Request $request): JsonResponse
    {
        abort_unless(
            (bool) $request->user()?->getCurrentPlan()?->apiEnabled(),
            403
        );

        $user = $request->user();

        $newToken = DB::transaction(function () use ($user) {
            $user->tokens()->where('name', self::TEST_KEY_NAME)->lockForUpdate()->delete();

            $token = $user->createToken(self::TEST_KEY_NAME, ['read'], now()->addHour());
            $token->accessToken->forceFill([
                'last_four' => substr($token->plainTextToken, -4),
            ])->save();

            return $token;
        });

        return response()->json([
            'token' => $newToken->plainTextToken,
            'expires_at' => $newToken->accessToken->expires_at?->toIso8601String(),
        ], 201);
    }
}
