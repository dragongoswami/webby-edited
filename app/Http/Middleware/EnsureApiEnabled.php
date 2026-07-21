<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Request-time plan gate for the user API: a plan downgrade suspends access
 * without deleting the user's keys; an upgrade restores it.
 */
class EnsureApiEnabled
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user()?->getCurrentPlan()?->apiEnabled()) {
            return response()->json([
                'message' => 'API access is not enabled for your plan.',
            ], 403);
        }

        return $next($request);
    }
}
