<?php

namespace App\Services;

use App\Models\Plugin;
use App\Models\Project;
use App\Models\ProjectFile;
use App\Services\Storage\BucketStorageManager;
use App\Support\DangerousFileTypes;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProjectFileService
{
    /**
     * Upload a file for a project.
     */
    public function upload(Project $project, UploadedFile $file, string $source = 'dashboard'): ProjectFile
    {
        $user = $project->user;
        $plan = $user?->getCurrentPlan();

        if (! $plan || ! $plan->fileStorageEnabled()) {
            throw new \Exception('File storage is not enabled for your plan.');
        }

        $canUpload = $this->canUpload($project, $file->getSize(), $file->getMimeType(), $file->getClientOriginalName());

        if (! $canUpload['allowed']) {
            throw new \Exception(implode(' ', $canUpload['errors']));
        }

        // Generate a unique filename with a server-derived extension. The stored
        // extension is taken from the detected MIME type (finfo), never from the
        // attacker-controlled client name, so a "shell.php" cannot land as *.php.
        $extension = $file->guessExtension() ?: 'bin';
        $filename = Str::uuid().'.'.$extension;

        // Pick the destination disk: the active storage-provider's bucket, or 'local'.
        $disk = app(BucketStorageManager::class)->uploadDisk();

        // Checksum from the uploaded temp file — disk-agnostic, no extra round-trip.
        $checksum = hash_file('sha256', $file->getRealPath());

        // Store the file on the resolved disk.
        $storagePath = "project-files/{$project->id}";
        $file->storeAs($storagePath, $filename, $disk);

        // Create the file record
        $projectFile = ProjectFile::create([
            'project_id' => $project->id,
            'filename' => $filename,
            'original_filename' => $this->sanitizeOriginalName($file->getClientOriginalName()),
            'path' => "{$storagePath}/{$filename}",
            'disk' => $disk,
            'mime_type' => $file->getMimeType(),
            'size' => $file->getSize(),
            'source' => $source,
            'checksum' => $checksum,
        ]);

        // Update project storage used (atomic SQL increment)
        $project->incrementStorageUsed($file->getSize());

        // Close the check->store->increment TOCTOU window: if concurrent uploads
        // pushed the owner past their plan's total quota, roll this one back so
        // the quota can never be exceeded by racing requests. (Conservative: if
        // two uploads race past the cap, both roll back rather than risk an
        // overage — one user can simply retry.)
        if (! $plan->hasUnlimitedStorage()) {
            $maxBytes = (int) $plan->getMaxStorageMb() * 1024 * 1024;
            if ($user->getTotalStorageUsedBytes() > $maxBytes) {
                $this->delete($projectFile);
                throw new \Exception('Not enough storage space. Please upgrade your plan or delete some files.');
            }
        }

        return $projectFile;
    }

    /**
     * Delete a file.
     */
    public function delete(ProjectFile $file): bool
    {
        $project = $file->project;
        $size = $file->size;

        // Delete from storage
        $file->deleteFromDisk();

        // Delete the record
        $file->delete();

        // Update project storage used
        $project->decrementStorageUsed($size);

        return true;
    }

    /**
     * Permanently remove a project's entire on-disk file directory.
     *
     * Used when a project is force-deleted (trash purge / account deletion):
     * the DB rows go via FK cascade, but the disk files must be reclaimed here
     * or they leak forever. Idempotent and safe if the directory is absent.
     */
    public static function deleteProjectDirectory(string $projectId): void
    {
        $manager = app(BucketStorageManager::class);

        // Always clear local (legacy / pre-provider files live here).
        Storage::disk('local')->deleteDirectory("project-files/{$projectId}");

        // Reclaim the project's build artifacts immediately too: the preview
        // directory (website files or the WordPress __wp_theme.zip), the
        // published cache, and preview snapshots. The scheduled
        // builder:clean-workspaces orphan sweep would catch these eventually —
        // deleting here just avoids the dead-weight window until the next run.
        Storage::disk('local')->deleteDirectory("previews/{$projectId}");
        Storage::disk('local')->deleteDirectory("published/{$projectId}");
        Storage::disk('local')->deleteDirectory("snapshots/{$projectId}");

        // Clear the project prefix on EVERY installed storage provider's bucket.
        // The project_files rows cascade away (DB-level onDelete cascade) before the
        // force-delete observer fires, so we can't read each file's disk here — and
        // a project may have files on a provider that's since been switched away from.
        // Deleting the project-scoped prefix on all providers is bounded (a few) and a
        // safe no-op where absent, so nothing is orphaned after a provider switch.
        foreach (Plugin::where('type', 'storage_provider')->get() as $provider) {
            try {
                $manager->disk($provider->slug)->deleteDirectory("project-files/{$projectId}");
            } catch (\Throwable $e) {
                Log::warning(
                    "Could not clear project-files/{$projectId} on disk {$provider->slug}: ".$e->getMessage()
                );
            }
        }
    }

    /**
     * Get files for a project.
     */
    public function getFiles(Project $project, ?string $path = null): Collection
    {
        $query = $project->files();

        if ($path !== null) {
            $query->where('path', 'like', $path.'%');
        }

        return $query->orderBy('created_at', 'desc')->get();
    }

    /**
     * Check if a file can be uploaded.
     *
     * @return array{allowed: bool, errors: array<string>}
     */
    public function canUpload(Project $project, int $size, string $mimeType, ?string $originalName = null): array
    {
        $errors = [];
        $user = $project->user;
        $plan = $user?->getCurrentPlan();

        if (! $plan || ! $plan->fileStorageEnabled()) {
            return [
                'allowed' => false,
                'errors' => ['File storage is not enabled for your plan.'],
            ];
        }

        // Always reject dangerous/active-content types, regardless of the plan's
        // allowlist (which may be null = "allow all"). This is a hard security floor.
        if ($this->isBlockedType($mimeType, $originalName)) {
            $errors[] = 'This file type is not allowed for security reasons.';
        }

        // Check storage limit
        if (! $plan->hasUnlimitedStorage()) {
            $remainingBytes = $user->getRemainingStorageBytes();
            if ($size > $remainingBytes) {
                $errors[] = 'Not enough storage space. Please upgrade your plan or delete some files.';
            }
        }

        // Check file size limit
        $maxFileSizeBytes = $plan->getMaxFileSizeMb() * 1024 * 1024;
        if ($size > $maxFileSizeBytes) {
            $errors[] = "File size exceeds the maximum allowed ({$plan->getMaxFileSizeMb()} MB).";
        }

        // Check file type against the plan allowlist (when configured)
        $allowedTypes = $plan->getAllowedFileTypes();
        if ($allowedTypes !== null && ! $this->isFileTypeAllowed($mimeType, $allowedTypes)) {
            $errors[] = 'This file type is not allowed for your plan.';
        }

        return [
            'allowed' => empty($errors),
            'errors' => $errors,
        ];
    }

    /**
     * Whether an upload is a dangerous/active-content type that must never be
     * accepted, checked by both detected MIME type and the client extension.
     */
    protected function isBlockedType(string $mimeType, ?string $originalName): bool
    {
        return DangerousFileTypes::isBlocked($mimeType, $originalName);
    }

    /**
     * Sanitize a user-supplied filename before persisting it (strip path
     * components and control characters, cap length). Mirrors TicketAttachmentService.
     */
    protected function sanitizeOriginalName(string $name): string
    {
        $name = basename($name);
        $name = preg_replace('/[\x00-\x1f\x7f]/u', '', $name) ?? '';
        $name = trim($name);

        return $name === '' ? 'file' : mb_substr($name, 0, 255);
    }

    /**
     * Calculate total storage used for a project.
     */
    public function calculateStorageUsed(Project $project): int
    {
        return (int) $project->files()->sum('size');
    }

    /**
     * Recalculate and sync storage used for a project.
     */
    public function syncStorageUsed(Project $project): int
    {
        $actualUsed = $this->calculateStorageUsed($project);
        $project->update(['storage_used_bytes' => $actualUsed]);

        return $actualUsed;
    }

    /**
     * Check if a MIME type matches the allowed types.
     */
    protected function isFileTypeAllowed(string $mimeType, array $allowedTypes): bool
    {
        foreach ($allowedTypes as $allowedType) {
            // "*/*" means allow any type (the DangerousFileTypes blocklist still
            // applies unconditionally, so this can't admit executable/dangerous
            // uploads). Mirrors the frontend allow-all handling in
            // useChatFileUpload.ts / FileUploadZone.tsx.
            if ($allowedType === '*/*') {
                return true;
            }

            // Handle wildcards like "image/*"
            if (str_ends_with($allowedType, '/*')) {
                $typePrefix = str_replace('/*', '/', $allowedType);
                if (str_starts_with($mimeType, $typePrefix)) {
                    return true;
                }
            } elseif ($mimeType === $allowedType) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get the contents of a file.
     */
    public function getFileContents(ProjectFile $file): ?string
    {
        if (! $file->existsOnDisk()) {
            return null;
        }

        return app(BucketStorageManager::class)
            ->disk($file->disk ?: 'local')
            ->get($file->getStoragePath());
    }

    /**
     * Get a streaming response for a file.
     */
    public function streamFile(ProjectFile $file): StreamedResponse|BinaryFileResponse|null
    {
        if (! $file->existsOnDisk()) {
            return null;
        }

        return app(BucketStorageManager::class)
            ->disk($file->disk ?: 'local')
            ->download(
                $file->getStoragePath(),
                $file->original_filename,
                ['Content-Type' => $file->mime_type]
            );
    }
}
