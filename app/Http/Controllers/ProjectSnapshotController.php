<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Models\ProjectSnapshot;
use App\Services\SnapshotService;
use Illuminate\Http\JsonResponse;

class ProjectSnapshotController extends Controller
{
    public function __construct(
        protected SnapshotService $snapshotService
    ) {}

    public function index(Project $project): JsonResponse
    {
        $this->authorize('view', $project);

        $snapshots = $project->snapshots()
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(fn (ProjectSnapshot $s) => [
                'id' => $s->id,
                'label' => $s->label,
                'file_count' => $s->file_count,
                'size' => $s->getHumanReadableSize(),
                'size_bytes' => $s->size_bytes,
                'created_at' => $s->created_at->toISOString(),
            ]);

        return response()->json(['snapshots' => $snapshots]);
    }

    public function rollback(Project $project, ProjectSnapshot $snapshot): JsonResponse
    {
        $this->authorize('update', $project);

        if ($snapshot->project_id !== $project->id) {
            abort(404);
        }

        try {
            $this->snapshotService->rollbackSnapshot($snapshot);
        } catch (\RuntimeException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        return response()->json([
            'success' => true,
            'project' => $project->fresh(),
        ]);
    }

    public function destroy(Project $project, ProjectSnapshot $snapshot): JsonResponse
    {
        $this->authorize('update', $project);

        if ($snapshot->project_id !== $project->id) {
            abort(404);
        }

        $this->snapshotService->deleteSnapshot($snapshot);

        return response()->json(['success' => true]);
    }
}
