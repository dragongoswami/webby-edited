<?php

namespace App\Observers;

use App\Models\Plan;
use App\Models\User;
use App\Models\UserAiSettings;
use App\Services\CopyrightMarkService;
use Illuminate\Support\Facades\Log;

class UserObserver
{
    /**
     * Handle the User "created" event.
     *
     * Create default AI settings and provision build credits when a user
     * is created with a plan.
     */
    public function created(User $user): void
    {
        // Create default AI settings with sound enabled
        UserAiSettings::create([
            'user_id' => $user->id,
            'sounds_enabled' => true,
            'sound_style' => 'playful',
            'sound_volume' => 100,
        ]);

        // Provision build credits if user was created with a plan
        // but build_credits was not explicitly provided during creation
        if ($user->plan_id && ! array_key_exists('build_credits', $user->getAttributes())) {
            $this->provisionBuildCredits($user);
        }
    }

    /**
     * Handle the User "updated" event.
     *
     * When a user's plan changes, automatically refill their build credits.
     */
    public function updated(User $user): void
    {
        // Only trigger on plan_id change, not on build_credits change (to avoid infinite loop)
        if ($user->wasChanged('plan_id') && ! $user->wasChanged('build_credits') && $user->plan_id !== null) {
            $oldPlanId = $user->getOriginal('plan_id');
            $newPlanId = $user->plan_id;

            Log::info('User plan changed, refilling build credits', [
                'user_id' => $user->id,
                'old_plan_id' => $oldPlanId,
                'new_plan_id' => $newPlanId,
            ]);

            $newPlan = Plan::find($user->plan_id);
            $alreadyGrantedOneTime = $newPlan
                && $newPlan->one_time_credits
                && $user->subscriptions()->where('plan_id', $newPlan->id)->exists();

            if (! $alreadyGrantedOneTime) {
                $user->refillBuildCredits();
            }
        }

        // On plan change, if the new plan no longer allows private visibility,
        // make the user's previously-private published projects public again so
        // their access matches what their plan provides.
        if ($user->wasChanged('plan_id')) {
            // Drop the published-site serve cache so the copyright badge
            // immediately reflects the new plan's White Label state.
            app(CopyrightMarkService::class)->forgetPublishedCacheFor($user);

            // Re-query the new plan: the cached $user->plan relationship still
            // points at the previous plan after the plan_id update.
            $plan = $user->plan_id ? Plan::find($user->plan_id) : null;
            if (! $plan || ! $plan->allowsPrivateVisibility()) {
                $reset = $user->projects()
                    ->where('published_visibility', 'private')
                    ->update(['published_visibility' => 'public']);

                if ($reset > 0) {
                    Log::info('Reset private project visibility after plan change', [
                        'user_id' => $user->id,
                        'plan_id' => $user->plan_id,
                        'projects_reset' => $reset,
                    ]);
                }
            }
        }
    }

    /**
     * Provision build credits for a newly created user based on their plan.
     *
     * Uses updateQuietly() to avoid triggering the updated() observer,
     * following the same pattern as SubscriptionObserver::refillUserCredits().
     */
    protected function provisionBuildCredits(User $user): void
    {
        $plan = $user->plan;

        if (! $plan) {
            Log::warning('User created with plan_id but plan not found', [
                'user_id' => $user->id,
                'plan_id' => $user->plan_id,
            ]);

            return;
        }

        if ($plan->hasUnlimitedBuildCredits()) {
            return;
        }

        Log::info('Provisioning build credits for new user', [
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'credits' => $plan->getMonthlyBuildCredits(),
        ]);

        $user->updateQuietly([
            'build_credits' => $plan->getMonthlyBuildCredits(),
            'credits_reset_at' => now(),
        ]);
    }
}
