<?php

namespace App\Models;

use App\Services\PluginManager;
use App\Services\ShopifyService;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Plan extends Model
{
    use HasFactory;

    /**
     * Columns the public pricing surfaces select: everything
     * resources/js/lib/planFeatures.ts derives feature lines from, plus the
     * card's own display fields. Shared by the landing route and the landing
     * preview so their column lists can never drift apart — an omitted
     * capability column arrives null and renders as "✗" on the pricing card
     * even when the plan enables it.
     */
    public const PRICING_COLUMNS = [
        'id', 'name', 'slug', 'description', 'price', 'billing_period',
        'features', 'is_popular', 'max_projects', 'monthly_build_credits',
        'one_time_credits', 'allow_user_ai_api_key',
        'enable_subdomains', 'max_subdomains_per_user',
        'enable_custom_domains', 'max_custom_domains_per_user',
        'allow_private_visibility', 'enable_database', 'enable_code_export',
        'enable_api', 'enable_github', 'enable_wordpress', 'enable_shopify',
        'enable_web_agent', 'enable_white_label',
    ];

    /**
     * The attributes that are mass assignable.
     *
     * Note: The 'features' field is for display purposes only (marketing/UI).
     * It shows what features are included in the plan but does not enforce
     * any functional restrictions. Actual limits are enforced by dedicated
     * fields like max_projects, monthly_build_credits, etc.
     */
    protected $fillable = [
        'name',
        'slug',
        'description',
        'price',
        'billing_period',
        'features',
        'is_active',
        'is_popular',
        'single_use',
        'one_time_credits',
        'sort_order',
        'ai_provider_id',
        'fallback_ai_provider_ids',
        'builder_id',
        'monthly_build_credits',
        'allow_user_ai_api_key',
        'max_projects',
        'enable_subdomains',
        'max_subdomains_per_user',
        'allow_private_visibility',
        'enable_custom_domains',
        'max_custom_domains_per_user',
        'enable_file_storage',
        'max_storage_mb',
        'max_file_size_mb',
        'allowed_file_types',
        'enable_support_tickets',
        'max_open_tickets_per_user',
        'enable_web_agent',
        'max_firecrawl_pages_per_month',
        'enable_database',
        'enable_code_export',
        'enable_github',
        'enable_wordpress',
        'enable_shopify',
        'enable_api',
        'enable_white_label',
        'copyright_text',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'features' => 'array',
            'fallback_ai_provider_ids' => 'array',
            'is_active' => 'boolean',
            'is_popular' => 'boolean',
            'single_use' => 'boolean',
            'one_time_credits' => 'boolean',
            'monthly_build_credits' => 'integer',
            'sort_order' => 'integer',
            'allow_user_ai_api_key' => 'boolean',
            'max_projects' => 'integer',
            'enable_subdomains' => 'boolean',
            'max_subdomains_per_user' => 'integer',
            'allow_private_visibility' => 'boolean',
            'enable_custom_domains' => 'boolean',
            'max_custom_domains_per_user' => 'integer',
            'enable_file_storage' => 'boolean',
            'max_storage_mb' => 'integer',
            'max_file_size_mb' => 'integer',
            'allowed_file_types' => 'array',
            'enable_support_tickets' => 'boolean',
            'enable_web_agent' => 'boolean',
            'max_open_tickets_per_user' => 'integer',
            'max_firecrawl_pages_per_month' => 'integer',
            'enable_database' => 'boolean',
            'enable_code_export' => 'boolean',
            'enable_github' => 'boolean',
            'enable_wordpress' => 'boolean',
            'enable_shopify' => 'boolean',
            'enable_api' => 'boolean',
            'enable_white_label' => 'boolean',
        ];
    }

    /**
     * Get all users on this plan.
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /**
     * Scope: Active plans only.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Get all subscriptions for this plan.
     */
    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    /**
     * Get count of active subscribers. Honors a value preloaded via
     * withCount() (the admin index does this) instead of re-querying —
     * otherwise serialization runs one COUNT per plan on top of the
     * eager count it already paid for.
     */
    public function getActiveSubscribersCountAttribute(?int $value): int
    {
        return $value ?? $this->subscriptions()
            ->where('status', Subscription::STATUS_ACTIVE)
            ->count();
    }

    /**
     * Get the primary AI provider for this plan.
     */
    public function aiProvider(): BelongsTo
    {
        return $this->belongsTo(AiProvider::class);
    }

    /**
     * Get the primary builder for this plan.
     */
    public function builder(): BelongsTo
    {
        return $this->belongsTo(Builder::class);
    }

    /**
     * Get the templates available for this plan.
     */
    public function templates(): BelongsToMany
    {
        return $this->belongsToMany(Template::class, 'plan_template');
    }

    /**
     * Get the credit packs available for this plan.
     */
    public function creditPacks(): BelongsToMany
    {
        return $this->belongsToMany(CreditPack::class, 'credit_pack_plan');
    }

    /**
     * Get an active AI provider for this plan, with fallback support.
     * Returns the primary provider if active, otherwise tries fallbacks in order,
     * then the system default provider from settings.
     * Returns null if no provider can be resolved.
     */
    public function getAiProviderWithFallbacks(): ?AiProvider
    {
        // Try primary provider
        if ($this->aiProvider && $this->aiProvider->status === 'active') {
            return $this->aiProvider;
        }

        // Try fallback providers in order
        if (! empty($this->fallback_ai_provider_ids)) {
            foreach ($this->fallback_ai_provider_ids as $providerId) {
                $provider = AiProvider::find($providerId);
                if ($provider && $provider->status === 'active') {
                    return $provider;
                }
            }
        }

        // Try system default from settings
        $defaultId = SystemSetting::get('default_ai_provider_id');
        if ($defaultId) {
            $provider = AiProvider::find($defaultId);
            if ($provider && $provider->status === 'active') {
                return $provider;
            }
        }

        return null;
    }

    /**
     * Get an active builder for this plan.
     * Returns the primary builder if active, otherwise falls back to
     * the system default builder.
     * Returns null if no builder can be resolved.
     */
    public function getBuilderWithFallbacks(): ?Builder
    {
        // Try primary builder
        if ($this->builder && $this->builder->status === 'active') {
            return $this->builder;
        }

        // Try system default from settings
        $defaultId = SystemSetting::get('default_builder_id');
        if ($defaultId) {
            $builder = Builder::find($defaultId);
            if ($builder && $builder->status === 'active') {
                return $builder;
            }
        }

        return null;
    }

    /**
     * Get the AI provider description for display.
     */
    public function getAiProviderDescriptionAttribute(): string
    {
        if ($this->aiProvider) {
            $fallbackCount = count($this->fallback_ai_provider_ids ?? []);
            if ($fallbackCount > 0) {
                return "{$this->aiProvider->name} (+{$fallbackCount} ".trans_choice('fallback|fallbacks', $fallbackCount).')';
            }

            return $this->aiProvider->name;
        }

        return __('System Default');
    }

    /**
     * Get the builder description for display.
     */
    public function getBuilderDescriptionAttribute(): string
    {
        return $this->builder?->name ?? __('System Default');
    }

    // ============================================
    // Build Credits Methods
    // ============================================

    /**
     * Get monthly build credits allocation.
     */
    public function getMonthlyBuildCredits(): int
    {
        return $this->monthly_build_credits ?? 0;
    }

    /**
     * Check if plan has unlimited build credits.
     */
    public function hasUnlimitedBuildCredits(): bool
    {
        return $this->monthly_build_credits === -1;
    }

    // ============================================
    // User AI API Key Methods
    // ============================================

    /**
     * Check if plan allows users to use their own AI API key.
     */
    public function allowsUserAiApiKey(): bool
    {
        return $this->allow_user_ai_api_key ?? false;
    }

    // ============================================
    // Project Limit Methods
    // ============================================

    /**
     * Get the maximum number of projects allowed for this plan.
     */
    public function getMaxProjects(): ?int
    {
        return $this->max_projects;
    }

    /**
     * Check if plan has unlimited projects.
     */
    public function hasUnlimitedProjects(): bool
    {
        return $this->max_projects === null;
    }

    // ============================================
    // Subdomain Methods
    // ============================================

    /**
     * Check if plan allows subdomain publishing.
     */
    public function subdomainsEnabled(): bool
    {
        return $this->enable_subdomains ?? false;
    }

    /**
     * Get maximum subdomains per user.
     */
    public function getMaxSubdomains(): ?int
    {
        return $this->max_subdomains_per_user;
    }

    /**
     * Check if plan has unlimited subdomains.
     */
    public function hasUnlimitedSubdomains(): bool
    {
        return $this->enable_subdomains && $this->max_subdomains_per_user === null;
    }

    /**
     * Check if plan allows private visibility.
     */
    public function allowsPrivateVisibility(): bool
    {
        return $this->allow_private_visibility ?? false;
    }

    // ============================================
    // Custom Domain Methods
    // ============================================

    /**
     * Check if plan allows custom domain publishing.
     */
    public function customDomainsEnabled(): bool
    {
        return $this->enable_custom_domains ?? false;
    }

    /**
     * Get maximum custom domains per user.
     */
    public function getMaxCustomDomains(): ?int
    {
        return $this->max_custom_domains_per_user;
    }

    /**
     * Check if plan has unlimited custom domains.
     */
    public function hasUnlimitedCustomDomains(): bool
    {
        return $this->customDomainsEnabled() && $this->max_custom_domains_per_user === null;
    }

    // ============================================
    // File Storage Methods
    // ============================================

    /**
     * Check if plan allows file storage.
     */
    public function fileStorageEnabled(): bool
    {
        return $this->enable_file_storage ?? false;
    }

    // ============================================
    // Web Agent Methods
    // ============================================

    /**
     * Check if plan + installed plugin both allow the web agent capability.
     */
    public function webAgentEnabled(): bool
    {
        return app(PluginManager::class)->isActive('webagent')
            && ($this->enable_web_agent ?? false);
    }

    /** Whether this plan allows database-backed (Supabase) projects. */
    public function databaseEnabled(): bool
    {
        return (bool) ($this->enable_database ?? false);
    }

    /** Whether this plan allows exporting/downloading the project source code. */
    public function codeExportEnabled(): bool
    {
        return (bool) ($this->enable_code_export ?? false);
    }

    /**
     * Check if plan + installed plugin both allow the GitHub capability.
     */
    public function githubEnabled(): bool
    {
        return app(PluginManager::class)->isActive('github')
            && ($this->enable_github ?? false);
    }

    /**
     * Check if plan + installed plugin both allow generating WordPress themes.
     */
    public function wordpressEnabled(): bool
    {
        return app(PluginManager::class)->isActive('wordpress')
            && ($this->enable_wordpress ?? false);
    }

    /**
     * Check if plan + installed plugin both allow generating Shopify themes.
     */
    public function shopifyEnabled(): bool
    {
        return app(PluginManager::class)->isActive('shopify')
            && ($this->enable_shopify ?? false);
    }

    /**
     * Whether the BYOS store-connection surface (the /shopify connect page,
     * per-project store picker, OAuth routes and auto-push) is available.
     * Requires Shopify theme generation AND the operator-level "Enable store
     * connections" toggle (with OAuth credentials). When false the plugin
     * still generates + downloads themes — it just runs download-only.
     */
    public function shopifyConnectEnabled(): bool
    {
        return $this->shopifyEnabled()
            && app(ShopifyService::class)->storeConnectionsEnabled();
    }

    /** Whether this plan allows the read-only user API (personal API keys). */
    public function apiEnabled(): bool
    {
        return (bool) ($this->enable_api ?? false);
    }

    /**
     * White Label: when enabled, artifacts leaving the platform (code exports,
     * GitHub pushes, published sites, WordPress themes) carry no copyright
     * mark. Plain plan flag — not plugin-gated.
     */
    public function whitelabelEnabled(): bool
    {
        return (bool) $this->enable_white_label;
    }

    /**
     * Check if plan + plugin allow Firecrawl usage. Master gate is webAgentEnabled();
     * quota gate: NULL = unlimited, 0 = blocked, N > 0 = enabled with cap.
     */
    public function firecrawlEnabled(): bool
    {
        if (! $this->webAgentEnabled()) {
            return false;
        }

        return $this->max_firecrawl_pages_per_month === null
            || $this->max_firecrawl_pages_per_month > 0;
    }

    /**
     * Get the per-month Firecrawl page cap (null = unlimited).
     */
    public function getMaxFirecrawlPagesPerMonth(): ?int
    {
        return $this->max_firecrawl_pages_per_month;
    }

    /**
     * Check if this plan grants unlimited Firecrawl usage.
     */
    public function hasUnlimitedFirecrawl(): bool
    {
        return $this->firecrawlEnabled() && $this->max_firecrawl_pages_per_month === null;
    }

    /**
     * Get maximum storage in MB.
     */
    public function getMaxStorageMb(): ?int
    {
        return $this->max_storage_mb;
    }

    /**
     * Check if plan has unlimited storage.
     */
    public function hasUnlimitedStorage(): bool
    {
        return $this->fileStorageEnabled() && $this->max_storage_mb === null;
    }

    /**
     * Get maximum file size in MB.
     */
    public function getMaxFileSizeMb(): int
    {
        return $this->max_file_size_mb ?? 10;
    }

    /**
     * Get allowed file types.
     */
    public function getAllowedFileTypes(): ?array
    {
        return $this->allowed_file_types;
    }

    /**
     * Get the billing interval unit and count derived from billing_period.
     */
    public function getBillingInterval(): array
    {
        return match ($this->billing_period) {
            'yearly' => ['interval_unit' => 'year', 'interval_count' => 1],
            'lifetime' => ['interval_unit' => 'year', 'interval_count' => 100],
            default => ['interval_unit' => 'month', 'interval_count' => 1],
        };
    }
}
