<?php

namespace App\Http\Controllers;

use App\Models\Builder;
use App\Models\DesignSystem;
use App\Models\Project;
use App\Models\SystemSetting;
use App\Services\BuilderService;
use App\Services\DesignSystemService;
use App\Services\DomainSettingService;
use App\Services\SupabaseService;
use App\Support\SubdomainHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class ProjectSettingsController extends Controller
{
    public function __construct(
        protected DomainSettingService $domainSettingService
    ) {}

    public function show(Request $request, Project $project): Response
    {
        $this->authorize('update', $project);

        $user = $request->user();
        $plan = $user->getCurrentPlan();
        $baseDomain = SystemSetting::get('domain_base_domain', config('app.base_domain', 'example.com'));

        // Storage settings
        $storageSettings = null;
        if ($plan && $plan->fileStorageEnabled()) {
            $storageSettings = [
                'enabled' => true,
                'usedBytes' => $project->storage_used_bytes ?? 0,
                'limitMb' => $plan->getMaxStorageMb(),
                'unlimited' => $plan->hasUnlimitedStorage(),
            ];
        }

        // Custom domain settings
        $customDomainSettings = null;
        if ($this->domainSettingService->isCustomDomainsEnabled()) {
            $customDomainSettings = [
                'enabled' => $user->canUseCustomDomains(),
                'canCreateMore' => $user->canCreateMoreCustomDomains(),
                'usage' => $user->getCustomDomainUsage(),
                'baseDomain' => $this->domainSettingService->getBaseDomain(),
            ];
        }

        return Inertia::render('Project/Settings', [
            'project' => [
                'id' => $project->id,
                'name' => $project->name,
                'subdomain' => $project->subdomain,
                'published_title' => $project->published_title,
                'published_description' => $project->published_description,
                'published_visibility' => $project->published_visibility,
                'share_image' => $project->share_image,
                'custom_instructions' => $project->custom_instructions,
                'design_system_id' => $project->design_system_id,
                'design_accent' => $project->design_accent,
                'api_token' => $project->api_token,
                'custom_domain' => $project->custom_domain,
                'custom_domain_verified' => $project->custom_domain_verified,
                'custom_domain_ssl_status' => $project->custom_domain_ssl_status,
                'github_repo_name' => $project->github_repo_name,
                'github_auto_push' => (bool) $project->github_auto_push,
                'output_target' => $project->output_target ?? 'website',
                'supabase_connection_id' => $project->supabase_connection_id,
                'shopify_connection_id' => $project->shopify_connection_id,
                'shopify_store_domain' => $project->shopify_store_domain,
            ],
            // Shopify: the user's own active store connections for the editor's
            // attach/change picker, only when BYOS store connections are enabled.
            'shopifyConnections' => $plan?->shopifyConnectEnabled()
                ? $user->shopifyConnections()->where('status', 'active')->get(['id', 'label', 'shop_domain'])
                : [],
            'designSystems' => app(DesignSystemService::class)->publicCatalog(),
            'baseDomain' => $baseDomain,
            'canUseSubdomains' => SystemSetting::get('domain_enable_subdomains', false) && $user->canUseSubdomains(),
            'canCreateMoreSubdomains' => SystemSetting::get('domain_enable_subdomains', false) && $user->canCreateMoreSubdomains(),
            'canUsePrivateVisibility' => $user->canUsePrivateVisibility(),
            'subdomainUsage' => $user->getSubdomainUsage(),
            'suggestedSubdomain' => $project->subdomain ?? SubdomainHelper::generateFromString($project->name),
            'storage' => $storageSettings,
            'customDomain' => $customDomainSettings,
            'subdomainsGloballyEnabled' => $this->domainSettingService->isSubdomainsEnabled(),
            'customDomainsGloballyEnabled' => $this->domainSettingService->isCustomDomainsEnabled(),
        ]);
    }

    public function updateGeneral(Request $request, Project $project): RedirectResponse
    {
        $this->authorize('update', $project);

        // WordPress themes are downloaded, not hosted, so the publish/share
        // metadata (title/description/visibility) is hidden in the UI and not
        // submitted. Only validate + persist the project name for them.
        $isWordPress = ($project->output_target ?? 'website') === 'wordpress_theme';

        if ($isWordPress) {
            $validated = $request->validate([
                'name' => 'required|string|max:255',
            ]);

            $project->update($validated);

            return back()->with('success', __('Settings updated.'));
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'published_title' => 'nullable|string|max:255',
            'published_description' => 'nullable|string|max:150',
            'published_visibility' => 'required|in:public,private',
        ]);

        if ($validated['published_visibility'] === 'private' && ! $request->user()->canUsePrivateVisibility()) {
            return back()->withErrors(['published_visibility' => __('Your plan does not include private visibility.')]);
        }

        $project->update($validated);

        return back()->with('success', __('Settings updated.'));
    }

    public function updateKnowledge(Request $request, Project $project): RedirectResponse
    {
        $this->authorize('update', $project);

        $validated = $request->validate([
            'custom_instructions' => 'nullable|string|max:500',
        ]);

        $project->update($validated);

        return back()->with('success', __('Custom instructions updated.'));
    }

    /**
     * Attach, switch, or detach the project's BYOD Supabase connection.
     *
     * The builder resolves the linked connection live on every build, so the
     * change takes effect on the next build — no rebuild is triggered here.
     * The schema name (proj_<uuid>) is stable per project and schemas on a
     * previously linked database are never dropped: the database and its data
     * belong to the user.
     */
    public function updateDatabase(Request $request, Project $project, SupabaseService $supabase): RedirectResponse
    {
        $this->authorize('update', $project);

        // Theme projects (WordPress, Shopify) have no backend; the Database tab
        // is hidden for them in the UI — enforce server-side too.
        abort_if($project->isWordPressTheme() || $project->isShopifyTheme(), 403);

        $validated = $request->validate([
            'supabase_connection_id' => [
                'nullable', 'integer',
                Rule::exists('supabase_connections', 'id')->where('user_id', $request->user()->id),
            ],
        ]);

        // ?? null also covers the key being absent from the request entirely.
        $connectionId = $validated['supabase_connection_id'] ?? null;
        $connectionId = $connectionId !== null ? (int) $connectionId : null;

        // Attaching/switching requires the plan capability; detaching is always
        // allowed so a downgraded user can unlink their database.
        if ($connectionId !== null) {
            abort_unless((bool) $request->user()->getCurrentPlan()?->databaseEnabled(), 403);
        }

        // Already int|null via the model's integer cast.
        $current = $project->supabase_connection_id;

        if ($connectionId === $current) {
            return back()->with('success', __('Database updated. Changes take effect on the next build.'));
        }

        $project->update(['supabase_connection_id' => $connectionId]);

        if ($connectionId !== null) {
            // Best-effort, mirroring ProjectObserver::created — a transient
            // failure must not block the assignment; the schema is also created
            // implicitly when the builder first defines a table.
            try {
                $supabase->ensureProjectSchema($project);
            } catch (Throwable $e) {
                Log::warning('ProjectSettingsController: ensureProjectSchema failed', [
                    'project_id' => $project->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return back()->with('success', __('Database updated. Changes take effect on the next build.'));
    }

    public function uploadShareImage(Request $request, Project $project): RedirectResponse
    {
        $this->authorize('update', $project);

        $request->validate([
            'share_image' => 'required|image|max:2048|mimes:jpg,jpeg,png,webp',
        ]);

        if ($project->share_image) {
            Storage::disk('public')->delete($project->share_image);
        }

        $path = $request->file('share_image')->store('share-images', 'public');
        $project->update(['share_image' => $path]);

        return back()->with('success', __('Share image uploaded.'));
    }

    public function deleteShareImage(Request $request, Project $project): RedirectResponse
    {
        $this->authorize('update', $project);

        if ($project->share_image) {
            Storage::disk('public')->delete($project->share_image);
            $project->update(['share_image' => null]);
        }

        return back()->with('success', __('Share image removed.'));
    }

    /**
     * Upload a thumbnail image from base64 data (captured from preview iframe).
     */
    public function uploadThumbnail(Request $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        $request->validate([
            // ~2.8MB of base64 ≈ ~2MB raw — caps the payload (thumbnails are small).
            'image' => 'required|string|max:2800000',
        ]);

        // Decode base64 and enforce a hard byte ceiling before touching disk.
        $imageData = base64_decode(preg_replace('#^data:image/\w+;base64,#i', '', $request->image), true);
        if ($imageData === false || strlen($imageData) > 2 * 1024 * 1024) {
            return response()->json(['error' => __('Invalid or oversized thumbnail.')], 422);
        }

        // Delete old thumbnail if exists
        if ($project->thumbnail) {
            Storage::disk('public')->delete($project->thumbnail);
        }

        $path = 'thumbnails/'.$project->id.'.png';
        Storage::disk('public')->put($path, $imageData);

        // Update thumbnail path and force updated_at refresh for cache busting
        $project->thumbnail = $path;
        $project->touch();

        return response()->json(['success' => true, 'path' => $path]);
    }

    /**
     * Generate a new API token for the project.
     */
    public function generateApiToken(Request $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        if ($project->hasApiToken()) {
            return response()->json([
                'error' => __('Project already has an API token. Use regenerate to create a new one.'),
            ], 422);
        }

        $token = $project->generateApiToken();

        return response()->json([
            'token' => $token,
            'message' => __('API token generated successfully.'),
        ]);
    }

    /**
     * Regenerate the API token for the project.
     */
    public function regenerateApiToken(Request $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        $token = $project->regenerateApiToken();

        return response()->json([
            'token' => $token,
            'message' => __('API token regenerated successfully.'),
        ]);
    }

    /**
     * Revoke the API token for the project.
     */
    public function revokeApiToken(Request $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        $project->revokeApiToken();

        return response()->json([
            'message' => __('API token revoked successfully.'),
        ]);
    }

    /**
     * Re-apply a design system (+ accent) to a project from the settings panel.
     *
     * On every apply we: (1) persist the chosen system + accent, (2) overlay the
     * system tokens + accent onto src/index.css on the builder workspace and
     * trigger a deterministic rebuild so the preview picks up the new look
     * immediately, and (3) return an `ai_fixup_prompt` the frontend submits as a
     * chat message so the agent reconciles hardcoded color classes (e.g.
     * `bg-blue-500`) with the new semantic tokens.
     *
     * If no builder is available we still return success but surface a warning;
     * the frontend can display it as a toast.
     */
    public function updateDesign(Request $request, Project $project, BuilderService $builderService): JsonResponse
    {
        $this->authorize('update', $project);

        // The Design-mode re-theme is a website-only flow: the builder's
        // design-workspace overlay rewrites src/index.css, which would inject
        // junk into a theme workspace without actually re-theming it (themes
        // are themed via their own manifest at build time). The Design UI is
        // unreachable for theme projects; enforce server-side too.
        if ($project->isWordPressTheme() || $project->isShopifyTheme()) {
            return response()->json([
                'error' => __('Design re-theming is not available for theme projects.'),
            ], 403);
        }

        $validated = $request->validate([
            'design_system_id' => 'required|integer|exists:design_systems,id,status,active',
            'design_accent' => ['nullable', 'string', 'max:64', function ($attr, $value, $fail) use ($request) {
                if (! $value) {
                    return;
                }
                $system = DesignSystem::find($request->input('design_system_id'));
                if ($system && ! in_array($value, $system->accents(), true)) {
                    $fail(__('The selected accent is not available for this design system.'));
                }
            }],
        ]);

        $project->update([
            'design_system_id' => $validated['design_system_id'],
            'design_accent' => $validated['design_accent'] ?? null,
        ]);
        $project->refresh()->load('designSystem');

        $builder = $project->builder ?? Builder::selectOptimal();
        $warning = null;

        if ($builder) {
            $applied = $builderService->applyDesignToWorkspace($builder, $project);
            if (! $applied) {
                $warning = __('Design saved but could not apply to workspace. Build a preview first.');
            } else {
                // Rebuild synchronously so the preview iframe shows the new look
                // immediately, even if the AI fixup that runs after this response
                // fails or the user is out of credits.
                try {
                    $builderService->triggerBuild($builder, $project->id, $project->id);
                } catch (\Exception $e) {
                    Log::warning('Design applied but rebuild failed', [
                        'project_id' => $project->id,
                        'design_system_id' => $project->design_system_id,
                        'error' => $e->getMessage(),
                    ]);
                    $warning = __('Design applied to source files but rebuild failed').': '.$e->getMessage();
                }
            }
        } else {
            $warning = __('Design saved but could not apply to workspace. No builder available.');
        }

        $response = [
            'success' => true,
            'ai_fixup_prompt' => $this->buildDesignFixupPrompt($project),
        ];

        if ($warning !== null) {
            $response['warning'] = $warning;
        }

        return response()->json($response);
    }

    /**
     * Build a chat message the frontend submits to the AI so it reconciles any
     * hardcoded color classes with the newly applied design system + accent.
     *
     * The builder has ALREADY overlaid the system tokens + accent onto
     * src/index.css deterministically; this message scopes the agent to
     * refactoring hardcoded colors into semantic tokens without churning
     * content or layout.
     */
    private function buildDesignFixupPrompt(Project $project): ?string
    {
        $system = $project->designSystem;
        if (! $system) {
            return null;
        }

        $name = $system->name;
        $accentName = $project->design_accent ?: ($system->manifest()['default_accent'] ?? 'default');
        $accent = $system->resolveAccent($project->design_accent);
        $light = $accent['light'] ?? [];
        $dark = $accent['dark'] ?? [];

        $fmt = fn (?string $hsl): string => $hsl ? "hsl({$hsl})" : '';

        $header = [
            "I switched this site to the \"{$name}\" design system with the \"{$accentName}\" accent. The design system's tokens and fonts have already been applied to src/index.css. Please reconcile the rest of the code with the new palette.",
            '',
            'Accent (light mode): primary '.$fmt($light['primary'] ?? null),
            'Accent (dark mode): primary '.$fmt($dark['primary'] ?? null),
            '',
        ];

        $guardrail = 'Do NOT change content, copy, layout, structure, routes, imports, or component props. Only adjust className strings where a hardcoded color class is used, and keep all existing imagery.';

        // `[DESIGN_APPLY] …` marker so the chat UI renders a compact event
        // bubble instead of dumping the instruction payload into the transcript,
        // and so the agent can distinguish a design-system apply from a freeform
        // style request.
        $marker = [
            "[DESIGN_APPLY] Applying {$name} · {$accentName}",
            '',
        ];

        $lines = array_merge($marker, $header, [
            'Step 1. Scan src/pages/ and src/components/ for hardcoded Tailwind color classes that bypass the CSS variables. Look for class prefixes like `bg-`, `text-`, `border-`, and `from-`/`to-`/`via-` (gradients) followed by hardcoded color names such as `white`, `black`, `gray-500`, `slate-900`, `zinc-200`, `neutral-100`, `amber-500`, `blue-600`, `red-500`, `green-600`, `orange-400`, `emerald-500`, `cyan-500`, `purple-500`, `pink-500`, `yellow-400`, `lime-500`, `teal-500`, `indigo-500`, `violet-500`, `rose-500`, `fuchsia-500`, `sky-500`, `stone-500`, and the rest of the Tailwind color scale.',
            '',
            'Step 2. Replace each hardcoded color class with the appropriate semantic equivalent so the new palette actually takes effect everywhere. The mapping is: backgrounds become `bg-primary`, `bg-primary-foreground`, `bg-accent`, `bg-background`, `bg-muted`, `bg-card`, or `bg-secondary` depending on role; text becomes `text-foreground`, `text-muted-foreground`, `text-primary`, `text-primary-foreground`, or `text-accent-foreground`; borders become `border-border`, `border-primary`, or `border-input`.',
            '',
            'Step 3. Fix any button or link that now has a background-and-text color collision. Patterns to look for: a semantic background class paired with a hardcoded text color (for example `bg-background` together with `text-white`, which renders as white-on-white in light mode), or two semantic classes that resolve to the same color in some mode (for example `bg-primary` together with `text-primary` — both resolve to the same hue). Fix by pairing each background with its matching foreground (`bg-primary` with `text-primary-foreground`), or by pairing hardcoded classes together (`bg-transparent` with `text-white` for buttons sitting over dark images).',
            '',
            'Step 4. If src/custom.css contains any Tailwind class overrides that use !important (for example a rule like `.bg-primary` that sets a background color with `!important`), remove them. They freeze the color in place and prevent the design system from taking effect. Only remove `!important` overrides on utility classes — never touch the `:root`/`.dark` blocks in src/index.css.',
            '',
            "Step 5. Update the project's **design-intelligence.json** so future sessions understand the refactoring decisions you just made. The deterministic apply step has ALREADY written the design system slug and the full accent HSL maps — do NOT overwrite those. Your job is to add a human-readable `semantic_strategy` summary describing how the \"{$name}\" palette maps onto this project's components. Call the `writeDesignIntelligence` tool with `{ \"data\": { \"colors\": { \"semantic_strategy\": \"<your one- or two-sentence summary>\" } } }` — nothing else. `writeDesignIntelligence` deep-merges, so unrelated decisions are preserved automatically.",
            '',
            $guardrail,
        ]);

        return implode("\n", $lines);
    }
}
