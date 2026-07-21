<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SubscriptionController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $subscription = $user->activeSubscription;
        $plan = $user->getCurrentPlan();

        return response()->json(['data' => [
            'plan' => $plan ? [
                'name' => $plan->name,
                'slug' => $plan->slug,
                'price' => $plan->price,
                'billing_period' => $plan->billing_period,
            ] : null,
            'subscription' => $subscription ? [
                'status' => $subscription->status,
                'starts_at' => $subscription->starts_at?->toIso8601String(),
                'renewal_at' => $subscription->renewal_at?->toIso8601String(),
                'ends_at' => $subscription->ends_at?->toIso8601String(),
                'cancelled_at' => $subscription->cancelled_at?->toIso8601String(),
            ] : null,
        ]]);
    }
}
