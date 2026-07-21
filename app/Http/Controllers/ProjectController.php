<?php

namespace App\Http\Controllers;

use App\Models\GithubConnection;
use App\Models\Project;
use App\Models\SystemSetting;
use App\Models\Template;
use App\Services\BroadcastService;
use App\Services\BuildCreditService;
use App\Services\GithubService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class ProjectController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $tab = $request->get('tab', 'all');
        $search = $request->get('search');
        $sort = $request->get('sort', 'last-edited');
        $visibility = $request->get('visibility');

        // Build base query based on tab
        $query = match ($tab) {
            'favorites' => $user->projects()->with('user')->where('is_starred', true),
            default => $user->projects()->with('user'),
        };

        // Apply search filter
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        // Apply visibility filter
        if ($visibility && in_array($visibility, ['public', 'private'])) {
            $query->where('is_public', $visibility === 'public');
        }

        // Apply sorting
        $query = match ($sort) {
            'name' => $query->orderBy('name', 'asc'),
            'created' => $query->orderBy('created_at', 'desc'),
            default => $query->orderBy('updated_at', 'desc'),
        };

        // Paginate
        $projects = $query->paginate(12)->withQueryString();

        $counts = [
            'all' => $user->projects()->count(),
            'favorites' => $user->projects()->where('is_starred', true)->count(),
            'trash' => $user->projects()->onlyTrashed()->count(),
        ];

        $filters = [
            'search' => $search,
            'sort' => $sort,
            'visibility' => $visibility,
        ];

        return Inertia::render('Projects/Index', [
            'projects' => $projects,
            'counts' => $counts,
            'activeTab' => $tab,
            'filters' => $filters,
            'baseDomain' => SystemSetting::get('domain_base_domain', config('app.base_domain', 'example.com')),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        // Block demo admin from creating projects — they should register their own account
        if (config('app.demo') && Auth::id() === 1) {
            return back()->withErrors([
                'prompt' => __('The demo admin account cannot create projects. Register your own account to test the AI website builder.'),
            ]);
        }

        // Check if broadcast is configured AND working (force fresh check)
        $broadcastService = app(BroadcastService::class);
        $errorMessage = $broadcastService->getErrorMessage();

        if ($errorMessage) {
            return back()->withErrors([
                'prompt' => $errorMessage,
            ]);
        }

        // Check project limit
        if (! $request->user()->canCreateMoreProjects()) {
            $plan = $request->user()->getCurrentPlan();
            $maxProjects = $plan ? $plan->getMaxProjects() : 0;

            return back()->withErrors([
                'prompt' => $maxProjects === 0
                    ? __('Your plan does not include project creation. Please upgrade your plan to create projects.')
                    : __('You have reached the maximum number of projects (:max) allowed by your plan. Please upgrade to create more projects.', ['max' => $maxProjects]),
            ]);
        }

        // Check if user can perform builds
        $buildCreditService = app(BuildCreditService::class);
        $canBuild = $buildCreditService->canPerformBuild($request->user());

        if (! $canBuild['allowed']) {
            return back()->withErrors([
                'prompt' => $canBuild['reason'],
            ]);
        }

        // Block concurrent builds for the same user (verifies with Go builder)
        $blockingProject = BuilderProxyController::resolveBlockingBuild($request->user()->id);

        if ($blockingProject) {
            return back()->withErrors([
                'prompt' => __('You have an active session on ":project". Wait for it to complete, or stop it.', [
                    'project' => str($blockingProject->name)->limit(50)->toString(),
                ]),
            ]);
        }

        $validated = $request->validate([
            'prompt' => 'required|string|max:2000',
            'template_id' => 'nullable|integer|exists:templates,id',
            // Design system is optional: null = Automatic (the AI picks one at
            // first build via DesignSystemService::ensureResolved). A chosen id
            // pins the system; design_accent narrows the palette within it.
            'design_system_id' => 'nullable|integer|exists:design_systems,id,status,active',
            'design_accent' => 'nullable|string|max:64',
            // BYOD: optional Supabase connection from the user's own library.
            // Scoped to the user's own connections — a foreign/non-existent id
            // both fail validation identically (no existence enumeration leak).
            'supabase_connection_id' => [
                'nullable', 'integer',
                Rule::exists('supabase_connections', 'id')->where('user_id', $request->user()->id),
            ],
            // GitHub: optional connection from the user's own library. When set,
            // Webby auto-creates a fresh private repo for the project under that
            // account. Scoped to the user's own connections (a foreign/missing id
            // fails validation identically — no existence enumeration leak).
            'github_connection_id' => [
                'nullable', 'integer',
                Rule::exists('github_connections', 'id')->where('user_id', $request->user()->id),
            ],
            // Shopify: optional store connection from the user's own library. Only
            // applied to shopify_theme projects (nulled otherwise). Scoped to the
            // user's own connections (a foreign/missing id fails validation
            // identically — no existence enumeration leak).
            'shopify_connection_id' => [
                'nullable', 'integer',
                Rule::exists('shopify_connections', 'id')->where('user_id', $request->user()->id),
            ],
            // Generation output target. null/website = the default React site;
            // wordpress_theme = an FSE block theme (gated by the WordPress plugin);
            // shopify_theme = a Liquid theme (gated by the Shopify plugin).
            'output_target' => 'nullable|string|in:website,wordpress_theme,shopify_theme',
        ]);

        // A linked database still requires the plan capability.
        if (! empty($validated['supabase_connection_id'])) {
            abort_unless((bool) $request->user()->getCurrentPlan()?->databaseEnabled(), 403);
        }

        // A linked GitHub repo still requires the plan + plugin capability.
        if (! empty($validated['github_connection_id'])) {
            abort_unless((bool) $request->user()->getCurrentPlan()?->githubEnabled(), 403);
        }

        // WordPress is a generation output target gated by the paid plugin + plan flag.
        $outputTarget = $validated['output_target'] ?? 'website';
        if ($outputTarget === 'wordpress_theme') {
            abort_unless((bool) $request->user()->getCurrentPlan()?->wordpressEnabled(), 403);

            // WordPress themes are downloadable artifacts: no Supabase backend
            // and no GitHub repo apply. The Create UI clears both pickers when
            // the WordPress target is selected — enforce the same server-side
            // so a crafted request can't attach connections to a theme project.
            $validated['supabase_connection_id'] = null;
            $validated['github_connection_id'] = null;
        }
        if ($outputTarget === 'shopify_theme') {
            // Shopify is a generation output target gated by the paid plugin + plan flag.
            abort_unless((bool) $request->user()->getCurrentPlan()?->shopifyEnabled(), 403);

            // Theme projects are downloadable artifacts: no Supabase backend, no GitHub
            // repo. The Create UI clears both pickers; enforce it server-side too.
            $validated['supabase_connection_id'] = null;
            $validated['github_connection_id'] = null;

            // When store connections are disabled the plugin is download-only —
            // a crafted request can't attach a store the picker doesn't offer.
            if (! $request->user()->getCurrentPlan()?->shopifyConnectEnabled()) {
                $validated['shopify_connection_id'] = null;
            }
        }

        // A chosen template must belong to the selected output target's family.
        if (! empty($validated['template_id'])) {
            $chosenTemplate = Template::find($validated['template_id']);
            if ($chosenTemplate && ($chosenTemplate->output_target ?? 'website') !== $outputTarget) {
                throw ValidationException::withMessages([
                    'template_id' => __('That template is not available for the selected output type.'),
                ]);
            }
        }

        // Generate a name from the prompt (first 50 chars)
        $name = str($validated['prompt'])->limit(50, '...')->toString();

        $project = Project::create([
            'user_id' => $request->user()->id,
            'name' => $name,
            'initial_prompt' => $validated['prompt'],
            'template_id' => $validated['template_id'] ?? null,
            'output_target' => $outputTarget,
            'design_system_id' => $validated['design_system_id'] ?? null,
            'design_accent' => $validated['design_accent'] ?? null,
            'supabase_connection_id' => $validated['supabase_connection_id'] ?? null,
            'shopify_connection_id' => $outputTarget === 'shopify_theme' ? ($validated['shopify_connection_id'] ?? null) : null,
            'last_viewed_at' => now(),
        ]);

        // GitHub: auto-create a fresh private repo for the project under the
        // chosen account and link it. Best-effort — a failure here (name clash,
        // GitHub down, revoked token) must not lose the project, so we flash a
        // warning and continue; the project is simply created without a repo.
        if (! empty($validated['github_connection_id'])) {
            $this->linkGithubRepo($project, (int) $validated['github_connection_id'], $request->user()->id);
        }

        return redirect()->route('chat', $project);
    }

    /**
     * Create a private repo for the project under the user's chosen connection
     * and persist the linkage. Swallows failures into a flashed warning.
     */
    private function linkGithubRepo(Project $project, int $connectionId, int $userId): void
    {
        $conn = GithubConnection::where('id', $connectionId)
            ->where('user_id', $userId)
            ->where('status', 'active')
            ->first();

        if (! $conn) {
            session()->flash('error', __('Couldn\'t use that GitHub connection. Your project was created without a repository.'));

            return;
        }

        // Derive a valid, unique repo name: slug of the project name (GitHub
        // allows [A-Za-z0-9._-]), suffixed with a short slice of the project UUID
        // to avoid collisions across same-named projects.
        $base = str($project->name)->slug()->limit(60, '')->toString();
        if ($base === '') {
            $base = 'webby-site';
        }
        $repoName = $base.'-'.substr($project->id, 0, 8);

        try {
            $repo = app(GithubService::class)->createRepo($conn, $repoName, true);
        } catch (\Throwable $e) {
            Log::warning('GitHub repo creation failed at project creation', [
                'project_id' => $project->id,
                'connection_id' => $conn->id,
                'error' => $e->getMessage(),
            ]);
            session()->flash('error', __('Your project was created, but the GitHub repository couldn\'t be created. Please try linking one again later.'));

            return;
        }

        $project->update([
            'github_connection_id' => $conn->id,
            'github_repo_owner' => $repo['owner'],
            'github_repo_name' => $repo['name'],
            'github_repo_id' => $repo['id'],
            'github_repo_private' => true,
            'github_default_branch' => 'main',
            'github_auto_push' => true,
        ]);
    }

    public function trash(Request $request): Response
    {
        $user = $request->user();
        $search = $request->get('search');
        $sort = $request->get('sort', 'last-edited');

        $query = $user->projects()
            ->onlyTrashed()
            ->with('user');

        // Apply search filter
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        // Apply sorting
        $query = match ($sort) {
            'name' => $query->orderBy('name', 'asc'),
            'created' => $query->orderBy('created_at', 'desc'),
            default => $query->orderBy('deleted_at', 'desc'),
        };

        // Paginate
        $projects = $query->paginate(12)->withQueryString();

        $counts = [
            'all' => $user->projects()->count(),
            'favorites' => $user->projects()->where('is_starred', true)->count(),
            'trash' => $user->projects()->onlyTrashed()->count(),
        ];

        $filters = [
            'search' => $search,
            'sort' => $sort,
            'visibility' => null, // Not applicable for trash
        ];

        return Inertia::render('Projects/Index', [
            'projects' => $projects,
            'counts' => $counts,
            'activeTab' => 'trash',
            'filters' => $filters,
            'baseDomain' => SystemSetting::get('domain_base_domain', config('app.base_domain', 'example.com')),
        ]);
    }

    public function toggleStar(Project $project): RedirectResponse
    {
        $this->authorize('update', $project);

        $project->update(['is_starred' => ! $project->is_starred]);

        return back();
    }

    public function duplicate(Project $project): RedirectResponse
    {
        $this->authorize('view', $project);

        // Block demo admin from duplicating projects
        if (config('app.demo') && Auth::id() === 1) {
            return back()->withErrors([
                'project' => __('The demo admin account cannot create projects. Register your own account to test the AI website builder.'),
            ]);
        }

        // Check project limit
        if (! request()->user()->canCreateMoreProjects()) {
            $plan = request()->user()->getCurrentPlan();
            $maxProjects = $plan ? $plan->getMaxProjects() : 0;

            return back()->withErrors([
                'project' => $maxProjects === 0
                    ? __('Your plan does not include project creation. Please upgrade your plan to create projects.')
                    : __('You have reached the maximum number of projects (:max) allowed by your plan. Please upgrade to create more projects.', ['max' => $maxProjects]),
            ]);
        }

        $newProject = $project->duplicate(request()->user());

        return redirect()->route('projects.index');
    }

    public function destroy(Project $project): RedirectResponse
    {
        $this->authorize('delete', $project);

        $project->delete();

        return back();
    }

    public function restore(Project $project): RedirectResponse
    {
        $this->authorize('restore', $project);

        $project->restore();

        return redirect()->route('projects.index');
    }

    public function forceDelete(Project $project): RedirectResponse
    {
        $this->authorize('forceDelete', $project);

        $project->forceDelete();

        return back();
    }
}
