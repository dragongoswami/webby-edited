<?php

namespace App\Jobs;

use App\Models\Project;
use App\Services\BuilderService;
use App\Services\NotificationService;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

class RecoverWorkspaceBuild implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 2;

    public int $backoff = 30;

    public int $uniqueFor = 120;

    public function uniqueId(): string
    {
        return 'recover-workspace:'.$this->project->id;
    }

    public function __construct(
        public Project $project,
        public string $errorMessage,
    ) {}

    public function handle(BuilderService $builderService, NotificationService $notificationService): void
    {
        $builder = $this->project->builder;
        if (! $builder) {
            Log::warning('RecoverWorkspaceBuild: No builder for project', [
                'project_id' => $this->project->id,
            ]);

            return;
        }

        $result = $builderService->recoverWorkspace($builder, $this->project->id, $this->project->output_target);

        if ($result['success'] ?? false) {
            $this->project->update([
                'build_status' => 'idle',
            ]);

            Log::info('Workspace recovery successful', [
                'project_id' => $this->project->id,
            ]);

            $notificationService->notify(
                $this->project->user,
                'build_recovered',
                'Build Recovered',
                'Your build session was recovered after a failure. You can continue building.'
            );

            return;
        }

        // Throw so queue system retries, and eventually calls failed()
        throw new \RuntimeException(
            'Workspace recovery returned failure: '.($result['error'] ?? 'unknown')
        );
    }

    public function failed(?\Throwable $exception): void
    {
        Log::error('Workspace recovery permanently failed after all retries', [
            'project_id' => $this->project->id,
            'error' => $exception?->getMessage(),
        ]);

        $this->project->update([
            'build_status' => 'failed',
            'build_completed_at' => now(),
        ]);

        if ($this->project->user) {
            app(NotificationService::class)->notify(
                $this->project->user,
                'build_failed',
                'Build Recovery Failed',
                'Your build could not be recovered after multiple attempts. Please try again.'
            );
        }
    }
}
