<?php

namespace App\Models;

use App\Traits\ConditionallyVerifiesEmail;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use ConditionallyVerifiesEmail, HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'avatar',
        'role',
        'status',
        'locale',
        'plan_id',
        'build_credits',
        'purchased_build_credits',
        'credits_reset_at',
        'referral_credit_balance',
        'referred_by_user_id',
        'referral_code_id_used',
        'firecrawl_pages_used',
        'firecrawl_pages_reset_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'build_credits' => 'integer',
            'purchased_build_credits' => 'integer',
            'credits_reset_at' => 'datetime',
            'firecrawl_pages_used' => 'integer',
            'firecrawl_pages_reset_at' => 'datetime',
            'referral_credit_balance' => 'decimal:2',
        ];
    }

    /**
     * The primary/super admin account that cannot be deleted or demoted.
     * Always the first registered user (created during installation).
     */
    public const SUPER_ADMIN_ID = 1;

    public function isSuperAdmin(): bool
    {
        return $this->id === self::SUPER_ADMIN_ID;
    }

    public function projects(): HasMany
    {
        return $this->hasMany(Project::class);
    }

    public function supabaseConnections(): HasMany
    {
        return $this->hasMany(SupabaseConnection::class);
    }

    public function githubConnections(): HasMany
    {
        return $this->hasMany(GithubConnection::class);
    }

    public function shopifyConnections(): HasMany
    {
        return $this->hasMany(ShopifyConnection::class);
    }

    public function tickets(): HasMany
    {
        return $this->hasMany(Ticket::class);
    }

    /**
     * Get the user's subscription plan.
     */
    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    public function sharedProjects(): BelongsToMany
    {
        return $this->belongsToMany(Project::class, 'project_shares')
            ->withPivot('permission')
            ->withTimestamps();
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function isUser(): bool
    {
        return $this->role === 'user';
    }

    /**
     * Get all subscriptions for this user.
     */
    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    /**
     * Get the active subscription for this user.
     */
    public function activeSubscription(): HasOne
    {
        return $this->hasOne(Subscription::class)
            ->where('status', Subscription::STATUS_ACTIVE)
            ->latest();
    }

    /**
     * Whether the user has ever subscribed to a plan, in any status
     * (pending/active/cancelled/expired). Used to enforce single-use plans.
     */
    public function hasEverSubscribedTo(Plan $plan): bool
    {
        return $this->subscriptions()->where('plan_id', $plan->id)->exists();
    }

    /**
     * Get all transactions for this user.
     */
    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    /**
     * Check if user has an active subscription.
     */
    public function hasActiveSubscription(): bool
    {
        return $this->subscriptions()
            ->where('status', Subscription::STATUS_ACTIVE)
            ->exists();
    }

    /**
     * Check if user has a pending subscription (awaiting approval).
     */
    public function hasPendingSubscription(): bool
    {
        return $this->subscriptions()
            ->where('status', Subscription::STATUS_PENDING)
            ->exists();
    }

    /**
     * Get the current plan through active subscription.
     * Falls back to direct plan relationship if no subscription.
     */
    public function getCurrentPlan(): ?Plan
    {
        $activeSubscription = $this->activeSubscription;

        if ($activeSubscription) {
            return $activeSubscription->plan;
        }

        return $this->plan;
    }

    /**
     * Get user consents.
     */
    public function consents(): HasMany
    {
        return $this->hasMany(UserConsent::class);
    }

    /**
     * Get data export requests.
     */
    public function dataExportRequests(): HasMany
    {
        return $this->hasMany(DataExportRequest::class);
    }

    /**
     * Get account deletion requests.
     */
    public function accountDeletionRequests(): HasMany
    {
        return $this->hasMany(AccountDeletionRequest::class);
    }

    /**
     * Get audit logs for this user.
     */
    public function auditLogs(): HasMany
    {
        return $this->hasMany(AuditLog::class);
    }

    /**
     * Get user's AI settings.
     */
    public function aiSettings(): HasOne
    {
        return $this->hasOne(UserAiSettings::class);
    }

    /**
     * Get build credit usage records.
     */
    public function buildCreditUsage(): HasMany
    {
        return $this->hasMany(BuildCreditUsage::class);
    }

    // ============================================
    // Build Credits Methods
    // ============================================

    /**
     * Check if user has unlimited build credits.
     */
    public function hasUnlimitedCredits(): bool
    {
        $plan = $this->getCurrentPlan();

        return $plan && $plan->hasUnlimitedBuildCredits();
    }

    /**
     * Check if user has enough build credits.
     */
    public function hasBuildCredits(int $required = 1): bool
    {
        if ($this->hasUnlimitedCredits()) {
            return true;
        }

        return $this->getRemainingBuildCredits() >= $required;
    }

    /**
     * Deduct build credits from the user.
     */
    public function deductBuildCredits(int $amount): int
    {
        if ($this->hasUnlimitedCredits()) {
            return $amount;
        }

        $fromMonthly = min($amount, max(0, $this->build_credits));
        if ($fromMonthly > 0) {
            $this->decrement('build_credits', $fromMonthly);
        }

        $fromPurchased = min($amount - $fromMonthly, max(0, $this->purchased_build_credits));
        if ($fromPurchased > 0) {
            $this->decrement('purchased_build_credits', $fromPurchased);
        }

        return $fromMonthly + $fromPurchased;
    }

    /**
     * Grant purchased build credits (one-time top-up). Never reset by the
     * monthly refill — see refillBuildCredits().
     */
    public function addPurchasedCredits(int $amount): void
    {
        if ($amount <= 0) {
            return;
        }

        $this->increment('purchased_build_credits', $amount);
    }

    /**
     * Remove purchased credits (e.g. on refund), floored at zero so the
     * balance never goes negative.
     */
    public function clawbackPurchasedCredits(int $amount): void
    {
        if ($amount <= 0) {
            return;
        }

        DB::transaction(function () use ($amount) {
            $fresh = static::whereKey($this->getKey())->lockForUpdate()->first();
            if (! $fresh) {
                return;
            }

            $newBalance = max(0, $fresh->purchased_build_credits - $amount);
            $fresh->updateQuietly(['purchased_build_credits' => $newBalance]);
            $this->purchased_build_credits = $newBalance; // keep the in-memory instance in sync
        });
    }

    /**
     * Get remaining build credits.
     */
    public function getRemainingBuildCredits(): int
    {
        if ($this->hasUnlimitedCredits()) {
            return PHP_INT_MAX;
        }

        return max(0, $this->build_credits) + max(0, $this->purchased_build_credits);
    }

    /**
     * Credit limit to hand the builder for mid-build enforcement.
     *
     * Returns 0 ("no limit" — the builder's unlimited sentinel) for users who
     * must never be capped mid-build: BYOK users (they use their own key and
     * are never charged credits) and unlimited-plan users. Everyone else gets
     * their real remaining balance so the builder stops a runaway build.
     */
    public function getBuilderCreditLimit(): int
    {
        if ($this->isUsingOwnAiApiKey() || $this->hasUnlimitedCredits()) {
            return 0;
        }

        return $this->getRemainingBuildCredits();
    }

    /**
     * Get monthly build credit allocation from plan.
     */
    public function getMonthlyBuildCreditsAllocation(): int
    {
        $plan = $this->getCurrentPlan();

        if (! $plan) {
            return 0;
        }

        return $plan->getMonthlyBuildCredits();
    }

    /**
     * Refill build credits based on plan (for monthly reset).
     */
    public function refillBuildCredits(): void
    {
        $plan = $this->getCurrentPlan();

        if (! $plan) {
            return;
        }

        if ($plan->hasUnlimitedBuildCredits()) {
            return;
        }

        $this->updateQuietly([
            'build_credits' => $plan->getMonthlyBuildCredits(),
            'credits_reset_at' => now(),
        ]);
    }

    /**
     * Reset the monthly Firecrawl page counter. Runs regardless of build-credit
     * policy — unlimited-credit plans still have a separate Firecrawl cap that
     * needs a monthly reset.
     */
    public function resetFirecrawlQuota(): void
    {
        $this->updateQuietly([
            'firecrawl_pages_used' => 0,
            'firecrawl_pages_reset_at' => now(),
        ]);
    }

    /**
     * True if the user's monthly Firecrawl counter is due for reset
     * (never reset, OR last reset was 28+ days ago).
     */
    public function shouldResetFirecrawlQuota(): bool
    {
        if ($this->firecrawl_pages_reset_at === null) {
            return true;
        }
        if ($this->firecrawl_pages_reset_at->isFuture()) {
            return false;  // Don't reset on clock skew / corrupted timestamps
        }

        return $this->firecrawl_pages_reset_at->diffInDays(now()) >= 28;
    }

    // ============================================
    // Firecrawl Quota Methods
    // ============================================

    /**
     * Pages remaining this billing month.
     * - Returns 0 when plan disables web agent (or quota = 0).
     * - Returns null when plan grants unlimited Firecrawl.
     * - Returns max(0, cap - used) otherwise.
     */
    public function firecrawlPagesRemaining(): ?int
    {
        $plan = $this->getCurrentPlan();
        if (! $plan?->firecrawlEnabled()) {
            return 0;
        }
        if ($plan->hasUnlimitedFirecrawl()) {
            return null;
        }

        return max(0, $plan->getMaxFirecrawlPagesPerMonth() - $this->firecrawl_pages_used);
    }

    /**
     * True if $required pages are available (or quota is unlimited).
     */
    public function hasFirecrawlPagesAvailable(int $required = 1): bool
    {
        $remaining = $this->firecrawlPagesRemaining();

        return $remaining === null || $remaining >= $required;
    }

    /**
     * Atomically increment firecrawl_pages_used by $amount.
     * Returns the new used value.
     */
    public function deductFirecrawlPages(int $amount): int
    {
        $this->refresh();
        $this->increment('firecrawl_pages_used', $amount);

        return $this->fresh()->firecrawl_pages_used;
    }

    // ============================================
    // User AI API Key Methods
    // ============================================

    /**
     * Check if user's plan allows using their own AI API key.
     */
    public function canUseOwnAiApiKey(): bool
    {
        $plan = $this->getCurrentPlan();

        return $plan?->allowsUserAiApiKey() ?? false;
    }

    /**
     * Check if user is currently using their own API key.
     */
    public function isUsingOwnAiApiKey(): bool
    {
        if (! $this->canUseOwnAiApiKey()) {
            return false;
        }

        $settings = $this->aiSettings;

        if (! $settings || $settings->preferred_provider === 'system') {
            return false;
        }

        return $settings->hasApiKeyFor($settings->preferred_provider);
    }

    /**
     * Get user's AI API key for a specific provider.
     */
    public function getAiApiKey(string $provider): ?string
    {
        if (! $this->canUseOwnAiApiKey()) {
            return null;
        }

        return $this->aiSettings?->getApiKeyFor($provider);
    }

    /**
     * Get user's preferred AI provider.
     */
    public function getPreferredAiProvider(): string
    {
        return $this->aiSettings?->preferred_provider ?? 'system';
    }

    /**
     * Get user's preferred AI model.
     */
    public function getPreferredAiModel(): ?string
    {
        return $this->aiSettings?->preferred_model;
    }

    // ============================================
    // Project Limit Methods
    // ============================================

    /**
     * Get the maximum number of projects allowed for this user.
     */
    public function getMaxProjects(): ?int
    {
        $plan = $this->getCurrentPlan();

        return $plan ? $plan->getMaxProjects() : 0;
    }

    /**
     * Check if user has unlimited projects.
     */
    public function hasUnlimitedProjects(): bool
    {
        $plan = $this->getCurrentPlan();

        return $plan && $plan->hasUnlimitedProjects();
    }

    /**
     * Check if user can create more projects.
     */
    public function canCreateMoreProjects(): bool
    {
        if ($this->hasUnlimitedProjects()) {
            return true;
        }

        $max = $this->getMaxProjects();

        if ($max === null || $max === 0) {
            return false;
        }

        $currentCount = $this->projects()->count();

        return $currentCount < $max;
    }

    /**
     * Get remaining project slots.
     */
    public function getRemainingProjectSlots(): int
    {
        if ($this->hasUnlimitedProjects()) {
            return -1;  // -1 represents unlimited
        }

        $max = $this->getMaxProjects();

        if ($max === null || $max === 0) {
            return 0;
        }

        $currentCount = $this->projects()->count();

        return max(0, $max - $currentCount);
    }

    // ============================================
    // Subdomain Methods
    // ============================================

    /**
     * Check if user's plan allows subdomain publishing.
     */
    public function canUseSubdomains(): bool
    {
        $plan = $this->getCurrentPlan();

        return $plan && $plan->subdomainsEnabled();
    }

    /**
     * Check if user can create more subdomains.
     */
    public function canCreateMoreSubdomains(): bool
    {
        if (! $this->canUseSubdomains()) {
            return false;
        }

        $plan = $this->getCurrentPlan();

        if ($plan->hasUnlimitedSubdomains()) {
            return true;
        }

        $max = $plan->getMaxSubdomains();

        if ($max === null || $max === 0) {
            return false;
        }

        $currentCount = $this->projects()->whereNotNull('subdomain')->count();

        return $currentCount < $max;
    }

    /**
     * Check if user's plan allows private visibility.
     */
    public function canUsePrivateVisibility(): bool
    {
        $plan = $this->getCurrentPlan();

        return $plan && $plan->allowsPrivateVisibility();
    }

    /**
     * Get subdomain usage stats.
     */
    public function getSubdomainUsage(): array
    {
        $plan = $this->getCurrentPlan();
        $used = $this->projects()->whereNotNull('subdomain')->count();

        if (! $plan || ! $plan->subdomainsEnabled()) {
            return [
                'used' => $used,
                'limit' => 0,
                'unlimited' => false,
                'remaining' => 0,
            ];
        }

        $unlimited = $plan->hasUnlimitedSubdomains();
        $limit = $unlimited ? null : ($plan->getMaxSubdomains() ?? 0);

        return [
            'used' => $used,
            'limit' => $limit,
            'unlimited' => $unlimited,
            'remaining' => $unlimited ? -1 : max(0, ($limit ?? 0) - $used),
        ];
    }

    // ============================================
    // Custom Domain Methods
    // ============================================

    /**
     * Check if user's plan allows custom domain publishing.
     */
    public function canUseCustomDomains(): bool
    {
        $plan = $this->getCurrentPlan();

        return $plan && $plan->customDomainsEnabled();
    }

    /**
     * Check if user can create more custom domains.
     */
    public function canCreateMoreCustomDomains(): bool
    {
        if (! $this->canUseCustomDomains()) {
            return false;
        }

        $plan = $this->getCurrentPlan();

        if ($plan->hasUnlimitedCustomDomains()) {
            return true;
        }

        $max = $plan->getMaxCustomDomains();

        if ($max === null || $max === 0) {
            return false;
        }

        $currentCount = $this->projects()->whereNotNull('custom_domain')->count();

        return $currentCount < $max;
    }

    /**
     * Get custom domain usage stats.
     */
    public function getCustomDomainUsage(): array
    {
        $plan = $this->getCurrentPlan();
        $used = $this->projects()->whereNotNull('custom_domain')->count();

        if (! $plan || ! $plan->customDomainsEnabled()) {
            return [
                'used' => $used,
                'limit' => 0,
                'unlimited' => false,
                'remaining' => 0,
            ];
        }

        $unlimited = $plan->hasUnlimitedCustomDomains();
        $limit = $unlimited ? null : ($plan->getMaxCustomDomains() ?? 0);

        return [
            'used' => $used,
            'limit' => $limit,
            'unlimited' => $unlimited,
            'remaining' => $unlimited ? -1 : max(0, ($limit ?? 0) - $used),
        ];
    }

    // ============================================
    // Referral Relationships
    // ============================================

    /**
     * Get the user's referral code.
     */
    public function referralCode(): HasOne
    {
        return $this->hasOne(ReferralCode::class);
    }

    /**
     * Get the user who referred this user.
     */
    public function referredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'referred_by_user_id');
    }

    /**
     * Get referrals made by this user (as referrer).
     */
    public function referrals(): HasMany
    {
        return $this->hasMany(Referral::class, 'referrer_id');
    }

    /**
     * Get referral credit transactions.
     */
    public function referralCreditTransactions(): HasMany
    {
        return $this->hasMany(ReferralCreditTransaction::class);
    }

    // ============================================
    // Referral Credit Methods
    // ============================================

    /**
     * Get or create a referral code for this user.
     */
    public function getOrCreateReferralCode(): ReferralCode
    {
        return $this->referralCode ?? ReferralCode::create(['user_id' => $this->id]);
    }

    /**
     * Check if user has enough referral credits.
     */
    public function hasReferralCredits(float $amount = 0.01): bool
    {
        return $this->referral_credit_balance >= $amount;
    }

    /**
     * Add referral credits to the user.
     */
    public function addReferralCredits(float $amount): void
    {
        $this->increment('referral_credit_balance', $amount);
    }

    /**
     * Deduct referral credits from the user.
     */
    public function deductReferralCredits(float $amount): bool
    {
        if ($this->referral_credit_balance < $amount) {
            return false;
        }

        $this->decrement('referral_credit_balance', $amount);

        return true;
    }

    /**
     * Get the referral for this user (as referee).
     */
    public function referral(): HasOne
    {
        return $this->hasOne(Referral::class, 'referee_id');
    }

    // ============================================
    // File Storage Methods
    // ============================================

    /**
     * Check if user's plan allows file storage.
     */
    public function canUseFileStorage(): bool
    {
        $plan = $this->getCurrentPlan();

        return $plan && $plan->fileStorageEnabled();
    }

    /**
     * Get maximum storage in MB.
     */
    public function getMaxStorageMb(): int
    {
        $plan = $this->getCurrentPlan();

        if (! $plan || ! $plan->fileStorageEnabled()) {
            return 0;
        }

        return $plan->getMaxStorageMb() ?? 0;
    }

    /**
     * Get total storage used across all projects in bytes.
     */
    public function getTotalStorageUsedBytes(): int
    {
        return (int) $this->projects()->sum('storage_used_bytes');
    }

    /**
     * Get remaining storage in bytes.
     * Returns -1 for unlimited storage.
     */
    public function getRemainingStorageBytes(): int
    {
        $plan = $this->getCurrentPlan();

        if (! $plan || ! $plan->fileStorageEnabled()) {
            return 0;
        }

        if ($plan->hasUnlimitedStorage()) {
            return -1;
        }

        $maxBytes = ($plan->getMaxStorageMb() ?? 0) * 1024 * 1024;
        $usedBytes = $this->getTotalStorageUsedBytes();

        return max(0, $maxBytes - $usedBytes);
    }

    /**
     * Get storage usage stats.
     */
    public function getStorageUsage(): array
    {
        $plan = $this->getCurrentPlan();
        $usedBytes = $this->getTotalStorageUsedBytes();
        $usedMb = (int) round($usedBytes / (1024 * 1024));

        if (! $plan || ! $plan->fileStorageEnabled()) {
            return [
                'used_bytes' => $usedBytes,
                'used_mb' => $usedMb,
                'limit_mb' => 0,
                'unlimited' => false,
                'remaining_bytes' => 0,
                'percentage' => 0,
            ];
        }

        $unlimited = $plan->hasUnlimitedStorage();
        $limitMb = $unlimited ? null : ($plan->getMaxStorageMb() ?? 0);
        $limitBytes = $limitMb ? $limitMb * 1024 * 1024 : 0;

        return [
            'used_bytes' => $usedBytes,
            'used_mb' => $usedMb,
            'limit_mb' => $limitMb,
            'unlimited' => $unlimited,
            'remaining_bytes' => $unlimited ? -1 : max(0, $limitBytes - $usedBytes),
            'percentage' => $unlimited ? 0 : ($limitBytes > 0 ? (int) round(($usedBytes / $limitBytes) * 100) : 0),
        ];
    }

    // ============================================
    // Locale Methods
    // ============================================

    /**
     * Get the user's preferred language.
     */
    public function language(): BelongsTo
    {
        return $this->belongsTo(Language::class, 'locale', 'code');
    }

    /**
     * Get the user's locale, falling back to system default.
     */
    public function getLocale(): string
    {
        return $this->locale ?? SystemSetting::get('default_locale', 'en');
    }

    /**
     * Check if the user's locale is RTL.
     */
    public function isRtl(): bool
    {
        return $this->language?->is_rtl ?? false;
    }
}
