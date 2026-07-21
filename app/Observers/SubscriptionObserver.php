<?php

namespace App\Observers;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Services\CopyrightMarkService;
use Illuminate\Support\Facades\Log;

class SubscriptionObserver
{
    /**
     * Handle the Subscription "created" event.
     *
     * Refill build credits when a subscription is created as active
     * (e.g., admin manual creation, payment gateway, referral credits).
     */
    public function created(Subscription $subscription): void
    {
        if ($subscription->status === Subscription::STATUS_ACTIVE) {
            $this->refillUserCredits($subscription);
            $this->forgetPublishedCache($subscription);
        }
    }

    /**
     * Handle the Subscription "updated" event.
     *
     * Refill build credits when a subscription transitions to active
     * (e.g., admin approval of pending subscription).
     */
    public function updated(Subscription $subscription): void
    {
        if ($subscription->wasChanged('status') && $subscription->status === Subscription::STATUS_ACTIVE) {
            $this->refillUserCredits($subscription);
        }

        // Any status transition (activation, expiry, cancellation) can change
        // the user's effective plan — and with it the White Label state — even
        // when user.plan_id never changes (getCurrentPlan() prefers the active
        // subscription). Drop the published-site serve cache so the copyright
        // badge follows the effective plan. refillUserCredits() updates the
        // user quietly, so UserObserver can't cover this.
        if ($subscription->wasChanged('status')) {
            $this->forgetPublishedCache($subscription);
        }
    }

    /** Drop the published-site serve cache for the subscription's user. */
    protected function forgetPublishedCache(Subscription $subscription): void
    {
        if ($subscription->user) {
            app(CopyrightMarkService::class)->forgetPublishedCacheFor($subscription->user);
        }
    }

    /**
     * Refill the subscription user's build credits based on the plan allocation.
     *
     * Uses the subscription's plan directly to avoid querying the user's
     * activeSubscription relationship during model events. Updates plan_id
     * alongside build_credits so that subsequent plan_id updates (e.g., in
     * Subscription::approve()) find no dirty attributes and don't re-trigger
     * the UserObserver's refill logic.
     */
    protected function refillUserCredits(Subscription $subscription): void
    {
        $user = $subscription->user;

        if (! $user) {
            return;
        }

        $plan = $subscription->plan;

        if (! $plan) {
            return;
        }

        Log::info('Subscription activated, refilling build credits', [
            'user_id' => $user->id,
            'subscription_id' => $subscription->id,
            'plan_id' => $plan->id,
            'unlimited' => $plan->hasUnlimitedBuildCredits(),
        ]);

        $updates = ['plan_id' => $plan->id];

        if (! $plan->hasUnlimitedBuildCredits()
            && ! $this->wouldRegrantFreePlanCredits($user, $plan)
            && ! $this->wouldRegrantOneTimeCredits($user, $plan, $subscription)) {
            $updates['build_credits'] = $plan->getMonthlyBuildCredits();
            $updates['credits_reset_at'] = now();
        }

        $user->updateQuietly($updates);
    }

    /**
     * Anti-abuse guard: detect a free-plan credit re-grant that would let a
     * user farm build credits by cancelling and re-subscribing to the same
     * zero-cost plan within a single billing cycle.
     *
     * Returns true (suppress the grant) only when ALL of the following hold:
     *  - the new plan is free (price 0) — paid plans always re-grant, since each
     *    re-subscription is a real payment;
     *  - the user was ALREADY on a free plan. During this observer the controller
     *    has not yet updated user.plan_id, so user.plan still reflects the prior
     *    plan: a genuine paid→free downgrade (or a first-ever subscription) still
     *    grants normally, while any free→free move (same plan, or cycling between
     *    two free plans) is treated as a re-grant;
     *  - the user already received a credit grant within the current cycle
     *    (credits_reset_at falls inside the plan's billing period). The monthly
     *    credits:reset cron still refreshes them on schedule.
     */
    protected function wouldRegrantFreePlanCredits(User $user, Plan $plan): bool
    {
        if ((float) $plan->price !== 0.0) {
            return false;
        }

        $previousPlan = $user->plan_id ? Plan::find($user->plan_id) : null;
        if (! $previousPlan || (float) $previousPlan->price !== 0.0) {
            return false;
        }

        if ($user->credits_reset_at === null) {
            return false;
        }

        $cycleStart = match ($plan->billing_period) {
            'yearly' => now()->subYear(),
            'lifetime' => now()->subYears(100),
            default => now()->subMonth(),
        };

        return $user->credits_reset_at->greaterThan($cycleStart);
    }

    /**
     * Anti-regrant guard for one_time_credits plans: their credits are a single
     * lifetime grant, so suppress the grant whenever the user already holds a
     * prior subscription to this same plan (any status) other than the one being
     * activated now. The first-ever activation has no prior row and still grants.
     */
    protected function wouldRegrantOneTimeCredits(User $user, Plan $plan, Subscription $current): bool
    {
        if (! $plan->one_time_credits) {
            return false;
        }

        return $user->subscriptions()
            ->where('plan_id', $plan->id)
            ->where('id', '!=', $current->id)
            ->exists();
    }
}
