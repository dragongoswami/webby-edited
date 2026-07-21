<?php

namespace App\Http\Controllers;

use App\Models\GithubConnection;
use App\Models\Project;
use App\Services\GithubService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProjectGithubController extends Controller
{
    public function __construct(private GithubService $github) {}

    public function link(Request $request, Project $project): JsonResponse
    {
        abort_unless($project->user_id === $request->user()->id, 403);
        abort_unless($request->user()->getCurrentPlan()?->githubEnabled(), 403);
        // Theme projects (WordPress, Shopify) don't link repos (the theme zip
        // is the deliverable); the Create UI never offers GitHub for them.
        abort_if($project->isWordPressTheme() || $project->isShopifyTheme(), 403);

        $data = $request->validate([
            'connection_id' => 'required|integer',
            'mode' => 'required|in:create,attach',
            'name' => 'required|string|max:100',
            'owner' => 'required_if:mode,attach|string',
            'private' => 'sometimes|boolean',
        ]);

        $conn = GithubConnection::where('id', $data['connection_id'])
            ->where('user_id', $request->user()->id)->where('status', 'active')->firstOrFail();

        if ($data['mode'] === 'create') {
            $repo = $this->github->createRepo($conn, $data['name'], (bool) ($data['private'] ?? true));
        } else {
            abort_unless(
                $this->github->repoIsEmpty($conn, $data['owner'], $data['name']),
                422, 'That repository already contains code. Connect an empty repo or let Webby create one.'
            );
            $repo = ['owner' => $data['owner'], 'name' => $data['name'], 'id' => null];
        }

        $project->update([
            'github_connection_id' => $conn->id,
            'github_repo_owner' => $repo['owner'],
            'github_repo_name' => $repo['name'],
            'github_repo_id' => $repo['id'],
            'github_repo_private' => (bool) ($data['private'] ?? true),
            'github_default_branch' => 'main',
        ]);

        return response()->json(['ok' => true, 'repo' => "{$repo['owner']}/{$repo['name']}"]);
    }

    public function updateAutoPush(Request $request, Project $project): JsonResponse
    {
        abort_unless($project->user_id === $request->user()->id, 403);
        abort_unless($request->user()->getCurrentPlan()?->githubEnabled(), 403);
        abort_if($project->isWordPressTheme() || $project->isShopifyTheme(), 403);
        $data = $request->validate(['auto_push' => 'required|boolean']);
        $project->update(['github_auto_push' => $data['auto_push']]);

        return response()->json(['ok' => true, 'auto_push' => (bool) $project->github_auto_push]);
    }
}
