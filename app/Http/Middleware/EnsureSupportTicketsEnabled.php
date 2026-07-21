<?php

namespace App\Http\Middleware;

use App\Models\SystemSetting;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureSupportTicketsEnabled
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! SystemSetting::get('support.enabled', true)) {
            abort(404);
        }

        $user = $request->user();
        if (! $user) {
            return redirect()->route('login');
        }

        if (! ($user->plan?->enable_support_tickets)) {
            abort(403, __('Support tickets are not enabled on your plan.'));
        }

        return $next($request);
    }
}
