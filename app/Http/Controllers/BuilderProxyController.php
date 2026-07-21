<?php

namespace App\Http\Controllers;

use App\Models\Builder;
use App\Models\Project;
use App\Models\Template;
use App\Services\BuildCreditService;
use App\Services\BuilderService;
use App\Services\CodeExportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class BuilderProxyController extends Controller
{
    /**
     * Stale session fallback threshold (minutes).
     * Used when builder is unreachable to decide if a session is stale.
     */
    private const STALE_FALLBACK_MINUTES = 10;

    public function __construct(
        protected BuilderService $builderService
    ) {}

    /**
     * Check for an active build, verifying with the Go builder before blocking.
     *
     * Returns the blocking Project if the session is genuinely active,
     * or null if no active build exists (stale sessions are auto-resolved).
     */
    public static function resolveBlockingBuild(int $userId): ?Project
    {
        // Bulk auto-resolve any clearly-unverifiable stuck builds first.
        // Without this, a user with multiple stuck projects (no builder / no
        // session_id) would need N submits before the singular ->first() below
        // worked through all of them — each call would resolve one and 409.
        $bulkResolved = Project::where('user_id', $userId)
            ->where('build_status', 'building')
            ->where(function ($q) {
                $q->whereNull('build_session_id')
                    ->orWhereNull('builder_id');
            })
            ->update([
                'build_status' => 'failed',
                'build_completed_at' => now(),
            ]);
        if ($bulkResolved > 0) {
            Log::info('Auto-resolved stuck builds in bulk (no builder/session)', [
                'user_id' => $userId,
                'count' => $bulkResolved,
            ]);
        }

        $activeProject = Project::where('user_id', $userId)
            ->where('build_status', 'building')
            ->first();

        if (! $activeProject) {
            return null;
        }

        // Defense in depth — the bulk update above should already handle this,
        // but if a project's builder relation resolves to null (e.g., builder
        // deleted), still auto-fail it instead of attempting a verify HTTP call
        // on a non-existent builder.
        if (! $activeProject->builder || ! $activeProject->build_session_id) {
            Log::info('Auto-resolved stuck build (no builder/session)', [
                'project_id' => $activeProject->id,
            ]);

            $activeProject->update([
                'build_status' => 'failed',
                'build_completed_at' => now(),
            ]);

            return null;
        }

        // Verify with the Go builder whether the session actually exists
        try {
            $response = Http::timeout(5)
                ->withHeaders(['X-Server-Key' => $activeProject->builder->server_key])
                ->get("{$activeProject->builder->full_url}/api/status/{$activeProject->build_session_id}");

            if ($response->status() === 404) {
                // Session gone (builder restarted, session expired)
                Log::info('Auto-resolved stale build (builder 404)', [
                    'project_id' => $activeProject->id,
                    'session_id' => $activeProject->build_session_id,
                ]);

                $activeProject->update([
                    'build_status' => 'failed',
                    'build_completed_at' => now(),
                ]);

                return null;
            }

            if ($response->successful()) {
                $status = $response->json('status');

                // Terminal status — sync it and unblock
                if (in_array($status, ['completed', 'failed', 'cancelled'])) {
                    Log::info('Auto-synced terminal build status from builder', [
                        'project_id' => $activeProject->id,
                        'status' => $status,
                    ]);

                    $activeProject->update([
                        'build_status' => $status,
                        'build_completed_at' => now(),
                    ]);

                    return null;
                }

                // Non-terminal (e.g. "running") — genuinely active
                return $activeProject;
            }

            // Non-404, non-success (e.g. 500) — fall through to time-based fallback
        } catch (\Exception $e) {
            // Builder unreachable — fall through to time-based fallback
            Log::warning('Builder unreachable during active session check', [
                'project_id' => $activeProject->id,
                'error' => $e->getMessage(),
            ]);
        }

        // Fallback: if builder is unreachable, use time-based heuristic
        $isStale = $activeProject->build_started_at === null
            || $activeProject->build_started_at->lt(now()->subMinutes(self::STALE_FALLBACK_MINUTES));

        if ($isStale) {
            Log::info('Auto-resolved stale build (builder unreachable, time fallback)', [
                'project_id' => $activeProject->id,
                'build_started_at' => $activeProject->build_started_at?->toIso8601String(),
            ]);

            $activeProject->update([
                'build_status' => 'failed',
                'build_completed_at' => now(),
            ]);

            return null;
        }

        // Session is recent and builder is unreachable — assume still active
        return $activeProject;
    }

    /**
     * Get available builders for the current user.
     */
    public function getAvailableBuilders(Request $request): JsonResponse
    {
        $builders = Builder::active()->get();

        return response()->json([
            'builders' => $builders->map(fn ($b) => [
                'id' => $b->id,
                'name' => $b->name,
            ]),
        ]);
    }

    /**
     * Start a new build session.
     */
    public function startBuild(Request $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        // Block demo admin from starting builds
        if (config('app.demo') && Auth::id() === 1) {
            return response()->json([
                'error' => __('The demo admin account cannot start builds. Register your own account to test the AI website builder.'),
            ], 403);
        }

        if ($blocked = $this->wordpressBuildBlocked($project)) {
            return $blocked;
        }

        if ($blocked = $this->shopifyBuildBlocked($project)) {
            return $blocked;
        }

        $validated = $request->validate([
            'prompt' => 'required|string|max:10000',
            'builder_id' => 'nullable|exists:builders,id',
            'template_url' => 'nullable|url',
            'template_id' => 'nullable|string',
            'history' => 'array',
            'file_ids' => 'nullable|array',
            'file_ids.*' => 'integer',
            'attached_files' => 'nullable|array',
            'attached_files.*.id' => 'required|integer',
            'attached_files.*.filename' => 'required|string',
            'attached_files.*.mime_type' => 'required|string',
            'attached_files.*.size' => 'required|integer|max:52428800', // Max 50MB per file
            'attached_files.*.human_size' => 'required|string',
            'attached_files.*.is_image' => 'required|boolean',
            'attached_files.*.is_video' => 'nullable|boolean',
            'attached_files.*.url' => 'required|string',
            'attached_files.*.preview_url' => 'nullable|string',
        ]);

        $user = $request->user();

        // Block concurrent builds for the same user (verifies with Go builder)
        $blockingProject = self::resolveBlockingBuild($user->id);

        if ($blockingProject) {
            return response()->json([
                'error' => __('You have an active session on ":project". Wait for it to complete, or stop it.', [
                    'project' => str($blockingProject->name)->limit(50)->toString(),
                ]),
            ], 409);
        }

        // Validate all prerequisites BEFORE claiming the build slot
        $buildCreditService = app(BuildCreditService::class);
        $canBuild = $buildCreditService->canPerformBuild($user);

        if (! $canBuild['allowed']) {
            return response()->json([
                'error' => $canBuild['reason'],
            ], 403);
        }

        // Resolve attached files if file_ids provided
        $attachedFiles = [];
        $fileRefs = null;
        if (! empty($validated['file_ids'])) {
            $plan = $user->getCurrentPlan();
            if (! $plan || ! $plan->fileStorageEnabled()) {
                return response()->json([
                    'error' => __('File storage is not enabled for your plan.'),
                ], 403);
            }
            $files = $project->files()->whereIn('id', $validated['file_ids'])->get();
            $attachedFiles = $files->map(fn ($f) => [
                'filename' => $f->original_filename,
                'api_url' => $f->getApiUrl(),
                'mime_type' => $f->mime_type,
                'size' => $f->size,
                'human_size' => $f->getHumanReadableSize(),
            ])->toArray();
            $fileRefs = $files->map(fn ($f) => [
                'id' => $f->id,
                'filename' => $f->original_filename,
                'mime_type' => $f->mime_type,
            ])->toArray();
        }

        // Get AI config from user's plan
        try {
            $aiConfig = $this->builderService->getAiConfigForUser($user);
            // Pass remaining credits to builder for mid-session enforcement.
            // 0 = unlimited (BYOK or unlimited plan) — those users must never
            // be capped mid-build. getBuilderCreditLimit() handles that.
            $aiConfig['agent']['remaining_build_credits'] = $user->getBuilderCreditLimit();
        } catch (\Exception $e) {
            return response()->json([
                'error' => $e->getMessage(),
            ], 400);
        }

        // Check if images are attached but model doesn't support vision
        $hasImages = ! empty($validated['attached_files']) && collect($validated['attached_files'])->contains('is_image', true);
        if ($hasImages) {
            $providerType = $aiConfig['provider'] ?? '';
            $model = $aiConfig['model'] ?? '';
            if (! $this->modelSupportsVision($providerType, $model)) {
                return response()->json([
                    'error' => __('Your current AI model (:model) does not support image inputs. Please select a vision-capable model (e.g., GPT-4o, Claude-3, Gemini-1.5) in your AI settings to use image attachments.', [
                        'model' => $model,
                    ]),
                ], 400);
            }
        }

        // Select builder based on plan or auto-select
        $builder = null;

        // First try to get builder from user's plan
        if ($user->plan) {
            $builder = $user->plan->getBuilderWithFallbacks();
        }

        // If no builder from plan, allow manual selection or auto-select
        if (! $builder && ! empty($validated['builder_id'])) {
            $builder = Builder::findOrFail($validated['builder_id']);

            // Check builder is active
            if ($builder->status !== 'active') {
                return response()->json([
                    'error' => __('Selected builder is not active'),
                ], 400);
            }
        }

        if (! $builder) {
            return response()->json([
                'error' => __('No builders are currently available. Please try again later.'),
            ], 503);
        }

        // Validate and select template
        $templateId = $validated['template_id'] ?? null;

        // For first build: use the template selected during project creation
        // (only when no explicit template_id in request and project has no history yet)
        if (! $templateId && $project->template_id && empty($project->conversation_history)) {
            $templateId = (string) $project->template_id;
        }

        // Validate explicit template_id against user's plan
        if ($templateId) {
            $template = Template::find($templateId);
            if ($template && ! $template->isAvailableForPlan($user->getCurrentPlan())) {
                return response()->json([
                    'error' => __('The selected template is not available for your plan.'),
                ], 403);
            }
        }

        // Atomic re-check with row lock to prevent race between concurrent requests
        // All validations above pass before we claim the slot
        $raceConflict = DB::transaction(function () use ($user, $project) {
            $stillBuilding = Project::where('user_id', $user->id)
                ->where('build_status', 'building')
                ->lockForUpdate()
                ->exists();

            if ($stillBuilding) {
                return true;
            }

            // Claim the build slot before releasing the lock
            $project->update([
                'build_status' => 'building',
                'build_started_at' => now(),
            ]);

            return false;
        });

        if ($raceConflict) {
            return response()->json([
                'error' => __('You have an active session. Wait for it to complete, or stop it.'),
            ], 409);
        }

        try {
            // Detect repeated prompts before appending to history
            $promptToSend = $validated['prompt'];
            $repeated = $project->detectRepeatedPrompts($validated['prompt']);
            if ($repeated) {
                $promptToSend .= "\n\nNOTE: The user has asked about this issue {$repeated['count']} times before. Previous attempts may not have fully resolved it. Try a fundamentally different approach.";
            }

            // Append user message to conversation history (raw prompt + file refs)
            $project->appendToHistory('user', $validated['prompt'], null, null, $fileRefs);

            // Enrich prompt with attached file context for builder
            if (! empty($attachedFiles)) {
                $fileLines = array_map(
                    fn ($f) => sprintf('- %s (%s, %s): %s', $f['filename'], $f['mime_type'], $f['human_size'], $f['api_url']),
                    $attachedFiles
                );
                $promptToSend .= "\n\n[Attached Files]\n".implode("\n", $fileLines)
                    ."\nUse these URLs directly in img src, href, or background-image attributes in the generated code.";
            }

            // Get optimized history (uses compacted if available)
            $historyData = $project->getHistoryForBuilderOptimized();

            $result = $this->builderService->startSession(
                $builder,
                $project,
                $promptToSend,
                [], // Legacy parameter, use historyData instead
                $validated['template_url'] ?? null,
                $templateId, // Use auto-selected or provided template
                $aiConfig,
                $historyData // Optimized history with is_compacted flag
            );

            // Update project with session info (build_status already claimed above)
            $project->update([
                'builder_id' => $builder->id,
                'build_session_id' => $result['session_id'],
                'build_completed_at' => null,
            ]);

            return response()->json([
                'session_id' => $result['session_id'],
                'builder_id' => $builder->id,
                'builder_name' => $builder->name,
            ]);
        } catch (\Exception $e) {
            // Release the build slot on failure
            $project->update([
                'build_status' => 'failed',
                'build_completed_at' => now(),
            ]);

            return response()->json([
                'error' => __('Failed to start build').': '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get build status.
     */
    public function getStatus(Request $request, Project $project): JsonResponse
    {
        $this->authorize('view', $project);

        // Quick mode: return only DB status (skips HTTP call to builder service)
        // Used by frontend polling for faster, cheaper status checks
        if ($request->boolean('quick')) {
            $data = ['status' => $project->build_status];
            if (in_array($project->build_status, ['completed', 'failed'])) {
                $data['recent_messages'] = $project->getRecentHistory(10);
            }

            return response()->json($data);
        }

        if (! $project->builder || ! $project->build_session_id) {
            return response()->json([
                'status' => $project->build_status,
                'has_session' => false,
            ]);
        }

        try {
            $status = $this->builderService->getSessionStatus(
                $project->builder,
                $project->build_session_id
            );

            // Builder returned 404 — session ended (completed/failed/cancelled)
            if ($status === null) {
                // Fix stale DB status if it still says 'building'
                if ($project->build_status === 'building') {
                    $project->update([
                        'build_status' => 'completed',
                        'build_completed_at' => $project->build_completed_at ?? now(),
                    ]);
                }

                return response()->json([
                    'status' => $project->fresh()->build_status,
                    'has_session' => false,
                    'preview_url' => $this->previewUrlFor($project),
                ]);
            }

            return response()->json([
                'status' => $project->build_status,
                'has_session' => true,
                'session_status' => $status,
                'build_session_id' => $project->build_session_id,
                'build_started_at' => $project->build_started_at?->toIso8601String(),
                'can_reconnect' => $project->build_status === 'building',
                'preview_url' => $this->previewUrlFor($project),
            ]);
        } catch (\Exception $e) {
            // Builder unreachable — don't claim session is active
            return response()->json([
                'status' => $project->build_status,
                'has_session' => false,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Hard-block AI generation on WordPress theme projects when the owner's
     * plan no longer allows the capability (plugin uninstalled, or
     * enable_wordpress turned off after a downgrade). Mirrors the creation
     * gate in ProjectController::store. Existing theme zips stay
     * previewable/downloadable — only new generation is blocked.
     */
    private function wordpressBuildBlocked(Project $project): ?JsonResponse
    {
        if (! $project->isWordPressTheme()) {
            return null;
        }

        if ($project->user?->getCurrentPlan()?->wordpressEnabled() ?? false) {
            return null;
        }

        return response()->json([
            'error' => __('Your plan no longer includes WordPress theme generation. Upgrade your plan to continue building this theme.'),
        ], 403);
    }

    /**
     * Hard-block AI generation on Shopify theme projects when the owner's plan
     * no longer allows the capability (plugin uninstalled, or enable_shopify turned
     * off after a downgrade). Mirrors wordpressBuildBlocked(). Existing theme zips
     * stay previewable/downloadable — only new generation is blocked.
     */
    private function shopifyBuildBlocked(Project $project): ?JsonResponse
    {
        if (! $project->isShopifyTheme()) {
            return null;
        }

        if ($project->user?->getCurrentPlan()?->shopifyEnabled() ?? false) {
            return null;
        }

        return response()->json([
            'error' => __('Your plan no longer includes Shopify theme generation. Upgrade your plan to continue building this theme.'),
        ], 403);
    }

    /**
     * The viewable preview URL for a project, or null when nothing is built.
     * WordPress theme projects preview in the Playground page — their preview
     * directory holds only the theme zip, so the serve route 404s for them.
     */
    private function previewUrlFor(Project $project): ?string
    {
        if ($project->isWordPressTheme()) {
            return Storage::disk('local')->exists("previews/{$project->id}/__wp_theme.zip")
                ? route('preview.wp-playground', ['project' => $project->id], false)
                : null;
        }

        return Storage::disk('local')->exists("previews/{$project->id}")
            ? "/preview/{$project->id}"
            : null;
    }

    /**
     * Send a chat message to continue the session.
     */
    public function chat(Request $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        // Block demo admin from continuing AI builds
        if (config('app.demo') && Auth::id() === 1) {
            return response()->json([
                'error' => __('The demo admin account cannot use the AI builder. Register your own account to test the AI website builder.'),
            ], 403);
        }

        if ($blocked = $this->wordpressBuildBlocked($project)) {
            return $blocked;
        }

        if ($blocked = $this->shopifyBuildBlocked($project)) {
            return $blocked;
        }

        $validated = $request->validate([
            'message' => 'required|string|max:10000',
            'file_ids' => 'nullable|array',
            'file_ids.*' => 'integer',
            'attached_files' => 'nullable|array',
            'attached_files.*.id' => 'required|integer',
            'attached_files.*.filename' => 'required|string',
            'attached_files.*.mime_type' => 'required|string',
            'attached_files.*.size' => 'required|integer|max:52428800',
            'attached_files.*.human_size' => 'required|string',
            'attached_files.*.is_image' => 'required|boolean',
            'attached_files.*.is_video' => 'nullable|boolean',
            'attached_files.*.url' => 'required|string',
            'attached_files.*.preview_url' => 'nullable|string',
        ]);

        if (! $project->builder || ! $project->build_session_id) {
            return response()->json([
                'error' => __('No active build session'),
            ], 404);
        }

        // Check credits before continuing
        $user = $request->user();
        $buildCreditService = app(BuildCreditService::class);
        if (! $buildCreditService->checkCredits($user)) {
            return response()->json([
                'error' => __('Insufficient build credits. Your credits will reset at the beginning of next month.'),
            ], 403);
        }

        // Resolve attached files if file_ids provided
        $attachedFiles = [];
        $fileRefs = null;
        if (! empty($validated['file_ids'])) {
            $plan = $user->getCurrentPlan();
            if (! $plan || ! $plan->fileStorageEnabled()) {
                return response()->json([
                    'error' => __('File storage is not enabled for your plan.'),
                ], 403);
            }
            $files = $project->files()->whereIn('id', $validated['file_ids'])->get();
            $attachedFiles = $files->map(fn ($f) => [
                'filename' => $f->original_filename,
                'api_url' => $f->getApiUrl(),
                'mime_type' => $f->mime_type,
                'size' => $f->size,
                'human_size' => $f->getHumanReadableSize(),
            ])->toArray();
            $fileRefs = $files->map(fn ($f) => [
                'id' => $f->id,
                'filename' => $f->original_filename,
                'mime_type' => $f->mime_type,
            ])->toArray();
        }

        try {
            // Detect repeated prompts before appending to history
            $messageToSend = $validated['message'];
            $repeated = $project->detectRepeatedPrompts($validated['message']);
            if ($repeated) {
                $messageToSend .= "\n\nNOTE: The user has asked about this issue {$repeated['count']} times before. Previous attempts may not have fully resolved it. Try a fundamentally different approach.";
            }

            // Also handle attached_files from request (for vision capabilities)
            $visionAttachedFiles = [];
            if (! empty($validated['attached_files'])) {
                $visionAttachedFiles = $validated['attached_files'];
            }

            // Save user message BEFORE sending to builder (raw message + file refs)
            // Note: This clears compacted_history since it's now stale
            $project->appendToHistory('user', $validated['message'], null, null, $fileRefs);

            // Enrich message with attached file context for builder
            if (! empty($attachedFiles) || ! empty($visionAttachedFiles)) {
                $allFiles = array_merge($attachedFiles, $visionAttachedFiles);
                $fileLines = array_map(
                    fn ($f) => sprintf('- %s (%s, %s): %s', $f['filename'], $f['mime_type'], $f['human_size'], $f['api_url']),
                    $allFiles
                );
                $messageToSend .= "\n\n[Attached Files]\n".implode("\n", $fileLines)
                    ."\nUse these URLs directly in img src, href, or background-image attributes in the generated code.";
            }

            // Get optimized history (uses compacted if available, but after appendToHistory
            // it will be cleared and use full conversation_history)
            $historyData = $project->getHistoryForBuilderOptimized();

            // Resolve the user's AI config (BYOK key or plan provider with fallbacks),
            // mirroring the run path. The builder adopts this config on continuation,
            // so it must be the user's real provider — not the system default that the
            // bare getAiConfig() fallback would otherwise produce.
            $aiConfig = $this->builderService->getAiConfigForUser($user);

            $result = $this->builderService->sendMessage(
                $project->builder,
                $project->build_session_id,
                $messageToSend,
                [], // Legacy parameter, use historyData instead
                $historyData, // Optimized history with is_compacted flag
                $user->getBuilderCreditLimit(),
                $aiConfig,
                $visionAttachedFiles // Vision attached files (images for vision models)
            );

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json([
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Cancel a running build session.
     */
    public function cancel(Request $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        if (! $project->builder || ! $project->build_session_id) {
            return response()->json([
                'error' => __('No active build session'),
            ], 404);
        }

        try {
            $this->builderService->cancelSession(
                $project->builder,
                $project->build_session_id
            );
        } catch (\Exception $e) {
            Log::warning('Builder cancel HTTP call failed, force-cancelling project', [
                'project_id' => $project->id,
                'session_id' => $project->build_session_id,
                'error' => $e->getMessage(),
            ]);
        }

        // Always update project status so user is never permanently stuck
        $project->update([
            'build_status' => 'cancelled',
            'build_completed_at' => now(),
        ]);

        return response()->json([
            'cancelled' => true,
        ]);
    }

    /**
     * Mark build as complete. This is a manual fallback endpoint that lets the
     * frontend force-mark a project as completed if the builder webhook never
     * arrives. Currently unused by the production frontend, but kept as a safety
     * net.
     */
    public function completeBuild(Request $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        $project->update([
            'build_status' => 'completed',
            'build_completed_at' => now(),
        ]);

        return response()->json([
            'success' => true,
        ]);
    }

    /**
     * Download build output.
     */
    public function downloadOutput(Request $request, Project $project): JsonResponse
    {
        $this->authorize('view', $project);

        if (! $project->builder) {
            return response()->json([
                'error' => __('No build to download'),
            ], 404);
        }

        try {
            $path = $this->builderService->fetchBuildOutput(
                $project->builder,
                $project->id,
                $project
            );

            $project->update(['build_path' => $path]);

            return response()->json([
                'success' => true,
                'path' => $path,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Export the project's source as a Vercel-ready ZIP and stream it to the
     * user. Plan-gated: requires the plan's `enable_code_export` flag.
     */
    public function exportSource(Request $request, Project $project, CodeExportService $exporter): BinaryFileResponse|JsonResponse
    {
        $this->authorize('view', $project);

        $plan = $request->user()?->getCurrentPlan();
        if (! ($plan?->codeExportEnabled() ?? false)) {
            return response()->json([
                'error' => __('Code export is not available on your current plan.'),
            ], 403);
        }

        if (! $project->builder || ! $project->build_session_id) {
            return response()->json([
                'error' => __('Build the project before exporting its code.'),
            ], 404);
        }

        try {
            $zipPath = $exporter->export($project);
        } catch (\Throwable $e) {
            Log::error('Code export failed', ['project' => $project->id, 'error' => $e->getMessage()]);

            return response()->json([
                'error' => __('Failed to export code').': '.$e->getMessage(),
            ], 500);
        }

        $filename = (Str::slug($project->name ?: 'project') ?: 'project').'-source.zip';

        return response()->download($zipPath, $filename, [
            'Content-Type' => 'application/zip',
        ])->deleteFileAfterSend(true);
    }

    /**
     * Get workspace files.
     */
    public function getFiles(Request $request, Project $project): JsonResponse
    {
        $this->authorize('view', $project);

        // Must have a builder to proceed
        if (! $project->builder) {
            return response()->json([
                'error' => __('No builder assigned to this project'),
            ], 404);
        }

        try {
            $files = $this->builderService->getWorkspaceFiles(
                $project->builder,
                $project->id
            );

            return response()->json($files);
        } catch (\Exception $e) {
            return response()->json([
                'error' => __('Failed to get workspace files'),
            ], 500);
        }
    }

    /**
     * Get a specific file.
     */
    public function getFile(Request $request, Project $project): JsonResponse
    {
        $this->authorize('view', $project);

        $validated = $request->validate([
            'path' => 'required|string',
        ]);

        // Must have a builder to proceed
        if (! $project->builder) {
            return response()->json([
                'error' => __('No builder assigned to this project'),
            ], 404);
        }

        try {
            $file = $this->builderService->getFile(
                $project->builder,
                $project->id,
                $validated['path']
            );

            return response()->json($file);
        } catch (\Exception $e) {
            return response()->json([
                'error' => __('Failed to get file'),
            ], 500);
        }
    }

    /**
     * Update a file in workspace.
     */
    public function updateFile(Request $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        $validated = $request->validate([
            'path' => 'required|string',
            'content' => 'required|string',
        ]);

        // Must have a builder to proceed
        if (! $project->builder) {
            return response()->json([
                'error' => __('No builder assigned to this project'),
            ], 404);
        }

        try {
            $success = $this->builderService->updateFile(
                $project->builder,
                $project->id,
                $validated['path'],
                $validated['content']
            );

            return response()->json(['success' => $success]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => __('Failed to update file'),
            ], 500);
        }
    }

    /**
     * Trigger a build.
     */
    public function triggerBuild(Request $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        // Must have a builder to proceed
        if (! $project->builder) {
            return response()->json([
                'error' => __('No builder assigned to this project'),
            ], 404);
        }

        try {
            $result = $this->builderService->triggerBuild(
                $project->builder,
                $project->id,
                $project->id
            );

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json([
                'error' => __('Build failed').': '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get AI suggestions.
     */
    public function getSuggestions(Request $request, Project $project): JsonResponse
    {
        $this->authorize('view', $project);

        if (! $project->builder || ! $project->build_session_id) {
            return response()->json([
                'suggestions' => [],
            ]);
        }

        try {
            $result = $this->builderService->getSuggestions(
                $project->builder,
                $project->build_session_id
            );

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json([
                'suggestions' => [],
            ]);
        }
    }

    /**
     * Check if the builder is online/healthy.
     */
    public function checkBuilderHealth(Request $request, Project $project): JsonResponse
    {
        $this->authorize('view', $project);

        // Get the builder for this project
        $builder = $project->builder;

        // If no builder assigned, try to get one from user's plan
        if (! $builder) {
            $user = $request->user();
            if ($user->plan) {
                $builder = $user->plan->getBuilderWithFallbacks();
            }
        }

        if (! $builder) {
            return response()->json([
                'online' => false,
                'message' => __('No builder available'),
            ]);
        }

        // Check builder health by pinging the root URL
        $details = $builder->getDetails();

        return response()->json([
            'online' => $details['online'],
            'builder_id' => $builder->id,
            'builder_name' => $builder->name,
            'builder_url' => $builder->full_url,
            'version' => $details['version'],
            'sessions' => $details['sessions'],
        ]);
    }

    /**
     * Attempt to recover a workspace from a failed build.
     */
    public function recoverBuild(Request $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        if (! $project->builder) {
            return response()->json(['error' => __('No builder assigned')], 404);
        }

        try {
            $result = $this->builderService->recoverWorkspace(
                $project->builder,
                $project->id,
                $project->output_target,
            );

            if ($result['success'] ?? false) {
                $project->update(['build_status' => 'idle']);
            }

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json(['error' => __('Recovery failed').': '.$e->getMessage()], 500);
        }
    }

    /**
     * Perform className-aware edit on a workspace file.
     */
    public function classEdit(Request $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        if (! $project->builder) {
            return response()->json(['error' => __('No builder assigned')], 404);
        }

        $validated = $request->validate([
            // path optional: when omitted the builder locates the element by its
            // className + text_anchor (the visual Style panel's deterministic path).
            // Bounded lengths — Tailwind class strings are never this long; this
            // caps the builder's source scan work per request.
            'path' => 'nullable|string|max:500',
            'old_class_name' => 'required|string|max:1024',
            'new_class_name' => 'required|string|max:1024',
            'text_anchor' => 'nullable|string|max:512',
        ]);

        try {
            $result = $this->builderService->classEditWorkspace(
                $project->builder,
                $project->id,
                $validated['path'] ?? '',
                $validated['old_class_name'],
                $validated['new_class_name'],
                $validated['text_anchor'] ?? ''
            );

            // A successful deterministic edit changed source files — rebuild so
            // the preview reflects it (mirrors the undo/redo flow). On an
            // ambiguous/not-found result we skip the build; the client falls back
            // to the AI style-edit path.
            if (($result['success'] ?? false) === true) {
                $this->builderService->triggerBuild($project->builder, $project->id, $project->id);
            }

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json(['error' => __('Class edit failed').': '.$e->getMessage()], 500);
        }
    }

    /**
     * Guard shared by the revision endpoints (undo/redo/restore): a restore
     * triggers a rebuild, so it must respect the WordPress plan hard-block
     * and the demo-admin block, mirroring startBuild/chat.
     *
     * Deliberately NOT guarded on build_status: the DB column lags the
     * builder's real session state (webhook-synced), so it false-positives
     * right after a build completes. The builder's own in-memory session
     * guard is authoritative and returns a 409 we pass through to the UI.
     */
    private function revisionMutationBlocked(Project $project): ?JsonResponse
    {
        if (config('app.demo') && Auth::id() === 1) {
            return response()->json([
                'error' => __('The demo admin account cannot use the AI builder. Register your own account to test the AI website builder.'),
            ], 403);
        }

        if ($blocked = $this->wordpressBuildBlocked($project)) {
            return $blocked;
        }

        if ($blocked = $this->shopifyBuildBlocked($project)) {
            return $blocked;
        }

        if (! $project->builder) {
            return response()->json(['error' => __('No builder assigned')], 404);
        }

        return null;
    }

    /**
     * Rebuild the preview after a successful revision mutation. The mutation
     * itself already applied on the builder — a rebuild failure must not
     * cascade into an error response (the frontend would report "Undo
     * failed" for an undo that succeeded, and skip the history entry that
     * keeps the AI's context truthful). Worst case the preview is stale
     * until the next build.
     */
    private function rebuildAfterRevisionMutation(Project $project): void
    {
        try {
            $this->builderService->triggerBuild($project->builder, $project->id, $project->id);
        } catch (\Exception $e) {
            Log::warning('Post-revision rebuild failed; workspace was reverted but the preview may be stale', [
                'project_id' => $project->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Record a revision mutation in the conversation history so the AI's
     * context stays truthful: after an undo the model must not believe its
     * reverted changes are still in the code. Stored as a synthetic user
     * entry (the [PREFIX] is stripped/specially rendered by the chat UI,
     * mirroring [STYLE_EDIT]).
     */
    private function recordRevisionEvent(Project $project, string $prefix, ?array $revision): void
    {
        $label = trim((string) ($revision['label'] ?? ''));
        // Always quoted — the chat UI extracts the checkpoint name from the
        // quoted segment to render the synthetic bubble's details line.
        $checkpoint = $label !== '' ? "\"{$label}\"" : '"an earlier checkpoint"';

        $content = match ($prefix) {
            'UNDO' => "[UNDO] I reverted the last change. The project files were restored to the checkpoint {$checkpoint}. Changes made after that checkpoint are no longer in the code.",
            'REDO' => "[REDO] I re-applied a previously undone change. The project files now match the checkpoint {$checkpoint}.",
            default => "[RESTORE] I restored the project files to the checkpoint {$checkpoint}. Changes made after that checkpoint are no longer in the code.",
        };

        try {
            $project->appendToHistory('user', $content);
        } catch (\Throwable $e) {
            Log::warning('Failed to record revision event in conversation history', [
                'project_id' => $project->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Undo the last revision in the workspace.
     */
    public function undo(Request $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        if ($blocked = $this->revisionMutationBlocked($project)) {
            return $blocked;
        }

        try {
            $result = $this->builderService->undoWorkspace($project->builder, $project->id);
        } catch (\Exception $e) {
            return response()->json(['error' => __('Undo failed').': '.$e->getMessage()], 500);
        }

        if ($result['success'] ?? false) {
            $this->rebuildAfterRevisionMutation($project);
            $this->recordRevisionEvent($project, 'UNDO', $result['revision'] ?? null);
        }

        return response()->json($result);
    }

    /**
     * Redo the next revision in the workspace.
     */
    public function redo(Request $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        if ($blocked = $this->revisionMutationBlocked($project)) {
            return $blocked;
        }

        try {
            $result = $this->builderService->redoWorkspace($project->builder, $project->id);
        } catch (\Exception $e) {
            return response()->json(['error' => __('Redo failed').': '.$e->getMessage()], 500);
        }

        if ($result['success'] ?? false) {
            $this->rebuildAfterRevisionMutation($project);
            $this->recordRevisionEvent($project, 'REDO', $result['revision'] ?? null);
        }

        return response()->json($result);
    }

    /**
     * Restore the workspace to a specific revision from the history panel.
     */
    public function restoreRevision(Request $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        if ($blocked = $this->revisionMutationBlocked($project)) {
            return $blocked;
        }

        $validated = $request->validate([
            'revision_id' => 'required|integer|min:1',
        ]);

        try {
            $result = $this->builderService->restoreWorkspace(
                $project->builder,
                $project->id,
                $validated['revision_id'],
            );
        } catch (\Exception $e) {
            return response()->json(['error' => __('Restore failed').': '.$e->getMessage()], 500);
        }

        if ($result['success'] ?? false) {
            $this->rebuildAfterRevisionMutation($project);
            $this->recordRevisionEvent($project, 'RESTORE', $result['revision'] ?? null);
        }

        return response()->json($result);
    }

    /**
     * Get revision history for the workspace. Forwards pagination params
     * `limit` (1-50, default 20) and `before` (exclusive cursor, default 0
     * = newest page) to the builder.
     */
    public function getRevisions(Request $request, Project $project): JsonResponse
    {
        $this->authorize('view', $project);

        if (! $project->builder) {
            return response()->json(['error' => __('No builder assigned')], 404);
        }

        $validated = $request->validate([
            'limit' => 'sometimes|integer|between:1,50',
            'before' => 'sometimes|integer|min:0',
        ]);

        try {
            // $validated only contains keys that were present and passed
            // validation (thanks to `sometimes`), so it's already safe to
            // forward as-is — no null-filter needed.
            $revisions = $this->builderService->getRevisions(
                $project->builder,
                $project->id,
                $validated,
            );

            return response()->json($revisions);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Check if a given provider and model support vision capabilities.
     * This mirrors the logic in the Go builder's factory.go.
     */
    private function modelSupportsVision(string $providerType, string $model): bool
    {
        $visionPatterns = [
            'openai' => ['gpt-4o', 'gpt-4-turbo', 'gpt-4-vision', 'gpt-4o-mini'],
            'anthropic' => ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-3.5', 'claude-sonnet-4', 'claude-opus-4'],
            'grok' => ['grok-vision', 'grok-1.5v'],
            'deepseek' => ['deepseek-vl', 'deepseek-chat-v2.5'],
            'zhipu' => ['glm-4v', 'glm-4v-plus', 'glm-4v-plus-250414'],
            'ollama' => ['llava', 'bakllava', 'moondream', 'qwen2-vl'],
            'openrouter' => ['gpt-4o', 'gpt-4-vision', 'claude-3-opus', 'claude-3-sonnet', 'gemini-1.5', 'gemini-pro-vision'],
            'kimi' => ['moonshot-v1-vision', 'kimi-vl', 'kimi-k2.6'],
            'minimax' => ['minimax-01', 'minimax-m3', 'abab6.5s', 'abab6.5g', 'video-01'],
            'nvidia' => ['nvidia-', 'nim-', 'llama-', 'mistral-', 'mixtral-', 'gemma-', 'nemotron', 'mistral-nemo'],
        ];

        $providerType = strtolower($providerType);
        $model = strtolower($model);

        if (! isset($visionPatterns[$providerType])) {
            return false;
        }

        foreach ($visionPatterns[$providerType] as $pattern) {
            if (str_contains($model, strtolower($pattern))) {
                return true;
            }
        }

        return false;
    }
}
