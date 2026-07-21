<?php

namespace App\Observers;

use App\Models\Project;
use App\Services\ProjectFileService;
use App\Services\SupabaseService;
use Illuminate\Support\Facades\Log;
use Throwable;

class ProjectObserver
{
    /**
     * Handle the Project "deleting" event.
     *
     * Clear publishing fields (subdomain, custom_domain) so their DB unique
     * constraints are released for re-use. BYOD: we never drop the project's
     * Supabase schema — it lives in the user's own database and is theirs.
     */
    public function deleting(Project $project): void
    {
        $fields = [];

        if ($project->subdomain !== null) {
            $fields['subdomain'] = null;
            $fields['published_at'] = null;
        }

        if ($project->custom_domain !== null) {
            $fields['custom_domain'] = null;
            $fields['custom_domain_verified'] = false;
            $fields['custom_domain_ssl_status'] = null;
            $fields['custom_domain_verified_at'] = null;
        }

        if (! empty($fields)) {
            $project->forceFill($fields)->saveQuietly();
        }
    }

    /**
     * Handle the Project "forceDeleted" event.
     *
     * The FK cascade removes project_files rows, but the on-disk files must be
     * reclaimed here or they leak. (Mass force-deletes bypass model events, so
     * the trash-purge and account-deletion commands also clean up explicitly.)
     */
    public function forceDeleted(Project $project): void
    {
        try {
            ProjectFileService::deleteProjectDirectory($project->id);
        } catch (Throwable $e) {
            Log::warning('ProjectObserver: failed to delete project files directory', [
                'project_id' => $project->id, 'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Handle the Project "created" event.
     *
     * Auto-generate API token for storage access on project creation.
     */
    public function created(Project $project): void
    {
        // Auto-generate API token for storage access if not already set
        if (! $project->api_token) {
            $token = bin2hex(random_bytes(32));
            $project->api_token = $token;
            $project->saveQuietly(); // Use saveQuietly to avoid triggering observers again

            Log::debug('ProjectObserver: Generated API token for project', [
                'project_id' => $project->id,
                'has_token' => ! empty($project->api_token),
            ]);
        }

        // BYOD: if the owner's plan allows databases and the project has a
        // linked Supabase connection, create this project's schema in the
        // user's own database. Guarded so backend outages never block creation.
        try {
            $plan = $project->user?->getCurrentPlan();
            if ($plan?->databaseEnabled() && $project->supabase_connection_id) {
                app(SupabaseService::class)->ensureProjectSchema($project);
            }
        } catch (Throwable $e) {
            Log::warning('ProjectObserver: ensureProjectSchema failed', [
                'project_id' => $project->id, 'error' => $e->getMessage(),
            ]);
        }
    }
}
