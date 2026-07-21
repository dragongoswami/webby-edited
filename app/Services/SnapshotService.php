<?php

namespace App\Services;

use App\Models\Project;
use App\Models\ProjectSnapshot;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use League\Flysystem\UnableToListContents;

class SnapshotService
{
    public function createSnapshot(Project $project, string $label = 'Pre-publish snapshot'): ?ProjectSnapshot
    {
        $previewPath = "previews/{$project->id}";
        $disk = Storage::disk('local');

        if (! $disk->exists($previewPath)) {
            return null;
        }

        // A random suffix keeps two snapshots created within the same second
        // from sharing a directory (which would make deleting/pruning one wipe
        // the other's files). created_at still drives ordering for pruning.
        $timestamp = now()->timestamp;
        $snapshotPath = "snapshots/{$project->id}/{$timestamp}-".Str::random(6);

        try {
            $this->copyDirectory($disk, $previewPath, $snapshotPath);
        } catch (UnableToListContents $e) {
            Log::error('SnapshotService: unable to list preview directory', [
                'project_id' => $project->id,
                'source' => $previewPath,
                'error' => $e->getMessage(),
            ]);
            if ($disk->exists($snapshotPath)) {
                $disk->deleteDirectory($snapshotPath);
            }

            return null;
        }

        $stats = $this->calculateDirectoryStats($disk, $snapshotPath);

        $snapshot = ProjectSnapshot::create([
            'project_id' => $project->id,
            'label' => $label,
            'file_count' => $stats['file_count'],
            'size_bytes' => $stats['size_bytes'],
            'snapshot_path' => $snapshotPath,
        ]);

        $this->pruneSnapshots($project);

        return $snapshot;
    }

    public function rollbackSnapshot(ProjectSnapshot $snapshot): void
    {
        $disk = Storage::disk('local');
        $projectId = $snapshot->project_id;

        // Verify snapshot exists on disk before destructive operation
        if (! $disk->exists($snapshot->snapshot_path)) {
            throw new \RuntimeException('Snapshot files not found on disk.');
        }

        $previewPath = "previews/{$projectId}";
        $publishedPath = "published/{$projectId}";

        // Clear current preview
        if ($disk->exists($previewPath)) {
            $disk->deleteDirectory($previewPath);
        }

        // Copy snapshot back to preview
        $this->copyDirectory($disk, $snapshot->snapshot_path, $previewPath);

        // Clear published cache so it regenerates from restored preview
        if ($disk->exists($publishedPath)) {
            $disk->deleteDirectory($publishedPath);
        }
    }

    public function pruneSnapshots(Project $project, int $maxSnapshots = 5): void
    {
        $snapshots = $project->snapshots()
            ->orderBy('created_at', 'desc')
            ->get();

        if ($snapshots->count() <= $maxSnapshots) {
            return;
        }

        $toDelete = $snapshots->slice($maxSnapshots);
        $disk = Storage::disk('local');

        foreach ($toDelete as $snapshot) {
            if ($disk->exists($snapshot->snapshot_path)) {
                $disk->deleteDirectory($snapshot->snapshot_path);
            }
            $snapshot->delete();
        }
    }

    public function deleteSnapshot(ProjectSnapshot $snapshot): void
    {
        $disk = Storage::disk('local');

        if ($disk->exists($snapshot->snapshot_path)) {
            $disk->deleteDirectory($snapshot->snapshot_path);
        }

        $snapshot->delete();
    }

    protected function calculateDirectoryStats($disk, string $path): array
    {
        try {
            $files = $disk->allFiles($path);
        } catch (UnableToListContents $e) {
            return ['file_count' => 0, 'size_bytes' => 0];
        }
        $fileCount = 0;
        $sizeBytes = 0;

        foreach ($files as $file) {
            $basename = basename($file);
            // Skip node_modules and .git
            if (str_contains($file, 'node_modules/') || str_contains($file, '.git/')) {
                continue;
            }
            if ($basename === '.gitkeep') {
                continue;
            }

            $fileCount++;
            $sizeBytes += $disk->size($file);
        }

        return [
            'file_count' => $fileCount,
            'size_bytes' => $sizeBytes,
        ];
    }

    protected function copyDirectory($disk, string $source, string $destination): void
    {
        $files = $disk->allFiles($source);

        foreach ($files as $file) {
            // Skip node_modules and .git
            if (str_contains($file, 'node_modules/') || str_contains($file, '.git/')) {
                continue;
            }

            $relativePath = substr($file, strlen($source) + 1);
            $destFile = $destination.'/'.$relativePath;

            // Read and write via Storage to handle nested directories
            $content = $disk->get($file);
            $disk->put($destFile, $content);
        }
    }
}
