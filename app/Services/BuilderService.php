<?php

namespace App\Services;

use App\Jobs\PushShopifyThemeToStore;
use App\Models\AiProvider;
use App\Models\Builder;
use App\Models\Plan;
use App\Models\Plugin;
use App\Models\Project;
use App\Models\SystemSetting;
use App\Models\Template;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class BuilderService
{
    /**
     * Currently active AI provider for this request.
     */
    protected ?AiProvider $aiProvider = null;

    /**
     * Whether the current user is using their own API key.
     */
    protected bool $usingOwnKey = false;

    /**
     * Get AI configuration from the user's plan's AI Provider.
     * This is the primary method to retrieve AI config.
     * Supports user's own API keys if their plan allows it.
     */
    public function getAiConfigForUser(User $user): array
    {
        $this->usingOwnKey = false;

        // Check if user is using their own API key
        if ($user->isUsingOwnAiApiKey()) {
            return $this->getAiConfigFromUserKey($user);
        }

        $plan = $user->getCurrentPlan();

        if ($plan) {
            $this->aiProvider = $plan->getAiProviderWithFallbacks();
        }

        // Plan-less user (no subscription and no assigned plan): fall back to
        // the system default provider directly — the same tail of the chain
        // Plan::getAiProviderWithFallbacks() would have walked.
        if (! $this->aiProvider) {
            $defaultId = SystemSetting::get('default_ai_provider_id');
            if ($defaultId) {
                $provider = AiProvider::find($defaultId);
                if ($provider && $provider->status === 'active') {
                    $this->aiProvider = $provider;
                }
            }
        }

        if (! $this->aiProvider) {
            throw new \Exception('No AI provider configured. Please add an AI provider in admin settings.');
        }

        // Record usage
        $this->aiProvider->recordUsage();

        return $this->aiProvider->toAiConfig();
    }

    /**
     * Get AI configuration from user's own API key.
     */
    protected function getAiConfigFromUserKey(User $user): array
    {
        $this->usingOwnKey = true;
        $settings = $user->aiSettings;

        if (! $settings) {
            throw new \Exception('User AI settings not configured.');
        }

        $provider = $settings->preferred_provider;
        $apiKey = $settings->getApiKeyFor($provider);
        $model = $settings->preferred_model;

        if (empty($apiKey)) {
            throw new \Exception("No API key configured for {$provider}.");
        }

        // Get default base URL for the provider type
        $baseUrl = AiProvider::DEFAULT_BASE_URLS[$provider] ?? '';

        // Resolve the model from the provider's default model allowlist.
        $allowedModels = AiProvider::DEFAULT_MODELS[$provider] ?? [];

        // If no preferred model, or the preferred model is not allowed, fall back to first default.
        if (empty($model) || (! empty($allowedModels) && ! in_array($model, $allowedModels, true))) {
            $model = $allowedModels[0] ?? 'gpt-5.4';
        }

        return [
            'provider' => $provider,
            'agent' => [
                'api_key' => $apiKey,
                'base_url' => $baseUrl,
                'model' => $model,
                'max_tokens' => 8192,
                'provider_type' => $provider,
            ],
            'summarizer' => [
                'api_key' => $apiKey,
                'base_url' => $baseUrl,
                'model' => $model, // Use same model as agent for consistency
                'max_tokens' => 1500, // Default for user's own key
                'provider_type' => $provider,
            ],
            'suggestions' => [
                'api_key' => $apiKey,
                'base_url' => $baseUrl,
                'model' => $model, // Use same model as agent for consistency
                'provider_type' => $provider,
            ],
        ];
    }

    /**
     * Get AI configuration from the currently set provider.
     * Used for subsequent calls after initial setup.
     */
    public function getAiConfig(): array
    {
        if ($this->aiProvider) {
            return $this->aiProvider->toAiConfig();
        }

        // Fallback to system default provider from settings
        $defaultId = SystemSetting::get('default_ai_provider_id');
        if ($defaultId) {
            $this->aiProvider = AiProvider::find($defaultId);
            if ($this->aiProvider && $this->aiProvider->status !== 'active') {
                $this->aiProvider = null;
            }
        }

        if (! $this->aiProvider) {
            throw new \Exception('No AI provider configured.');
        }

        return $this->aiProvider->toAiConfig();
    }

    /**
     * Get Pusher/Reverb configuration for direct streaming to frontend.
     * Returns null if broadcasting is not configured.
     * Both Pusher and Reverb use the same payload key ("pusher") since
     * the Go builder uses the Pusher SDK for both.
     */
    protected function getPusherConfigForBuilder(): ?array
    {
        $settings = SystemSetting::getGroup('integrations');
        $driver = $settings['broadcast_driver'] ?? 'pusher';

        if ($driver === 'reverb') {
            if (empty($settings['reverb_app_id']) ||
                empty($settings['reverb_key']) ||
                empty($settings['reverb_secret']) ||
                empty($settings['reverb_host'])) {
                return null;
            }

            $host = $settings['reverb_host'];
            $port = $settings['reverb_port'] ?? 8080;
            $scheme = $settings['reverb_scheme'] ?? 'https';

            return [
                'app_id' => $settings['reverb_app_id'],
                'key' => $settings['reverb_key'],
                'secret' => $settings['reverb_secret'],
                'host' => $host.':'.$port,
                'scheme' => $scheme,
            ];
        }

        // Pusher (default)
        if (empty($settings['pusher_app_id']) ||
            empty($settings['pusher_key']) ||
            empty($settings['pusher_secret'])) {
            return null;
        }

        return [
            'app_id' => $settings['pusher_app_id'],
            'key' => $settings['pusher_key'],
            'secret' => $settings['pusher_secret'],
            'cluster' => $settings['pusher_cluster'] ?? 'mt1',
        ];
    }

/**
     * Start a new build session.
     *
     * @param  string  $prompt  The user's build prompt/goal
     * @param  array  $history  Previous conversation history (deprecated, use historyData)
     * @param  string|null  $templateUrl  Optional template URL
     * @param  string|null  $templateId  Optional template ID from Laravel
     * @param  array|null  $aiConfig  Optional AI config (if null, uses current provider)
     * @param  array|null  $historyData  Optimized history data from getHistoryForBuilderOptimized()
     * @param  array|null  $attachedFiles  Vision attached files (images) for vision models
     */
    public function startSession(
        Builder $builder,
        Project $project,
        string $prompt,
        array $history = [],
        ?string $templateUrl = null,
        ?string $templateId = null,
        ?array $aiConfig = null,
        ?array $historyData = null,
        ?array $attachedFiles = null
    ): array {
        // Use optimized history data if provided, otherwise fall back to legacy history
        $historyToSend = $history;
        $isCompacted = false;
        if ($historyData !== null) {
            $historyToSend = $historyData['history'] ?? [];
            $isCompacted = $historyData['is_compacted'] ?? false;
        }

        $payload = [
            'goal' => $prompt,
            'max_iterations' => $builder->max_iterations ?? 100,
            'history' => $historyToSend,
            'is_compacted' => $isCompacted,
            'config' => $aiConfig ?? $this->getAiConfig(),
            'workspace_id' => $project->id,
            'webhook_url' => route('builder.webhook'),
        ];

        // Build template config
        $templateConfig = [];
        if ($templateUrl) {
            $templateConfig['url'] = $templateUrl;
        }
        if ($templateId) {
            $templateConfig['template_id'] = $templateId;
            // Look up template name for better logging/display
            $template = Template::find($templateId);
            if ($template) {
                $templateConfig['template_name'] = $template->name;
            }
        }
        if (! empty($templateConfig)) {
            $payload['template'] = $templateConfig;
        }

        // Add Laravel URL for dynamic template fetching
        $laravelUrl = config('app.url');
        if ($laravelUrl) {
            $payload['laravel_url'] = $laravelUrl;
        }

        // Pass the owning user's ID so the builder can post Firecrawl reconciliation
        // back to Laravel with the correct user reference.
        if ($project->user_id) {
            $payload['user_id'] = (int) $project->user_id;
        }

        // Pass the project's display name so the builder can title the generated
        // site after the real project (index.html <title>, WordPress Theme Name)
        // instead of the template's stock placeholder.
        if (trim((string) $project->name) !== '') {
            $payload['project_name'] = $project->name;
        }

        // Add Pusher config for direct streaming if configured
        $pusherConfig = $this->getPusherConfigForBuilder();
        if ($pusherConfig !== null) {
            $payload['pusher'] = $pusherConfig;
        }

        // Build project capabilities payload for agent awareness
        $payload['project_capabilities'] = $this->buildProjectCapabilities($project);

        // Output target (generation kind) for the builder's BuildTarget registry.
        // Defaults to "website"; "wordpress_theme" selects FSE block-theme generation.
        $payload['output_type'] = $project->output_target ?? 'website';

        // Resolve the design system (tokens + accent + fonts + playbook) the
        // builder overlays onto the template at build time. For Automatic
        // projects (no system chosen yet) this picks + persists one first.
        $designService = app(DesignSystemService::class);
        $designService->ensureResolved($project);
        $designSystem = $designService->buildPayload($project);
        if ($designSystem !== null) {
            $payload['design_system'] = $designSystem;
        }

        // Add attached files - only images are sent to AI for vision
        // Videos are stored but NOT sent to AI (user tells AI where to place them)
        // Document files are noted but not processed for content (user references them)
        if (! empty($attachedFiles)) {
            $images = [];
            $attachedVideos = [];
            $attachedDocs = [];

            foreach ($attachedFiles as $file) {
                $mimeType = $file['mime_type'] ?? '';
                $isVideo = strpos($mimeType, 'video/') === 0;
                $isImage = strpos($mimeType, 'image/') === 0;

                // Videos - stored but NOT sent to AI
                if ($isVideo) {
                    $attachedVideos[] = [
                        'filename' => $file['filename'] ?? 'video',
                        'url' => $file['url'] ?? '',
                    ];
                    continue;
                }

                // Images - sent to AI for vision
                if ($isImage && ! empty($file['preview_url'])) {
                    try {
                        $imageResponse = Http::timeout(10)->get($file['preview_url']);
                        if ($imageResponse->successful()) {
                            $images[] = [
                                'id' => $file['id'] ?? 0,
                                'base64' => base64_encode($imageResponse->body()),
                                'mime_type' => $mimeType,
                                'filename' => $file['filename'] ?? 'image',
                            ];
                        }
                    } catch (\Exception $e) {
                        logger()->warning('Failed to fetch image', ['error' => $e->getMessage()]);
                    }
                }

                // Documents - note they exist for user reference
                if (! $isImage && ! $isVideo) {
                    $attachedDocs[] = [
                        'filename' => $file['filename'] ?? 'document',
                        'mime_type' => $mimeType,
                    ];
                }
            }

            // Send images to AI for vision processing
            if (! empty($images)) {
                $payload['images'] = $images;
            }

            // Note attached videos - AI knows they're in the project for placement
            if (! empty($attachedVideos)) {
                $payload['attached_videos'] = $attachedVideos;
            }

            // Note attached documents
            if (! empty($attachedDocs)) {
                $payload['attached_documents'] = $attachedDocs;
            }
        }

        $timeout = 30;

        $response = Http::timeout($timeout)
            ->withHeaders(['X-Server-Key' => $builder->server_key])
            ->post("{$builder->full_url}/api/run", $payload);

        if (! $response->successful()) {
            throw new \Exception('Failed to start session: '.mb_substr($response->body(), 0, 200));
        }

        $builder->update(['last_triggered_at' => now()]);

        return $response->json();
    }

    /**
     * Get session status from builder.
     * Returns null when the builder reports the session no longer exists (404).
     */
    public function getSessionStatus(Builder $builder, string $sessionId): ?array
    {
        $response = Http::timeout(10)
            ->withHeaders(['X-Server-Key' => $builder->server_key])
            ->get("{$builder->full_url}/api/status/{$sessionId}");

        if ($response->status() === 404) {
            return null;
        }

        if (! $response->successful()) {
            throw new \Exception('Failed to get session status');
        }

        return $response->json();
    }

/**
     * Send a message to continue an existing build session.
     *
     * @param  array  $history  Previous conversation history (deprecated, use historyData)
     * @param  array|null  $historyData  Optimized history data from getHistoryForBuilderOptimized()
     * @param  array|null  $attachedFiles  Vision attached files (images) for vision models
     */
    public function sendMessage(Builder $builder, string $sessionId, string $message, array $history = [], ?array $historyData = null, ?int $remainingCredits = null, ?array $aiConfig = null, ?array $attachedFiles = null): array
    {
        // Use optimized history data if provided, otherwise fall back to legacy history
        $historyToSend = $history;
        $isCompacted = false;
        if ($historyData !== null) {
            $historyToSend = $historyData['history'] ?? [];
            $isCompacted = $historyData['is_compacted'] ?? false;
        }

        // Prefer the caller-resolved per-user config (BYOK key / plan provider with
        // fallbacks) — same as the run path. The builder now adopts this config on
        // continuation, so falling back to the bare system-default getAiConfig()
        // here would swap a BYOK user's key (or ignore plan fallbacks) mid-session.
        $config = $aiConfig ?? $this->getAiConfig();
        if ($remainingCredits !== null) {
            $config['agent']['remaining_build_credits'] = $remainingCredits;
        }

        $response = Http::timeout(30)
            ->withHeaders(['X-Server-Key' => $builder->server_key])
            ->post("{$builder->full_url}/api/chat/{$sessionId}", [
                'message' => $message,
                'history' => $historyToSend,
                'is_compacted' => $isCompacted,
                'config' => $config,
                'images' => $attachedFiles ?? [],
            ]);

        if (! $response->successful()) {
            throw new \Exception('Failed to send message: '.$response->body());
        }

        return $response->json();
    }

    /**
     * Cancel a running session.
     */
    public function cancelSession(Builder $builder, string $sessionId): bool
    {
        $response = Http::timeout(10)
            ->withHeaders(['X-Server-Key' => $builder->server_key])
            ->post("{$builder->full_url}/api/stop/{$sessionId}");

        return $response->successful();
    }

    /**
     * Fetch build output from builder and store locally.
     */
    public function fetchBuildOutput(Builder $builder, string $workspaceId, Project $project): string
    {
        $response = Http::timeout(120)
            ->withHeaders(['X-Server-Key' => $builder->server_key])
            ->get("{$builder->full_url}/api/build-output-workspace/{$workspaceId}");

        if (! $response->successful()) {
            throw new \Exception('Failed to fetch build output: '.$response->body());
        }

        // Use local storage with builds path
        $disk = 'local';
        $basePath = 'builds';
        $path = "{$basePath}/{$project->id}/{$workspaceId}.zip";

        Storage::disk($disk)->put($path, $response->body());

        return $path;
    }

    /**
     * Get workspace files from builder.
     */
    public function getWorkspaceFiles(Builder $builder, string $workspaceId): array
    {
        $response = Http::timeout(10)
            ->withHeaders(['X-Server-Key' => $builder->server_key])
            ->get("{$builder->full_url}/api/files-workspace/{$workspaceId}");

        if (! $response->successful()) {
            throw new \Exception('Failed to get workspace files');
        }

        return $response->json();
    }

    /**
     * Get a specific file from workspace.
     */
    public function getFile(Builder $builder, string $workspaceId, string $path): array
    {
        $response = Http::timeout(10)
            ->withHeaders(['X-Server-Key' => $builder->server_key])
            ->get("{$builder->full_url}/api/file-workspace/{$workspaceId}", ['path' => $path]);

        if (! $response->successful()) {
            throw new \Exception('Failed to get file');
        }

        return $response->json();
    }

    /**
     * Update a file in workspace.
     */
    public function updateFile(Builder $builder, string $workspaceId, string $path, string $content): bool
    {
        $response = Http::timeout(10)
            ->withHeaders(['X-Server-Key' => $builder->server_key])
            ->put("{$builder->full_url}/api/file-workspace/{$workspaceId}", [
                'path' => $path,
                'content' => $content,
            ]);

        return $response->successful();
    }

    /**
     * Trigger a build on the builder and download the output.
     */
    public function triggerBuild(Builder $builder, string $workspaceId, int|string|null $projectId = null): array
    {
        // WordPress block themes are declarative — there is no npm build step.
        // POSTing /api/build-workspace (npm install + run build) fails with
        // "No package.json found in workspace", so skip it and package the theme
        // directly for the in-app WordPress Playground preview. (Before the
        // template-scoping fix this silently "worked" only because the React
        // template leaked a package.json into the theme workspace.)
        //
        // Shopify themes follow the same pattern: extract the builder's zip, then
        // dispatch a background job that pushes it to the user's store.
        $project = $projectId ? Project::find($projectId) : null;
        if ($project && $project->isWordPressTheme()) {
            $this->downloadAndExtractBuildOutput($builder, $workspaceId, $projectId);

            return [
                'success' => true,
                'preview_url' => "/preview/{$projectId}",
            ];
        }
        if ($project && $project->isShopifyTheme()) {
            $this->downloadAndExtractBuildOutput($builder, $workspaceId, $projectId);

            // Only auto-push when store connections are enabled. Guards the case
            // where an operator disables the toggle after a store was attached —
            // a stale connection must not keep pushing in download-only mode.
            if ($project->shopify_connection_id && app(ShopifyService::class)->storeConnectionsEnabled()) {
                PushShopifyThemeToStore::dispatch($project->id);
            }

            return [
                'success' => true,
                'preview_url' => "/preview/{$projectId}",
            ];
        }

        $response = Http::timeout(300)
            ->withHeaders(['X-Server-Key' => $builder->server_key])
            ->post("{$builder->full_url}/api/build-workspace/{$workspaceId}");

        if (! $response->successful()) {
            throw new \Exception('Build failed: '.$response->body());
        }

        $result = $response->json();

        // If project ID provided, download and extract build output
        if ($projectId && ($result['success'] ?? false)) {
            $this->downloadAndExtractBuildOutput($builder, $workspaceId, $projectId);
            $result['preview_url'] = "/preview/{$projectId}";
        }

        return $result;
    }

    /**
     * Download build output from builder and extract to preview storage.
     */
    protected function downloadAndExtractBuildOutput(Builder $builder, string $workspaceId, int|string $projectId): void
    {
        // Tell the builder which packaging the project needs. Authoritative
        // over the builder's structural fallback (style.css sniffing), so a
        // malformed workspace can never be packaged as the wrong artifact.
        $project = Project::find($projectId);
        $outputType = $project?->output_target ?? 'website';

        $response = Http::timeout(60)
            ->withHeaders(['X-Server-Key' => $builder->server_key])
            ->get("{$builder->full_url}/api/build-output-workspace/{$workspaceId}", [
                'output_type' => $outputType,
            ]);

        if (! $response->successful()) {
            throw new \Exception('Failed to download build output: '.mb_substr($response->body(), 0, 200));
        }

        // Create preview directory and clear published cache
        $previewPath = "previews/{$projectId}";
        Storage::disk('local')->deleteDirectory($previewPath);
        Storage::disk('local')->makeDirectory($previewPath);
        Storage::disk('local')->deleteDirectory("published/{$projectId}");

        // Extract zip to preview directory
        $zipPath = Storage::disk('local')->path("temp/{$workspaceId}.zip");
        Storage::disk('local')->makeDirectory('temp');
        file_put_contents($zipPath, $response->body());

        $zip = new \ZipArchive;
        $openResult = $zip->open($zipPath);
        if ($openResult !== true) {
            Log::error('Failed to open build output zip', [
                'project_id' => $projectId,
                'zip_error_code' => $openResult,
            ]);
            throw new \Exception("Failed to open build output zip (error code: {$openResult})");
        }

        $extracted = $zip->extractTo(Storage::disk('local')->path($previewPath));
        $zip->close();

        if (! $extracted) {
            Log::error('Failed to extract build output zip', [
                'project_id' => $projectId,
            ]);
            throw new \Exception('Failed to extract build output zip');
        }

        // WordPress themes have no index.html to configure — the extracted files
        // are the theme. Keep the raw theme zip so the in-app WordPress Playground
        // preview can install it, and skip the React config injection entirely.
        if ($project && $project->isWordPressTheme()) {
            // Keep the raw theme zip so the in-app Playground preview can install
            // it. A silent copy failure here would report a successful build while
            // wpThemeZip() later 404s with no trace — fail loudly instead, matching
            // how the website path surfaces extraction failures.
            $dest = Storage::disk('local')->path("{$previewPath}/__wp_theme.zip");
            if (! @copy($zipPath, $dest)) {
                Log::error('Failed to copy WordPress theme zip to preview directory', [
                    'project_id' => $projectId,
                    'source' => $zipPath,
                    'destination' => $dest,
                ]);
                @unlink($zipPath);
                throw new \Exception('Failed to package WordPress theme for preview');
            }
            @unlink($zipPath);

            return;
        }

        // Shopify themes (like WordPress) are the extracted files themselves — no
        // index.html to configure. Keep the raw theme zip so the editor download +
        // the store-push job can use it; skip the React config injection.
        if ($project && $project->isShopifyTheme()) {
            $dest = Storage::disk('local')->path("{$previewPath}/__shopify_theme.zip");
            if (! @copy($zipPath, $dest)) {
                Log::error('Failed to copy Shopify theme zip to preview directory', [
                    'project_id' => $projectId,
                    'source' => $zipPath,
                    'destination' => $dest,
                ]);
                @unlink($zipPath);
                throw new \Exception('Failed to package Shopify theme for preview');
            }
            @unlink($zipPath);

            return;
        }

        // Inject app config into index.html
        if ($project) {
            try {
                $this->injectAppConfig($project, $previewPath);
            } catch (\Throwable $e) {
                Log::error('Failed to inject app config into build output', [
                    'project_id' => $projectId,
                    'error' => $e->getMessage(),
                ]);

                if ($project->user) {
                    try {
                        app(NotificationService::class)->notify(
                            $project->user,
                            UserNotification::TYPE_BUILD_WARNING,
                            __('Build Configuration Warning'),
                            __('Your project built successfully but some configuration could not be applied. API features may not work until the next build.'),
                            ['project_id' => $project->id, 'error' => $e->getMessage()],
                            "/project/{$project->id}"
                        );
                    } catch (\Throwable) {
                        // Don't let notification failure break the build flow
                    }
                }
            }
        }

        // Clean up temp file
        if (file_exists($zipPath)) {
            unlink($zipPath);
        }
    }

    /**
     * Get AI suggestions for next steps.
     */
    public function getSuggestions(Builder $builder, string $sessionId): array
    {
        $response = Http::timeout(30)
            ->withHeaders(['X-Server-Key' => $builder->server_key])
            ->get("{$builder->full_url}/api/suggestions/{$sessionId}");

        if (! $response->successful()) {
            return ['suggestions' => []];
        }

        return $response->json();
    }

    /**
     * Build project capabilities payload for the Go builder agent.
     * This tells the agent what dynamic features are available for the project.
     */
    protected function buildProjectCapabilities(Project $project): array
    {
        $user = $project->user;
        $plan = $user?->getCurrentPlan();

        // WordPress/Shopify theme projects are downloadable artifacts: no platform
        // storage uploads, no Supabase backend, no GitHub repo. Project creation
        // already refuses these links for theme projects — this is defense-in-depth
        // so a stale/crafted linkage never reaches the agent.
        if ($project->isWordPressTheme() || $project->isShopifyTheme()) {
            return [
                'storage' => ['enabled' => false],
                'web_agent' => $this->buildWebAgentCapability($plan, $project->user),
                'supabase' => ['enabled' => false],
                'github' => ['enabled' => false],
            ];
        }

        return [
            'storage' => [
                'enabled' => $plan?->fileStorageEnabled() ?? false,
                'max_file_size_mb' => $plan?->getMaxFileSizeMb() ?? 10,
                'allowed_file_types' => $plan?->allowed_file_types ?? [],
            ],
            'web_agent' => $this->buildWebAgentCapability($plan, $project->user),
            'supabase' => $this->buildSupabaseCapability($project, $plan),
            'github' => $this->buildGithubCapability($project, $plan),
        ];
    }

    /**
     * Build the supabase capability sub-payload. When the plan lacks the
     * Database capability or no backend is configured, returns disabled and the
     * agent generates static-only apps.
     */
    private function buildSupabaseCapability(Project $project, ?Plan $plan): array
    {
        $supabase = app(SupabaseService::class);

        if (! ($plan?->databaseEnabled() ?? false) || ! $supabase->hasConnection($project)) {
            return ['enabled' => false];
        }

        return array_merge(['enabled' => true], $supabase->resolveForProject($project));
    }

    /**
     * Build the github capability sub-payload. When the plan lacks the GitHub
     * capability or the project has no linked repo, returns disabled. The token
     * is never included here — the builder fetches it via a callback.
     */
    private function buildGithubCapability(Project $project, ?Plan $plan): array
    {
        if (! ($plan?->githubEnabled() ?? false) || ! $project->github_repo_name) {
            return ['enabled' => false];
        }

        return [
            'enabled' => true,
            'owner' => $project->github_repo_owner,
            'name' => $project->github_repo_name,
            'default_branch' => $project->github_default_branch ?? 'main',
            'auto_push' => (bool) $project->github_auto_push,
        ];
    }

    /**
     * Build the web_agent capability sub-payload, reading admin-configured
     * limits from the WebAgent plugin's config row (with safe defaults). The
     * builder still server-side caps any out-of-range value as a backstop.
     */
    private function buildWebAgentCapability(?Plan $plan, ?User $user): array
    {
        $defaults = [
            'enabled' => $plan?->webAgentEnabled() ?? false,
            'fetch_mode' => 'http',
            'max_actions_per_session' => 50,
            'http_timeout_seconds' => 15,
            'browser_action_timeout_seconds' => 30,
            'max_response_size_mb' => 5,
            'firecrawl_enabled' => $plan?->firecrawlEnabled() ?? false,
            'firecrawl_api_key' => null,
            'firecrawl_remaining_pages' => null,
            'firecrawl_max_calls_per_session' => 20,
        ];

        if (! $defaults['enabled']) {
            return $defaults;
        }

        $plugin = Plugin::where('slug', 'webagent')->first();
        $config = $plugin?->config ?? [];

        foreach (['max_actions_per_session', 'http_timeout_seconds', 'browser_action_timeout_seconds', 'max_response_size_mb'] as $key) {
            if (isset($config[$key]) && is_numeric($config[$key])) {
                $defaults[$key] = (int) $config[$key];
            }
        }

        if (isset($config['fetch_mode']) && in_array($config['fetch_mode'], ['http', 'browser', 'firecrawl', 'smart'], true)) {
            $defaults['fetch_mode'] = $config['fetch_mode'];
        }

        // Firecrawl: only pass key + quota when mode actually uses it AND plan enables it.
        if ($defaults['firecrawl_enabled'] && in_array($defaults['fetch_mode'], ['firecrawl', 'smart'], true)) {
            $defaults['firecrawl_api_key'] = $config['firecrawl_api_key'] ?? null;
            $defaults['firecrawl_remaining_pages'] = $user?->firecrawlPagesRemaining();
            if (isset($config['max_firecrawl_calls_per_session']) && is_numeric($config['max_firecrawl_calls_per_session'])) {
                $defaults['firecrawl_max_calls_per_session'] = (int) $config['max_firecrawl_calls_per_session'];
            }
        } else {
            // Strip key even if set; mode doesn't allow firecrawl.
            $defaults['firecrawl_enabled'] = false;
            $defaults['firecrawl_api_key'] = null;
        }

        return $defaults;
    }

    /**
     * Build meta tags HTML for the project.
     */
    protected function buildMetaTags(Project $project): string
    {
        $title = htmlspecialchars(
            $project->published_title ?? $project->name ?? 'Webby Project',
            ENT_QUOTES,
            'UTF-8'
        );

        $tags = [];

        // Meta description
        if (! empty($project->published_description)) {
            $description = htmlspecialchars($project->published_description, ENT_QUOTES, 'UTF-8');
            $tags[] = sprintf('<meta name="description" content="%s">', $description);
        }

        // Open Graph
        $tags[] = sprintf('<meta property="og:title" content="%s">', $title);
        $tags[] = '<meta property="og:type" content="website">';

        if (! empty($project->published_description)) {
            $description = htmlspecialchars($project->published_description, ENT_QUOTES, 'UTF-8');
            $tags[] = sprintf('<meta property="og:description" content="%s">', $description);
        }

        if ($project->share_image) {
            $imageUrl = asset('storage/'.$project->share_image);
            $tags[] = sprintf(
                '<meta property="og:image" content="%s">',
                htmlspecialchars($imageUrl, ENT_QUOTES, 'UTF-8')
            );
        }

        if ($project->isPublished()) {
            $tags[] = sprintf(
                '<meta property="og:url" content="%s">',
                htmlspecialchars($project->getPublishedUrl(), ENT_QUOTES, 'UTF-8')
            );
        }

        // Twitter Card
        $tags[] = '<meta name="twitter:card" content="summary_large_image">';
        $tags[] = sprintf('<meta name="twitter:title" content="%s">', $title);

        if (! empty($project->published_description)) {
            $description = htmlspecialchars($project->published_description, ENT_QUOTES, 'UTF-8');
            $tags[] = sprintf('<meta name="twitter:description" content="%s">', $description);
        }

        if ($project->share_image) {
            $imageUrl = asset('storage/'.$project->share_image);
            $tags[] = sprintf(
                '<meta name="twitter:image" content="%s">',
                htmlspecialchars($imageUrl, ENT_QUOTES, 'UTF-8')
            );
        }

        return implode("\n    ", $tags);
    }

    /**
     * Inject meta tags and __APP_CONFIG__ into the built index.html.
     * This provides SEO meta tags and runtime configuration for the storage API, etc.
     */
    protected function injectAppConfig(Project $project, string $previewDir): void
    {
        $indexPath = Storage::disk('local')->path("{$previewDir}/index.html");

        if (! file_exists($indexPath)) {
            Log::warning('Cannot inject app config: index.html not found', [
                'project_id' => $project->id,
                'path' => $indexPath,
            ]);

            return;
        }

        $html = @file_get_contents($indexPath);
        if ($html === false) {
            Log::error('Failed to read index.html for config injection', [
                'project_id' => $project->id,
                'path' => $indexPath,
            ]);

            return;
        }

        // 1. Replace title tag
        $title = htmlspecialchars(
            $project->published_title ?? $project->name ?? 'Webby Project',
            ENT_QUOTES,
            'UTF-8'
        );
        $html = preg_replace('/<title>.*?<\/title>/i', "<title>{$title}</title>", $html);

        // 2. Build meta tags
        $metaTags = $this->buildMetaTags($project);

        // 3. Build app config script
        $config = [
            'apiUrl' => config('app.url'),
            'projectId' => $project->id,
            'apiToken' => $project->api_token,
        ];

        // Inject CLIENT-SAFE Supabase config so generated apps can reach their
        // backend at runtime. ONLY url + publishable key + schema — NEVER the
        // secret key or DB connection (those stay server-side).
        $plan = $project->user?->getCurrentPlan();
        $supabase = app(SupabaseService::class);
        if (($plan?->databaseEnabled() ?? false) && $supabase->hasConnection($project)) {
            $sb = $supabase->resolveForProject($project);
            $config['supabase'] = [
                'url' => $sb['url'],
                'publishableKey' => $sb['publishable_key'],
                'schema' => $sb['schema'],
            ];
        }

        // JSON_HEX_TAG (+ AMP/APOS/QUOT) hex-escape <, >, &, ', " so a user-controlled
        // BYOD value (e.g. a Supabase url/key containing "</script>") can never break
        // out of this inline <script> block. The browser unescapes < transparently,
        // so config consumers read identical values.
        $script = sprintf(
            '<script>window.__APP_CONFIG__ = %s;</script>',
            json_encode($config, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT)
        );

        // 4. Inject meta tags + script before </head>
        $injection = $metaTags."\n    ".$script;
        $html = str_replace('</head>', $injection."\n</head>", $html);

        // Note: Inspector script is now injected on-the-fly by PreviewController
        // to keep stored files clean for /app and subdomain routes

        if (file_put_contents($indexPath, $html) === false) {
            Log::error('Failed to write config-injected index.html', [
                'project_id' => $project->id,
                'path' => $indexPath,
            ]);
        }
    }

    /**
     * List all workspace IDs on a builder.
     *
     * @return string[]
     */
    public function listWorkspaces(Builder $builder): array
    {
        $response = Http::timeout(30)
            ->withHeaders(['X-Server-Key' => $builder->server_key])
            ->get("{$builder->full_url}/api/workspaces");

        if (! $response->successful()) {
            throw new \Exception("Failed to list workspaces on builder {$builder->name}: ".$response->body());
        }

        return $response->json('workspace_ids') ?? [];
    }

    /**
     * Request bulk deletion of workspaces from a builder.
     *
     * @param  string[]  $workspaceIds
     * @return array{deleted: int, not_found: int, skipped: int, failed: int, results: array}
     */
    public function cleanupWorkspaces(Builder $builder, array $workspaceIds): array
    {
        $response = Http::timeout(120)
            ->withHeaders(['X-Server-Key' => $builder->server_key])
            ->post("{$builder->full_url}/api/cleanup-workspaces", [
                'workspace_ids' => $workspaceIds,
            ]);

        if (! $response->successful()) {
            throw new \Exception("Failed to cleanup workspaces on builder {$builder->name}: ".$response->body());
        }

        return $response->json();
    }

    /**
     * Re-apply a project's design system to an existing workspace via the Go
     * builder. The builder overlays the system's tokens + chosen accent onto
     * src/index.css and injects the system fonts — the same deterministic
     * overlay run at build time, but against the live workspace so a re-theme
     * from project settings takes effect immediately on the next rebuild.
     */
    public function applyDesignToWorkspace(Builder $builder, Project $project): bool
    {
        $payload = app(DesignSystemService::class)->buildPayload($project);
        if ($payload === null) {
            return false;
        }

        try {
            $response = Http::timeout(60)
                ->withHeaders(['X-Server-Key' => $builder->server_key])
                ->put("{$builder->full_url}/api/design-workspace/{$project->id}", [
                    'slug' => $payload['slug'],
                    'tokens' => $payload['tokens'],
                    'fonts' => $payload['fonts'],
                    'accent' => $payload['accent'],
                    'accent_light' => $payload['accent_light'],
                    'accent_dark' => $payload['accent_dark'],
                    // Forward component overrides too, so re-theming to a "deep"
                    // system that ships components/ actually writes them.
                    'components' => $payload['components'],
                ]);

            return $response->successful();
        } catch (\Exception $e) {
            Log::error('Failed to apply design system to workspace', [
                'project_id' => $project->id,
                'design_system' => $payload['slug'] ?? null,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Undo the last revision in the workspace.
     *
     * 400 ("nothing to undo") and 409 (a session is actively writing) are
     * expected outcomes the builder reports as JSON — pass them through so
     * the UI can show the message instead of a generic failure.
     */
    public function undoWorkspace(Builder $builder, string $workspaceId): array
    {
        $response = Http::timeout(30)
            ->withHeaders(['X-Server-Key' => $builder->server_key])
            ->post("{$builder->full_url}/api/undo-workspace/{$workspaceId}");

        if (in_array($response->status(), [400, 409], true)) {
            return $response->json();
        }

        if (! $response->successful()) {
            throw new \Exception('Undo failed: '.$response->body());
        }

        return $response->json();
    }

    /**
     * Redo the next revision in the workspace.
     */
    public function redoWorkspace(Builder $builder, string $workspaceId): array
    {
        $response = Http::timeout(30)
            ->withHeaders(['X-Server-Key' => $builder->server_key])
            ->post("{$builder->full_url}/api/redo-workspace/{$workspaceId}");

        if (in_array($response->status(), [400, 409], true)) {
            return $response->json();
        }

        if (! $response->successful()) {
            throw new \Exception('Redo failed: '.$response->body());
        }

        return $response->json();
    }

    /**
     * Restore the workspace to a specific revision (the Revision History
     * panel's "Restore" action). The builder checkpoints live changes first,
     * so the jump is always reversible.
     */
    public function restoreWorkspace(Builder $builder, string $workspaceId, int $revisionId): array
    {
        $response = Http::timeout(30)
            ->withHeaders(['X-Server-Key' => $builder->server_key])
            ->post("{$builder->full_url}/api/restore-workspace/{$workspaceId}", [
                'revision_id' => $revisionId,
            ]);

        if (in_array($response->status(), [400, 409], true)) {
            return $response->json();
        }

        if (! $response->successful()) {
            throw new \Exception('Restore failed: '.$response->body());
        }

        return $response->json();
    }

    /**
     * Attempt to recover a workspace from a crashed/failed state.
     */
    public function recoverWorkspace(Builder $builder, string $workspaceId, ?string $outputType = null): array
    {
        // The output type tells the builder how to recover: npm rebuild for
        // websites, structural theme validation for wordpress_theme (which
        // has no package.json and would otherwise dead-end).
        $url = "{$builder->full_url}/api/recover-workspace/{$workspaceId}";
        if ($outputType !== null && $outputType !== '') {
            $url .= '?output_type='.urlencode($outputType);
        }

        $response = Http::timeout(180)
            ->withHeaders(['X-Server-Key' => $builder->server_key])
            ->post($url);

        if (! $response->successful()) {
            throw new \Exception('Recovery failed: '.$response->body());
        }

        return $response->json();
    }

    public function classEditWorkspace(Builder $builder, string $workspaceId, string $path, string $oldClassName, string $newClassName, string $textAnchor = ''): array
    {
        $response = Http::timeout(30)
            ->withHeaders(['X-Server-Key' => $builder->server_key])
            ->patch("{$builder->full_url}/api/class-edit-workspace/{$workspaceId}", [
                // Empty path => the builder locates the element by its full
                // className + text anchor (the visual editor can't know the
                // source file of a production-built element).
                'path' => $path,
                'old_class_name' => $oldClassName,
                'new_class_name' => $newClassName,
                'text_anchor' => $textAnchor,
            ]);

        if (! $response->successful()) {
            throw new \Exception('Class edit failed: '.$response->body());
        }

        return $response->json();
    }

    /**
     * Fetch a page of revisions from the builder. Pass `limit` and `before`
     * to paginate — omit both for the newest window.
     *
     * @param  array<string,int|string>  $query  { limit?: int, before?: int }
     * @return array<string,mixed>
     */
    public function getRevisions(Builder $builder, string $workspaceId, array $query = []): array
    {
        $response = Http::timeout(10)
            ->withHeaders(['X-Server-Key' => $builder->server_key])
            ->get("{$builder->full_url}/api/revisions-workspace/{$workspaceId}", $query);

        if (! $response->successful()) {
            throw new \Exception('Failed to get revisions: '.$response->body());
        }

        return $response->json();
    }
}
