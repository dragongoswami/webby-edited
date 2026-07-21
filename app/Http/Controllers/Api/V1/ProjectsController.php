<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\ProjectResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ProjectsController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        // Floor of 1: per_page=0 would divide-by-zero in the paginator and
        // negatives would drop the LIMIT clause entirely.
        $perPage = max(1, min((int) $request->input('per_page', 15), 50));

        $projects = $request->user()->projects()
            ->orderByDesc('updated_at')
            ->paginate($perPage);

        return ProjectResource::collection($projects);
    }

    public function show(Request $request, string $projectId): ProjectResource
    {
        // Owner-scoped lookup: other users' projects 404 (existence not revealed).
        // A clean message is used instead of findOrFail's default, which would
        // leak the Eloquent model class name to API consumers.
        $project = $request->user()->projects()->find($projectId);
        abort_if($project === null, 404, 'Project not found.');

        return new ProjectResource($project);
    }
}
