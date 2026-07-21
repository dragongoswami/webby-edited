<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Services\SupabaseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Server-to-server endpoint for the Go builder agent's `defineTable` tool.
 * Authenticated via X-Server-Key (verify.server.key middleware). All SQL/RLS
 * is authored by the platform in SupabaseService — the agent never sends SQL.
 */
class BuilderSupabaseController extends Controller
{
    /**
     * Create a project table (public or per-user-private) with platform-authored
     * RLS. Resolves the project by its active build session, gates on the plan's
     * Database capability + a configured Supabase backend, then delegates to
     * SupabaseService::defineTable(). Always returns {ok, ...} — never throws to
     * the agent.
     */
    public function defineTable(Request $request, SupabaseService $supabase): JsonResponse
    {
        $data = $request->validate([
            'session_id' => 'required|string',
            'table' => 'required|string',
            'columns' => 'required|array|min:1',
            'columns.*.name' => 'required|string',
            'columns.*.type' => 'required|string',
            'columns.*.nullable' => 'sometimes|boolean',
            'columns.*.default' => 'sometimes|nullable|string',
            'access' => 'required|in:public,private',
        ]);

        $project = Project::where('build_session_id', $data['session_id'])->first();
        if (! $project) {
            return response()->json(['ok' => false, 'error' => 'Unknown session']);
        }

        $plan = $project->user?->getCurrentPlan();
        if (! ($plan?->databaseEnabled() ?? false) || ! $supabase->hasConnection($project)) {
            return response()->json(['ok' => false, 'error' => 'Database capability not enabled']);
        }

        return response()->json($supabase->defineTable($project, $data));
    }
}
