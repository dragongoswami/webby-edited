<?php

namespace App\Listeners;

use App\Events\Builder\BuilderCompleteEvent;
use App\Models\BuildCreditUsage;
use App\Models\Project;
use App\Services\BuildCreditService;
use Illuminate\Support\Facades\Log;

class TrackBuildCreditUsage
{
    public function __construct(
        protected BuildCreditService $creditService
    ) {}

    public function handle(BuilderCompleteEvent $event): void
    {
        // Charge the PER-RUN tokens for this build/turn, not the cumulative
        // session total. The builder reports run_tokens_used per complete event;
        // deducting the cumulative tokensUsed would re-charge the whole session
        // on every chat turn. Fall back to cumulative for older builders that
        // don't send the run_* fields.
        $chargeTokens = $event->runTokensUsed ?? $event->tokensUsed;

        // Skip if no tokens were charged for this run
        if ($chargeTokens <= 0) {
            return;
        }

        // Find the project by session ID
        $project = Project::where('build_session_id', $event->sessionId)
            ->with('user')
            ->first();

        if (! $project || ! $project->user) {
            return;
        }

        $user = $project->user;

        // Get the AI provider from user's plan
        $provider = null;
        $plan = $user->getCurrentPlan();

        if ($plan) {
            $provider = $plan->getAiProviderWithFallbacks();
        }

        // Resolve the prompt/completion split for this run. Prefer the builder's
        // run-level breakdown; fall back to the cumulative breakdown, then to a
        // 60/40 estimate.
        if ($event->runTokensUsed !== null) {
            $promptTokens = $event->runPromptTokens ?? (int) ($chargeTokens * 0.6);
            $completionTokens = $event->runCompletionTokens ?? ($chargeTokens - $promptTokens);
        } elseif ($event->promptTokens !== null && $event->completionTokens !== null) {
            $promptTokens = $event->promptTokens;
            $completionTokens = $event->completionTokens;
        } else {
            $promptTokens = (int) ($chargeTokens * 0.6);
            $completionTokens = $chargeTokens - $promptTokens;
        }

        // Use model from event if available, otherwise get from provider
        $model = $event->model ?? $provider?->getDefaultModel() ?? 'unknown';

        $usedOwnApiKey = $user->isUsingOwnAiApiKey();

        // IDEMPOTENCY: If we have an event ID, use firstOrCreate to prevent duplicates
        if ($event->eventId) {
            $usage = BuildCreditUsage::firstOrCreate(
                ['builder_event_id' => $event->eventId],
                [
                    'user_id' => $user->id,
                    'project_id' => $project->id,
                    'ai_provider_id' => $provider?->id,
                    'model' => $model,
                    'prompt_tokens' => $promptTokens,
                    'completion_tokens' => $completionTokens,
                    'total_tokens' => $chargeTokens,
                    'action' => 'build',
                    'used_own_api_key' => $usedOwnApiKey,
                ]
            );

            // Only deduct credits if this was a NEW record (not duplicate)
            if ($usage->wasRecentlyCreated) {
                if (! $usedOwnApiKey) {
                    $user->deductBuildCredits($chargeTokens);
                }

                // Broadcast updated credits to frontend and check for low credits
                $this->creditService->broadcastCreditsUpdated($user);
                $this->creditService->checkAndNotifyLowCredits($user);

                Log::info('Build credit usage tracked', [
                    'event_id' => $event->eventId,
                    'user_id' => $user->id,
                    'tokens' => $chargeTokens,
                ]);
            } else {
                Log::info('Duplicate webhook ignored (idempotent)', [
                    'event_id' => $event->eventId,
                    'session_id' => $event->sessionId,
                ]);
            }
        } else {
            // Backwards compatibility: no event ID, use original logic
            $this->creditService->trackUsage(
                user: $user,
                promptTokens: $promptTokens,
                completionTokens: $completionTokens,
                model: $model,
                provider: $provider,
                project: $project,
                action: 'build',
                usedOwnApiKey: $usedOwnApiKey
            );
        }
    }
}
