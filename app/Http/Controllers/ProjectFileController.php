<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Models\ProjectFile;
use App\Services\ProjectFileService;
use App\Services\Storage\BucketStorageManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProjectFileController extends Controller
{
    public function __construct(
        protected ProjectFileService $fileService
    ) {}

    /**
     * List files for a project with pagination.
     */
    public function index(Project $project, Request $request): JsonResponse
    {
        Gate::authorize('view', $project);

        $perPage = min((int) $request->get('per_page', 24), 100);
        $page = (int) $request->get('page', 1);

        $paginator = $project->files()
            ->orderBy('created_at', 'desc')
            ->paginate($perPage, ['*'], 'page', $page);

        $files = collect($paginator->items())->map(fn ($file) => [
            'id' => $file->id,
            'filename' => $file->filename,
            'original_filename' => $file->original_filename,
            'mime_type' => $file->mime_type,
            'size' => $file->size,
            'human_size' => $file->getHumanReadableSize(),
            'is_image' => $file->isImage(),
            'is_pdf' => $file->isPdf(),
            'is_video' => $file->isVideo(),
            'is_audio' => $file->isAudio(),
            'source' => $file->source,
            'url' => $file->getUrl(),
            'preview_url' => $file->isImage() ? $file->getUrl() : null,
            'created_at' => $file->created_at->toISOString(),
        ]);

        return response()->json([
            'files' => $files,
            // Per-project bytes here (informational); the quota bar is driven by the
            // global total returned from store()/destroy(), not this field.
            'storage_used' => $project->storage_used_bytes,
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'has_more' => $paginator->hasMorePages(),
            ],
        ]);
    }

    /**
     * Upload a file to a project.
     */
    public function store(Project $project, Request $request): JsonResponse
    {
        Gate::authorize('update', $project);

        $user = $request->user();
        $plan = $user->getCurrentPlan();

        if (! $plan || ! $plan->fileStorageEnabled()) {
            return response()->json([
                'error' => __('File storage is not enabled for your plan.'),
            ], 403);
        }

        // Allowed MIME types - match frontend exactly
        $allowedMimes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain', 'text/markdown',
            'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
        ];

        $maxFileSizeKb = $plan->getMaxFileSizeMb() * 1024;

        $request->validate([
            'file' => [
                'required',
                'file',
                'max:'.$maxFileSizeKb,
            ],
        ]);

        $file = $request->file('file');
        $mimeType = $file->getMimeType();

        // Validate MIME type
        if (! in_array($mimeType, $allowedMimes)) {
            return response()->json([
                'error' => 'File type not allowed. Allowed: Images (JPG, PNG, GIF, WebP, SVG), Documents (PDF, DOC, TXT, MD), Videos (MP4, WebM, MOV)',
            ], 422);
        }

        // Check file size based on type
        $sizeBytes = $file->getSize();
        $maxSizes = [
            'image/' => 5 * 1024 * 1024, // 5MB for images
            'text/' => 1 * 1024 * 1024, // 1MB for text files
            'application/pdf' => 1 * 1024 * 1024,
            'application/msword' => 1 * 1024 * 1024,
            'application/vnd.openxmlformats-officedocument' => 1 * 1024 * 1024,
            'video/' => 50 * 1024 * 1024, // 50MB for videos
        ];

        $maxSize = null;
        foreach ($maxSizes as $prefix => $size) {
            if (strpos($mimeType, $prefix) === 0) {
                $maxSize = $size;
                break;
            }
        }

        if ($maxSize && $sizeBytes > $maxSize) {
            $maxMb = $maxSize / (1024 * 1024);
            return response()->json([
                'error' => "File too large. Maximum size: {$maxMb}MB",
            ], 422);
        }

        // Check if can upload
        $canUpload = $this->fileService->canUpload($project, $file->getSize(), $file->getMimeType(), $file->getClientOriginalName());

        if (! $canUpload['allowed']) {
            return response()->json([
                'error' => implode(' ', $canUpload['errors']),
            ], 422);
        }

