<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Traits\ChecksDemoMode;
use App\Models\AiProvider;
use App\Models\Builder;
use App\Models\CreditPack;
use App\Models\Plan;
use App\Models\Subscription;
use App\Services\AdminStatsService;
use App\Services\CopyrightMarkService;
use App\Services\DomainSettingService;
use App\Services\PluginManager;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class AdminPlanController extends Controller
{
    use ChecksDemoMode;

    /**
     * Display a listing of plans.
     */
    public function index(Request $request)
    {
        $query = Plan::with(['aiProvider', 'builder'])
            ->withCount(['subscriptions as active_subscribers_count' => function ($query) {
                $query->where('status', 'active');
            }])->orderBy('sort_order');

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        if ($request->filled('status')) {
            $query->where('is_active', $request->status === 'active');
        }

        $plans = $query->get()
            ->each->append(['ai_provider_description', 'builder_description']);

        // Get stats
        $stats = [
            'total_plans' => Plan::count(),
            'active_plans' => Plan::where('is_active', true)->count(),
            'total_subscribers' => Subscription::active()->count(),
        ];

        return Inertia::render('Admin/Plans/Index', [
            'plans' => $plans,
            'stats' => $stats,
            'filters' => $request->only(['search', 'status']),
            'pluginCapabilities' => $this->pluginCapabilities(),
        ]);
    }

    /**
     * Show the form for creating a new plan.
     */
    public function create()
    {
        $aiProviders = AiProvider::active()
            ->orderBy('is_default', 'desc')
            ->orderBy('name')
            ->get(['id', 'name', 'type', 'is_default']);

        $builders = Builder::active()
            ->orderBy('name')
            ->get(['id', 'name']);

        $domainSettings = app(DomainSettingService::class);

        return Inertia::render('Admin/Plans/Create', [
            'aiProviders' => $aiProviders,
            'builders' => $builders,
            'domainSettings' => [
                'subdomainsEnabled' => $domainSettings->isSubdomainsEnabled(),
                'customDomainsEnabled' => $domainSettings->isCustomDomainsEnabled(),
            ],
            'pluginCapabilities' => $this->pluginCapabilities(),
        ]);
    }

    /**
     * Show the form for editing the specified plan.
     */
    public function edit(Plan $plan)
    {
        $plan->load(['aiProvider', 'builder']);

        $aiProviders = AiProvider::active()
            ->orderBy('is_default', 'desc')
            ->orderBy('name')
            ->get(['id', 'name', 'type', 'is_default']);

        $builders = Builder::active()
            ->orderBy('name')
            ->get(['id', 'name']);

        $domainSettings = app(DomainSettingService::class);

        return Inertia::render('Admin/Plans/Edit', [
            'plan' => $plan,
            'aiProviders' => $aiProviders,
            'builders' => $builders,
            'domainSettings' => [
                'subdomainsEnabled' => $domainSettings->isSubdomainsEnabled(),
                'customDomainsEnabled' => $domainSettings->isCustomDomainsEnabled(),
            ],
            'pluginCapabilities' => $this->pluginCapabilities(),
        ]);
    }

    /**
     * Store a newly created plan.
     */
    public function store(Request $request)
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255',
            'description' => 'nullable|string|max:1000',
            'price' => 'required|numeric|min:0',
            'billing_period' => 'required|in:monthly,yearly,lifetime',
            'features' => 'nullable|array',
            'features.*.name' => 'required|string|max:255',
            'features.*.included' => 'required|boolean',
            'is_active' => 'boolean',
            'is_popular' => 'boolean',
            'single_use' => 'boolean',
            'one_time_credits' => 'boolean',
            'sort_order' => 'nullable|integer|min:0',
            'ai_provider_id' => 'nullable|exists:ai_providers,id',
            'fallback_ai_provider_ids' => 'nullable|array',
            'fallback_ai_provider_ids.*' => 'exists:ai_providers,id',
            'builder_id' => 'nullable|exists:builders,id',
            'monthly_build_credits' => 'nullable|integer|min:-1',
            'allow_user_ai_api_key' => 'boolean',
            'max_projects' => 'nullable|integer|min:0',
            // Subdomain settings
            'enable_subdomains' => 'boolean',
            'max_subdomains_per_user' => 'nullable|integer|min:0',
            'allow_private_visibility' => 'boolean',
            // Custom domain settings
            'enable_custom_domains' => 'boolean',
            'max_custom_domains_per_user' => 'nullable|integer|min:0',
            // File storage settings
            'enable_file_storage' => 'boolean',
            'max_storage_mb' => 'nullable|integer|min:0',
            'max_file_size_mb' => 'nullable|integer|min:1|max:500',
            'allowed_file_types' => 'nullable|array',
            'allowed_file_types.*' => 'string',
            // Support tickets
            'enable_support_tickets' => 'boolean',
            'max_open_tickets_per_user' => 'nullable|integer|min:0',
            // Web agent (webby-plugin-webagent)
            'enable_web_agent' => 'boolean',
            'enable_database' => 'boolean',
            'enable_github' => 'boolean',
            'enable_wordpress' => 'boolean',
            'enable_shopify' => 'boolean',
            'enable_api' => 'boolean',
            'enable_code_export' => 'boolean',
            'enable_white_label' => 'boolean',
            'copyright_text' => 'nullable|string|max:1000',
            'max_firecrawl_pages_per_month' => 'nullable|integer|min:0|max:100000',
        ]);

        $plan = Plan::create([
            'name' => $validated['name'],
            'slug' => $this->resolveSlug($validated['slug'] ?? null, $validated['name']),
            'description' => $validated['description'] ?? null,
            'price' => $validated['price'],
            'billing_period' => $validated['billing_period'],
            'features' => $validated['features'] ?? [],
            'is_active' => $validated['is_active'] ?? true,
            'is_popular' => $validated['is_popular'] ?? false,
            'single_use' => $validated['single_use'] ?? false,
            'one_time_credits' => $validated['one_time_credits'] ?? false,
            // Append after the last plan so a new plan doesn't jump to the top
            // of the pricing page until the admin deliberately reorders it.
            'sort_order' => $validated['sort_order'] ?? ((int) Plan::max('sort_order') + 1),
            'ai_provider_id' => $validated['ai_provider_id'] ?? null,
            'fallback_ai_provider_ids' => $validated['fallback_ai_provider_ids'] ?? null,
            'builder_id' => $validated['builder_id'] ?? null,
            'monthly_build_credits' => $validated['monthly_build_credits'] ?? 0,
            'allow_user_ai_api_key' => $validated['allow_user_ai_api_key'] ?? false,
            'max_projects' => $validated['max_projects'] ?? null,
            // Subdomain settings
            'enable_subdomains' => $validated['enable_subdomains'] ?? false,
            'max_subdomains_per_user' => $validated['max_subdomains_per_user'] ?? null,
            'allow_private_visibility' => $validated['allow_private_visibility'] ?? false,
            // Custom domain settings
            'enable_custom_domains' => $validated['enable_custom_domains'] ?? false,
            'max_custom_domains_per_user' => $validated['max_custom_domains_per_user'] ?? null,
            // File storage settings
            'enable_file_storage' => $validated['enable_file_storage'] ?? false,
            'max_storage_mb' => $validated['max_storage_mb'] ?? null,
            'max_file_size_mb' => $validated['max_file_size_mb'] ?? 10,
            'allowed_file_types' => $validated['allowed_file_types'] ?? null,
            // Support tickets
            'enable_support_tickets' => $validated['enable_support_tickets'] ?? false,
            'max_open_tickets_per_user' => $validated['max_open_tickets_per_user'] ?? null,
            // Web agent (webby-plugin-webagent)
            'enable_web_agent' => $validated['enable_web_agent'] ?? false,
            'enable_database' => $validated['enable_database'] ?? false,
            'enable_github' => $validated['enable_github'] ?? false,
            'enable_wordpress' => $validated['enable_wordpress'] ?? false,
            'enable_shopify' => $validated['enable_shopify'] ?? false,
            'enable_api' => $validated['enable_api'] ?? false,
            'enable_code_export' => $validated['enable_code_export'] ?? false,
            // White Label / copyright marking (text sanitized: demo mode exposes admin)
            'enable_white_label' => $validated['enable_white_label'] ?? false,
            'copyright_text' => $this->sanitizedCopyrightText($validated),
            'max_firecrawl_pages_per_month' => $validated['max_firecrawl_pages_per_month'] ?? null,
        ]);

        app(AdminStatsService::class)->clearCache();

        return redirect()->route('admin.plans')->with('success', __('Plan created successfully.'));
    }

    /**
     * Update the specified plan.
     */
    public function update(Request $request, Plan $plan)
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255',
            'description' => 'nullable|string|max:1000',
            'price' => 'required|numeric|min:0',
            'billing_period' => 'required|in:monthly,yearly,lifetime',
            'features' => 'nullable|array',
            'features.*.name' => 'required|string|max:255',
            'features.*.included' => 'required|boolean',
            'is_active' => 'boolean',
            'is_popular' => 'boolean',
            'single_use' => 'boolean',
            'one_time_credits' => 'boolean',
            'sort_order' => 'nullable|integer|min:0',
            'ai_provider_id' => 'nullable|exists:ai_providers,id',
            'fallback_ai_provider_ids' => 'nullable|array',
            'fallback_ai_provider_ids.*' => 'exists:ai_providers,id',
            'builder_id' => 'nullable|exists:builders,id',
            'monthly_build_credits' => 'nullable|integer|min:-1',
            'allow_user_ai_api_key' => 'boolean',
            'max_projects' => 'nullable|integer|min:0',
            // Subdomain settings
            'enable_subdomains' => 'boolean',
            'max_subdomains_per_user' => 'nullable|integer|min:0',
            'allow_private_visibility' => 'boolean',
            // Custom domain settings
            'enable_custom_domains' => 'boolean',
            'max_custom_domains_per_user' => 'nullable|integer|min:0',
            // File storage settings
            'enable_file_storage' => 'boolean',
            'max_storage_mb' => 'nullable|integer|min:0',
            'max_file_size_mb' => 'nullable|integer|min:1|max:500',
            'allowed_file_types' => 'nullable|array',
            'allowed_file_types.*' => 'string',
            // Support tickets
            'enable_support_tickets' => 'boolean',
            'max_open_tickets_per_user' => 'nullable|integer|min:0',
            // Web agent (webby-plugin-webagent)
            'enable_web_agent' => 'boolean',
            'enable_database' => 'boolean',
            'enable_github' => 'boolean',
            'enable_wordpress' => 'boolean',
            'enable_shopify' => 'boolean',
            'enable_api' => 'boolean',
            'enable_code_export' => 'boolean',
            'enable_white_label' => 'boolean',
            'copyright_text' => 'nullable|string|max:1000',
            'max_firecrawl_pages_per_month' => 'nullable|integer|min:0|max:100000',
        ]);

        $plan->update([
            'name' => $validated['name'],
            // The edit form pre-fills the current slug, so renaming a plan no
            // longer silently rewrites it; clearing the field regenerates one.
            'slug' => $this->resolveSlug($validated['slug'] ?? null, $validated['name'], $plan->id),
            'description' => $validated['description'] ?? null,
            'price' => $validated['price'],
            'billing_period' => $validated['billing_period'],
            'features' => $validated['features'] ?? [],
            'is_active' => $validated['is_active'] ?? $plan->is_active,
            'is_popular' => $validated['is_popular'] ?? false,
            'single_use' => $validated['single_use'] ?? false,
            'one_time_credits' => $validated['one_time_credits'] ?? false,
            'sort_order' => $validated['sort_order'] ?? $plan->sort_order,
            'ai_provider_id' => $validated['ai_provider_id'] ?? null,
            'fallback_ai_provider_ids' => $validated['fallback_ai_provider_ids'] ?? null,
            'builder_id' => $validated['builder_id'] ?? null,
            'monthly_build_credits' => $validated['monthly_build_credits'] ?? $plan->monthly_build_credits,
            'allow_user_ai_api_key' => $validated['allow_user_ai_api_key'] ?? false,
            'max_projects' => $validated['max_projects'] ?? null,
            // Subdomain settings
            'enable_subdomains' => $validated['enable_subdomains'] ?? false,
            'max_subdomains_per_user' => $validated['max_subdomains_per_user'] ?? $plan->max_subdomains_per_user,
            'allow_private_visibility' => $validated['allow_private_visibility'] ?? false,
            // Custom domain settings
            'enable_custom_domains' => $validated['enable_custom_domains'] ?? false,
            'max_custom_domains_per_user' => $validated['max_custom_domains_per_user'] ?? $plan->max_custom_domains_per_user,
            // File storage settings
            'enable_file_storage' => $validated['enable_file_storage'] ?? false,
            'max_storage_mb' => $validated['max_storage_mb'] ?? $plan->max_storage_mb,
            'max_file_size_mb' => $validated['max_file_size_mb'] ?? $plan->max_file_size_mb,
            // array_key_exists (not ??) so unchecking all types sends an explicit
            // null and reverts the plan to "allow any" instead of staying sticky.
            'allowed_file_types' => array_key_exists('allowed_file_types', $validated)
                ? $validated['allowed_file_types']
                : $plan->allowed_file_types,
            // Support tickets
            'enable_support_tickets' => $validated['enable_support_tickets'] ?? false,
            'max_open_tickets_per_user' => $validated['max_open_tickets_per_user'] ?? null,
            // Web agent (webby-plugin-webagent)
            'enable_web_agent' => $validated['enable_web_agent'] ?? false,
            'enable_database' => $validated['enable_database'] ?? false,
            'enable_github' => $validated['enable_github'] ?? false,
            'enable_wordpress' => $validated['enable_wordpress'] ?? false,
            'enable_shopify' => $validated['enable_shopify'] ?? false,
            'enable_api' => $validated['enable_api'] ?? false,
            'enable_code_export' => $validated['enable_code_export'] ?? false,
            // White Label / copyright marking (text sanitized: demo mode exposes admin)
            'enable_white_label' => $validated['enable_white_label'] ?? false,
            'copyright_text' => $this->sanitizedCopyrightText($validated),
            'max_firecrawl_pages_per_month' => $validated['max_firecrawl_pages_per_month'] ?? $plan->max_firecrawl_pages_per_month,
        ]);

        app(AdminStatsService::class)->clearCache();

        return redirect()->route('admin.plans')->with('success', __('Plan updated successfully.'));
    }

    /**
     * Resolve the plan's slug. An admin-provided value is normalized and must
     * be free (a duplicate is a validation error they can correct); an empty
     * value is generated from the name and auto-suffixed until unique — the
     * slug column is unique, so a second "Pro" plan would otherwise be a 500.
     */
    private function resolveSlug(?string $provided, string $name, ?int $ignoreId = null): string
    {
        $taken = fn (string $slug) => Plan::where('slug', $slug)
            ->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))
            ->exists();

        // Clamp AFTER normalizing: Str::slug can expand multibyte input
        // ("ß" → "ss", "@" → "at"), so a string that passed max:255
        // validation can still normalize past the column's 255 chars and
        // fail with "Data too long" on MySQL strict mode.
        $normalized = rtrim(Str::limit(Str::slug((string) $provided), 255, ''), '-');

        if ($normalized !== '') {
            if ($taken($normalized)) {
                throw ValidationException::withMessages([
                    'slug' => __('This slug is already used by another plan.'),
                ]);
            }

            return $normalized;
        }

        // Cap the generated base lower so a uniqueness suffix still fits.
        // Strict '' comparison, not falsy: a plan named "0" slugs to "0",
        // which is a valid slug and must not fall through to "plan".
        $base = rtrim(Str::limit(Str::slug($name), 240, ''), '-');
        $base = $base === '' ? 'plan' : $base;
        $slug = $base;
        for ($i = 2; $taken($slug); $i++) {
            $slug = "{$base}-{$i}";
        }

        return $slug;
    }

    /**
     * Sanitize the per-plan copyright badge HTML before persisting. The plan
     * editor is admin-only, but demo mode exposes admin publicly — unsanitized
     * HTML here would be stored XSS injected into exported/published sites.
     */
    private function sanitizedCopyrightText(array $validated): ?string
    {
        $text = trim((string) ($validated['copyright_text'] ?? ''));

        return $text === '' ? null : app(CopyrightMarkService::class)->sanitize($text);
    }

    /**
     * Remove the specified plan.
     */
    public function destroy(Plan $plan)
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        // Check if plan has active subscriptions
        $activeSubscriptions = $plan->subscriptions()->where('status', 'active')->count();

        if ($activeSubscriptions > 0) {
            return back()->withErrors([
                'plan' => __('Cannot delete plan with :count active subscription(s). Please migrate users to another plan first.', ['count' => $activeSubscriptions]),
            ]);
        }

        $soleScopedPacks = CreditPack::whereHas('plans', fn ($q) => $q->whereKey($plan->id))
            ->has('plans', '=', 1)
            ->count();

        $plan->delete();

        app(AdminStatsService::class)->clearCache();

        $message = __('Plan deleted successfully.');
        if ($soleScopedPacks > 0) {
            $message .= ' '.__(':count credit pack(s) scoped only to this plan are now available to all plans.', ['count' => $soleScopedPacks]);
        }

        return back()->with('success', $message);
    }

    /**
     * Toggle the active status of a plan.
     */
    public function toggleStatus(Plan $plan)
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $plan->update([
            'is_active' => ! $plan->is_active,
        ]);

        app(AdminStatsService::class)->clearCache();

        $status = $plan->is_active ? 'activated' : 'deactivated';

        return back()->with('success', __('Plan :status successfully.', ['status' => $status]));
    }

    /**
     * Reorder plans.
     */
    public function reorder(Request $request)
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $request->validate([
            'plans' => 'required|array',
            'plans.*.id' => 'required|exists:plans,id',
            'plans.*.sort_order' => 'required|integer|min:0',
        ]);

        foreach ($request->plans as $planData) {
            Plan::where('id', $planData['id'])->update([
                'sort_order' => $planData['sort_order'],
            ]);
        }

        app(AdminStatsService::class)->clearCache();

        return response()->json(['success' => true]);
    }

    /**
     * Plugin-driven capabilities that should only appear in the plan form
     * when the corresponding plugin is installed and active. Hides toggles
     * for capabilities that no plugin currently provides.
     */
    private function pluginCapabilities(): array
    {
        return app(PluginManager::class)->capabilityPluginStates();
    }
}
