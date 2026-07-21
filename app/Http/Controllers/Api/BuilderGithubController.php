<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Services\CopyrightMarkService;
use App\Services\GithubService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Server-to-server endpoint: mints a fresh, per-repo, 1-hour installation token
 * for the project's linked repo. Authenticated via X-Server-Key. The builder
 * never holds a durable credential — it calls this before each git operation.
 */
class BuilderGithubController extends Controller
{
    public function token(Request $request, GithubService $github): JsonResponse
    {
        $data = $request->validate(['session_id' => 'required|string']);
        $project = Project::where('build_session_id', $data['session_id'])->first();

        if (! $project) {
            return response()->json(['ok' => false, 'error' => 'Unknown session']);
        }
        $plan = $project->user?->getCurrentPlan();
        if (! ($plan?->githubEnabled() ?? false) || ! $project->github_repo_name || ! $project->githubConnection) {
            return response()->json(['ok' => false, 'error' => 'GitHub not enabled for this project']);
        }

        if ($project->githubConnection->status !== 'active') {
            return response()->json(['ok' => false, 'error' => 'GitHub connection is revoked']);
        }

        try {
            $minted = $github->mintInstallationToken(
                (int) $project->githubConnection->installation_id,
                $project->github_repo_name
            );
        } catch (\Throwable $e) {
            return response()->json(['ok' => false, 'error' => 'Failed to mint token']);
        }

        $project->githubConnection->forceFill(['last_used_at' => now()])->save();

        return response()->json([
            'ok' => true,
            'token' => $minted['token'],
            'expires_at' => $minted['expires_at'],
            'clone_url' => "https://github.com/{$project->github_repo_owner}/{$project->github_repo_name}.git",
            'last_pushed_sha' => $project->github_last_pushed_sha,
            // Plan-gated attribution the builder embeds in the pushed source
            // (staged blob only). Minted per push, so it always reflects the
            // owner's current plan. Null when the plan has White Label.
            'copyright' => app(CopyrightMarkService::class)->markFor($project),
        ]);
    }

    public function pushed(Request $request): JsonResponse
    {
        $data = $request->validate([
            'session_id' => 'required|string',
            'sha' => 'required|string|max:64',
        ]);
        $project = Project::where('build_session_id', $data['session_id'])->first();
        if (! $project) {
            return response()->json(['ok' => false, 'error' => 'Unknown session']);
        }

        // Defense-in-depth: only record a pushed sha for a project that has a
        // linked repo AND an active connection — mirrors the guards on token();
        // avoids writing tracking state for unlinked or revoked projects.
        if (! $project->github_repo_name || ! $project->githubConnection || $project->githubConnection->status !== 'active') {
            return response()->json(['ok' => false, 'error' => 'No active repository linked']);
        }

        $project->forceFill([
            'github_last_pushed_sha' => $data['sha'],
            'github_last_pushed_at' => now(),
        ])->save();

        return response()->json(['ok' => true]);
    }
}
