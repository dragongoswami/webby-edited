<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\ProjectFileResource;
use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ProjectFilesController extends Controller
{
    public function index(Request $request, string $projectId): AnonymousResourceCollection
    {
        $project = $this->resolveProject($request, $projectId);

        $perPage = max(1, min((int) $request->input('per_page', 20), 50));

        $files = $project->files()
            ->orderByDesc('created_at')
            ->paginate($perPage);

        return ProjectFileResource::collection($files);
    }

    public function show(Request $request, string $projectId, int $fileId): ProjectFileResource
    {
        $project = $this->resolveProject($request, $projectId);

        // Scoped through the project relation: a file under a different project
        // (even one the user owns) 404s rather than leaking across projects.
        $file = $project->files()->find($fileId);
        abort_if($file === null, 404, 'File not found.');

        return new ProjectFileResource($file);
    }

    /**
     * Owner-scope the project (404 for non-owned), then gate on the file
     * storage capability (403). Ownership is checked first so a cross-user
     * project never reveals the owner's plan state.
     */
    private function resolveProject(Request $request, string $projectId): Project
    {
        // find()+abort (not findOrFail) so the 404 body carries a clean message
        // rather than leaking the Eloquent model class to API consumers.
        $project = $request->user()->projects()->find($projectId);
        abort_if($project === null, 404, 'Project not found.');

        abort_unless(
            (bool) $request->user()->getCurrentPlan()?->fileStorageEnabled(),
            403
        );

        return $project;
    }
}