try {
            $projectFile = $this->fileService->upload($project, $file, 'dashboard');

            return response()->json([
                'file' => [
                    'id' => $projectFile->id,
                    'filename' => $projectFile->filename,
                    'original_filename' => $projectFile->original_filename,
                    'mime_type' => $projectFile->mime_type,
                    'size' => $projectFile->size,
                    'human_size' => $projectFile->getHumanReadableSize(),
                    'is_image' => $projectFile->isImage(),
                    'url' => $projectFile->getUrl(),
                    'preview_url' => $projectFile->isImage() ? $projectFile->getUrl() : null,
                    'created_at' => $projectFile->created_at->toISOString(),
                ],
                // The user's global total (across all their projects) — this is
                // what the storage quota bar reflects, not the per-project count.
                'storage_used' => $project->user->getTotalStorageUsedBytes(),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Serve a file for download/viewing.
     */
    public function show(Request $request, Project $project, ProjectFile $file): RedirectResponse|StreamedResponse|BinaryFileResponse|JsonResponse
    {
        // Check file belongs to project
        if ($file->project_id !== $project->id) {
            abort(404);
        }

        // Check authorization via signed URL or user authorization
        if (! $request->hasValidSignature()) {
            Gate::authorize('view', $project);
        }

        // Offload to the bucket via a presigned URL when the provider supports it.
        if ($url = app(BucketStorageManager::class)->temporaryUrl($file, now()->addHour())) {
            // no-store so a cached 302 can't outlive the presigned URL's short TTL.
            return redirect()->away($url)->header('Cache-Control', 'no-store, private');
        }

        $response = $this->fileService->streamFile($file);

        if (! $response) {
            return response()->json(['error' => __('File not found')], 404);
        }

        return $response;
    }

    /**
     * Serve a project file publicly by UUID filename.
     * No auth required — filenames are UUIDs (unguessable).
     * Used by AI-generated code to embed project files in HTML.
     */
    public function publicServe(string $projectId, string $filename): RedirectResponse|StreamedResponse|BinaryFileResponse|JsonResponse
    {
        $file = ProjectFile::where('project_id', $projectId)
            ->where('filename', $filename)
            ->first();

        if (! $file) {
            return response()->json(['error' => __('File not found')], 404);
        }

        // Offload to the bucket via a presigned URL when the provider supports it.
        if ($url = app(BucketStorageManager::class)->temporaryUrl($file, now()->addHour())) {
            // no-store so a cached 302 can't outlive the presigned URL's short TTL.
            return redirect()->away($url)->header('Cache-Control', 'no-store, private');
        }

        $response = $this->fileService->streamFile($file);

        if (! $response) {
            return response()->json(['error' => __('File not found on disk')], 404);
        }

        return $response;
    }

    /**
     * Delete a file.
     */
    public function destroy(Project $project, ProjectFile $file): JsonResponse
    {
        Gate::authorize('update', $project);

        // Check file belongs to project
        if ($file->project_id !== $project->id) {
            abort(404);
        }

        $this->fileService->delete($file);

        return response()->json([
            'message' => __('File deleted successfully'),
            // The user's global total (across all their projects), matching the
            // quota bar — see store().
            'storage_used' => $project->user->getTotalStorageUsedBytes(),
        ]);
    }

    // ========================================
    // Generated App API Endpoints
    // ========================================

    /**
     * Upload a file from a generated app.
     */
    public function appUpload(string $projectId, Request $request): JsonResponse
    {
        $project = Project::findOrFail($projectId);

        $user = $project->user;
        $plan = $user?->getCurrentPlan();

        if (! $plan || ! $plan->fileStorageEnabled()) {
            return response()->json([
                'error' => __('File storage is not enabled for this project.'),
            ], 403);
        }

        $request->validate([
            'file' => ['required', 'file', 'max:'.($plan->getMaxFileSizeMb() * 1024)],
        ]);

        $file = $request->file('file');

        // Check if can upload
        $canUpload = $this->fileService->canUpload($project, $file->getSize(), $file->getMimeType(), $file->getClientOriginalName());

        if (! $canUpload['allowed']) {
            return response()->json([
                'error' => implode(' ', $canUpload['errors']),
            ], 422);
        }

        try {
            $projectFile = $this->fileService->upload($project, $file, 'app');

            return response()->json([
                'file' => [
                    'id' => $projectFile->id,
                    'url' => $projectFile->getApiUrl(),
                    'filename' => $projectFile->original_filename,
                    'mime_type' => $projectFile->mime_type,
                    'size' => $projectFile->size,
                    'human_size' => $projectFile->getHumanReadableSize(),
                ],
                // The user's global total across all projects (matches store()).
                'storage_used' => $project->user->getTotalStorageUsedBytes(),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Serve a file from a generated app.
     */
    public function appServe(string $projectId, string $path): RedirectResponse|StreamedResponse|BinaryFileResponse|JsonResponse
    {
        $project = Project::findOrFail($projectId);

        $file = $project->files()->where('path', $path)->first();

        if (! $file) {
            return response()->json(['error' => __('File not found')], 404);
        }

        // Offload to the bucket via a presigned URL when the provider supports it.
        if ($url = app(BucketStorageManager::class)->temporaryUrl($file, now()->addHour())) {
            // no-store so a cached 302 can't outlive the presigned URL's short TTL.
            return redirect()->away($url)->header('Cache-Control', 'no-store, private');
        }

        $response = $this->fileService->streamFile($file);

        if (! $response) {
            return response()->json(['error' => __('File not found on disk')], 404);
        }

        return $response;
    }

    /**
     * List files from a generated app.
     */
    public function appIndex(string $projectId): JsonResponse
    {
        $project = Project::findOrFail($projectId);

        $files = $this->fileService->getFiles($project)->map(fn ($file) => [
            'id' => $file->id,
            'filename' => $file->original_filename,
            'mime_type' => $file->mime_type,
            'size' => $file->size,
            'url' => $file->getApiUrl(),
            'created_at' => $file->created_at->toISOString(),
        ]);

        return response()->json([
            'files' => $files,
        ]);
    }

    /**
     * Delete a file from a generated app.
     */
    public function appDestroy(string $projectId, int $fileId): JsonResponse
    {
        $project = Project::findOrFail($projectId);

        $file = ProjectFile::where('id', $fileId)
            ->where('project_id', $project->id)
            ->first();

        if (! $file) {
            return response()->json(['error' => __('File not found')], 404);
        }

        $this->fileService->delete($file);

        return response()->json([
            'message' => __('File deleted successfully'),
        ]);
    }
}
