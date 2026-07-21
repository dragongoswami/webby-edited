<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\BuildCreditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CreditsController extends Controller
{
    public function __construct(protected BuildCreditService $creditService) {}

    public function __invoke(Request $request): JsonResponse
    {
        $stats = $this->creditService->getMonthlyStats($request->user());

        return response()->json(['data' => [
            'credits_remaining' => $stats['remaining_credits'],
            'purchased_credits' => $stats['purchased_credits'],
            'credits_used' => $stats['used_tokens'],
            'monthly_limit' => $stats['monthly_allocation'],
            'is_unlimited' => $stats['is_unlimited'],
            'usage_percentage' => min(100, $stats['usage_percentage']),
            'using_own_key' => $stats['using_own_key'],
            'resets_at' => $request->user()->credits_reset_at
                ? $request->user()->credits_reset_at->addMonth()->startOfMonth()->toIso8601String()
                : now()->addMonth()->startOfMonth()->toIso8601String(),
        ]]);
    }
}
