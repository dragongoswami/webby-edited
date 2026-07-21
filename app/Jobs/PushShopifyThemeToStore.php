<?php

namespace App\Jobs;

use App\Models\Project;
use App\Models\UserNotification;
use App\Services\NotificationService;
use App\Services\ShopifyService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

class PushShopifyThemeToStore implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** No retries — a failed push must not create a second orphaned theme. */
    public int $tries = 1;

    public function __construct(public readonly string $projectId) {}

    /** One job per project in the queue at a time — prevents concurrent-build races. */
    public function uniqueId(): string
    {
        return $this->projectId;
    }

    public function handle(ShopifyService $shopify): void
    {
        $project = Project::with('shopifyConnection')->find($this->projectId);
        if (! $project || ! $project->isShopifyTheme()) {
            return;
        }

        $conn = $project->shopifyConnection;
        if (! $conn || $conn->status !== 'active') {
            return;
        }

        $rel = "previews/{$project->id}/__shopify_theme.zip";
        if (! Storage::disk('local')->exists($rel)) {
            Log::warning('Shopify push skipped: theme zip missing', ['project_id' => $project->id]);

            return;
        }

        // Short-lived signed public URL Shopify's servers can fetch (no auth session needed).
        $sourceUrl = URL::temporarySignedRoute(
            'preview.shopify-theme-signed',
            now()->addMinutes(15),
            ['project' => $project->id]
        );

        try {
            $previous = $project->shopify_theme_id;
            $newGid = $shopify->themeCreate($conn, mb_substr($project->name, 0, 50), $sourceUrl);

            $project->update([
                'shopify_theme_id' => $newGid,
                'shopify_store_domain' => $conn->shop_domain,
            ]);
            $conn->update(['last_used_at' => now()]);

            // Best-effort: delete the previous theme from the store.
            if ($previous && $previous !== $newGid) {
                try {
                    $shopify->themeDelete($conn, $previous);
                } catch (\Throwable $e) {
                    Log::info('Previous Shopify theme delete failed (non-fatal)', [
                        'project_id' => $project->id,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            app(NotificationService::class)->notify(
                $project->user,
                UserNotification::TYPE_BUILD_COMPLETE,
                __('Theme pushed to Shopify'),
                __('Your theme was sent to :shop as an unpublished theme. It may take a few moments to appear — open the preview link from the editor.', ['shop' => $conn->shop_domain]),
                ['project_id' => $project->id, 'project_name' => $project->name],
                "/project/{$project->id}"
            );
        } catch (\Throwable $e) {
            Log::error('Shopify theme push failed', [
                'project_id' => $project->id,
                'error' => $e->getMessage(),
            ]);

            app(NotificationService::class)->notify(
                $project->user,
                UserNotification::TYPE_BUILD_FAILED,
                __('Shopify push failed'),
                __('We could not push your theme to Shopify. You can still download the theme zip from the editor.'),
                ['project_id' => $project->id, 'project_name' => $project->name],
                "/project/{$project->id}"
            );
        }
    }
}
