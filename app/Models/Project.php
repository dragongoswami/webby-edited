<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

class Project extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'user_id',
        'template_id',
        'output_target',
        'name',
        'description',
        'initial_prompt',
        'thumbnail',
        'is_public',
        'is_starred',
        'last_viewed_at',
        'builder_id',
        'build_session_id',
        'build_status',
        'build_path',
        'build_started_at',
        'build_completed_at',
        'conversation_history',
        'compacted_history',
        'estimated_tokens',
        'subdomain',
        'custom_domain',
        'custom_domain_verified',
        'custom_domain_ssl_status',
        'custom_domain_verified_at',
        'published_title',
        'published_description',
        'published_visibility',
        'share_image',
        'published_at',
        'custom_instructions',
        'design_system_id',
        'design_accent',
        'api_token',
        'storage_used_bytes',
        'supabase_schema',
        'supabase_connection_id',
        'github_connection_id',
        'github_repo_owner',
        'github_repo_name',
        'github_repo_id',
        'github_default_branch',
        'github_auto_push',
        'github_repo_private',
        'github_last_pushed_at',
        'github_last_pushed_sha',
        'shopify_connection_id',
        'shopify_theme_id',
        'shopify_store_domain',
    ];

    protected function casts(): array
    {
        return [
            'is_public' => 'boolean',
            'is_starred' => 'boolean',
            'last_viewed_at' => 'datetime',
            'build_started_at' => 'datetime',
            'build_completed_at' => 'datetime',
            'conversation_history' => 'array',
            'compacted_history' => 'array',
            'estimated_tokens' => 'integer',
            'published_at' => 'datetime',
            'custom_domain_verified' => 'boolean',
            'custom_domain_verified_at' => 'datetime',
            'storage_used_bytes' => 'integer',
            'github_auto_push' => 'boolean',
            'github_repo_private' => 'boolean',
            'github_repo_id' => 'integer',
            'github_last_pushed_at' => 'datetime',
            // Some drivers return FK columns as strings while Eloquent casts the
            // owning model's primary key to an int. Cast them so strict (===)
            // owner checks in policies and on the frontend (e.g.
            // project.user_id === auth.user.id) keep working.
            'user_id' => 'integer',
            'supabase_connection_id' => 'integer',
            'github_connection_id' => 'integer',
            // Cast so the strict (!==) "did the store change?" check in
            // ProjectShopifyController::attach holds on MySQL/PostgreSQL, where
            // PDO returns BIGINT FK columns as strings.
            'shopify_connection_id' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Postgres schema for this project's Supabase data. Derived from the UUID, stable. */
    public function getSupabaseSchema(): string
    {
        return $this->supabase_schema ?: 'proj_'.str_replace('-', '', (string) $this->id);
    }

    public function snapshots(): HasMany
    {
        return $this->hasMany(ProjectSnapshot::class);
    }

    public function tickets(): HasMany
    {
        return $this->hasMany(Ticket::class);
    }

    /**
     * Get the template used for this project.
     */
    public function template(): BelongsTo
    {
        return $this->belongsTo(Template::class);
    }

    /**
     * Get the design system applied to this project.
     */
    public function designSystem(): BelongsTo
    {
        return $this->belongsTo(DesignSystem::class);
    }

    /**
     * The BYOD Supabase connection attached to this project (null = no database).
     */
    public function supabaseConnection(): BelongsTo
    {
        return $this->belongsTo(SupabaseConnection::class);
    }

    /**
     * The GitHub connection attached to this project (null = not linked).
     */
    public function githubConnection(): BelongsTo
    {
        return $this->belongsTo(GithubConnection::class);
    }

    /**
     * The Shopify connection attached to this project (null = not linked).
     */
    public function shopifyConnection(): BelongsTo
    {
        return $this->belongsTo(ShopifyConnection::class);
    }

    /**
     * Get the builder assigned to this project.
     */
    public function builder(): BelongsTo
    {
        return $this->belongsTo(Builder::class);
    }

    public function sharedWith(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'project_shares')
            ->withPivot('permission')
            ->withTimestamps();
    }

    public function duplicate(User $user): self
    {
        // Exclude the BYOD database link and the (unique) schema name: the copy
        // belongs to $user, who may differ from the original owner (sharing
        // allows duplicate via 'view'). Carrying these would leak the original
        // owner's Supabase credentials into the copy's builds and collide on
        // the unique supabase_schema. The same applies to the GitHub linkage:
        // carrying it would leak the original owner's connection credentials and
        // silently hand the copy push access to the original owner's repo.
        $newProject = $this->replicate([
            'id', 'created_at', 'updated_at', 'deleted_at',
            'supabase_connection_id', 'supabase_schema',
            'github_connection_id', 'github_repo_owner', 'github_repo_name',
            'github_repo_id', 'github_default_branch', 'github_auto_push',
            'github_repo_private', 'github_last_pushed_at', 'github_last_pushed_sha',
            'shopify_connection_id', 'shopify_theme_id', 'shopify_store_domain',
        ]);
        $newProject->user_id = $user->id;
        $newProject->name = $this->name.' (Copy)';
        $newProject->is_starred = false;
        $newProject->last_viewed_at = now();
        $newProject->save();

        return $newProject;
    }

    /**
     * Append a message to the conversation history.
     *
     * @param  string  $role  The role (user, assistant, action)
     * @param  string  $content  The message content
     * @param  string|null  $category  Optional category for action entries
     * @param  int|null  $thinkingDuration  Optional thinking duration in seconds (for assistant messages)
     */
    public function appendToHistory(string $role, string $content, ?string $category = null, ?int $thinkingDuration = null, ?array $files = null): void
    {
        $history = $this->conversation_history ?? [];
        $entry = [
            'role' => $role,
            'content' => $content,
            'timestamp' => now()->toISOString(),
        ];

        // Add file references for user messages with attached files
        if ($files !== null && count($files) > 0) {
            $entry['files'] = $files;
        }

        // Add category for action events
        if ($category !== null) {
            $entry['category'] = $category;
        }

        // Add thinking duration for assistant messages
        if ($thinkingDuration !== null && $role === 'assistant') {
            $entry['thinking_duration'] = $thinkingDuration;
        }

        $history[] = $entry;

        // Update estimated tokens (rough estimate: ~4 chars per token)
        $estimatedTokens = (int) ceil(strlen($content) / 4);

        // Invalidate compacted history when new messages are added
        // (compacted history becomes stale with new conversation turns)
        $updateData = [
            'conversation_history' => $history,
            'estimated_tokens' => ($this->estimated_tokens ?? 0) + $estimatedTokens,
        ];

        // Clear compacted history if it exists (new messages make it stale)
        if (! empty($this->compacted_history)) {
            $updateData['compacted_history'] = null;
        }

        $this->update($updateData);
    }

    /**
     * Get the timestamp of the last user message.
     */
    public function getLastUserMessageTimestamp(): ?Carbon
    {
        $history = $this->conversation_history ?? [];

        // Find the last user message
        for ($i = count($history) - 1; $i >= 0; $i--) {
            if ($history[$i]['role'] === 'user' && isset($history[$i]['timestamp'])) {
                return Carbon::parse($history[$i]['timestamp']);
            }
        }

        return null;
    }

    /**
     * Get conversation history formatted for the builder API.
     * Filters out action entries - AI only needs user/assistant messages.
     *
     * @return array<array{role: string, content: string}>
     */
    public function getHistoryForBuilder(): array
    {
        $history = $this->conversation_history ?? [];

        return array_values(array_filter(
            array_map(function ($message) {
                // Only include user and assistant messages for AI context
                if ($message['role'] === 'user' || $message['role'] === 'assistant') {
                    $entry = [
                        'role' => $message['role'],
                        'content' => $message['content'],
                    ];

                    // Degrade file references to text for builder context
                    if (! empty($message['files'])) {
                        $names = implode(', ', array_column($message['files'], 'filename'));
                        $entry['content'] .= "\n[Referenced files: {$names}]";
                    }

                    return $entry;
                }

                return null;
            }, $history),
            fn ($item) => $item !== null
        ));
    }

    /**
     * Clear the conversation history.
     */
    public function clearHistory(): void
    {
        $this->update([
            'conversation_history' => null,
            'compacted_history' => null,
            'estimated_tokens' => 0,
        ]);
    }

    /**
     * Get the last N messages from history.
     */
    public function getRecentHistory(int $count = 10): array
    {
        $history = $this->conversation_history ?? [];

        return array_slice($history, -$count);
    }

    /**
     * Get history to send to builder, preferring compacted if available.
     * Prepends custom instructions as a system message if available.
     * Returns array with 'history' and 'is_compacted' keys.
     *
     * @return array{history: array, is_compacted: bool}
     */
    public function getHistoryForBuilderOptimized(): array
    {
        $history = [];
        $isCompacted = false;

        // If compacted history exists, use it (already summarized by builder)
        if (! empty($this->compacted_history)) {
            $history = $this->compacted_history;
            $isCompacted = true;
        } else {
            $history = $this->getHistoryForBuilder();
        }

        // Prepend custom instructions as system message
        if (! empty($this->custom_instructions)) {
            array_unshift($history, [
                'role' => 'system',
                'content' => "Custom instructions from user:\n{$this->custom_instructions}",
            ]);
        }

        return [
            'history' => $history,
            'is_compacted' => $isCompacted,
        ];
    }

    /**
     * Store compacted history received from builder.
     *
     * @param  array  $compactedHistory  The compacted history array from builder
     */
    public function storeCompactedHistory(array $compactedHistory): void
    {
        $this->update([
            'compacted_history' => $compactedHistory,
        ]);
    }

    /**
     * Clear compacted history (call when full history is modified manually).
     */
    public function clearCompactedHistory(): void
    {
        $this->update([
            'compacted_history' => null,
        ]);
    }

    // ============================================
    // Publishing Methods
    // ============================================

    /**
     * Whether this project generates a WordPress block theme (a downloadable
     * artifact) rather than a hosted website. Theme projects have no
     * publishing, domains, Supabase backend, GitHub repo, or design re-theme.
     */
    public function isWordPressTheme(): bool
    {
        return ($this->output_target ?? 'website') === 'wordpress_theme';
    }

    /**
     * Whether this project generates a Shopify theme (a downloadable artifact,
     * optionally pushed to the owner's own store) rather than a hosted website.
     * Theme projects have no publishing, domains, Supabase backend, GitHub repo,
     * or design re-theme — mirrors isWordPressTheme().
     */
    public function isShopifyTheme(): bool
    {
        return ($this->output_target ?? 'website') === 'shopify_theme';
    }

    /**
     * Check if project is published (has subdomain and published_at).
     */
    public function isPublished(): bool
    {
        return $this->subdomain !== null && $this->published_at !== null;
    }

    /**
     * Check if project is publicly accessible.
     */
    public function isPubliclyAccessible(): bool
    {
        return $this->isPublished() && $this->published_visibility === 'public';
    }

    /**
     * Get the published URL for this project.
     */
    public function getPublishedUrl(): ?string
    {
        if (! $this->subdomain) {
            return null;
        }

        $baseDomain = SystemSetting::get('domain_base_domain');
        if (! $baseDomain) {
            return null;
        }

        $scheme = app()->environment('local') ? 'http' : 'https';

        return "{$scheme}://{$this->subdomain}.{$baseDomain}";
    }

    // ============================================
    // Custom Domain Methods
    // ============================================

    /**
     * Check if project has a verified custom domain.
     */
    public function hasVerifiedCustomDomain(): bool
    {
        return $this->custom_domain !== null && $this->custom_domain_verified;
    }

    /**
     * Check if custom domain is active (verified and SSL ready).
     */
    public function isCustomDomainActive(): bool
    {
        if (! $this->hasVerifiedCustomDomain()) {
            return false;
        }

        // Active if SSL is active or manual (user-managed)
        $sslStatus = $this->custom_domain_ssl_status;

        return $sslStatus === 'active' || $sslStatus === null;
    }

    /**
     * Get the custom domain URL for this project.
     */
    public function getCustomDomainUrl(): ?string
    {
        if (! $this->isCustomDomainActive()) {
            return null;
        }

        $scheme = app()->environment('local') ? 'http' : 'https';

        return "{$scheme}://{$this->custom_domain}";
    }

    /**
     * Get the public URL for this project.
     * Returns custom domain if active, otherwise subdomain URL.
     */
    public function getPublicUrl(): ?string
    {
        // Prefer custom domain if active
        $customUrl = $this->getCustomDomainUrl();
        if ($customUrl) {
            return $customUrl;
        }

        // Fall back to subdomain
        return $this->getPublishedUrl();
    }

    // ============================================
    // API Token Methods
    // ============================================

    /**
     * Generate a new API token for this project.
     */
    public function generateApiToken(): string
    {
        $token = bin2hex(random_bytes(32));
        $this->update(['api_token' => $token]);

        return $token;
    }

    /**
     * Regenerate the API token, invalidating the old one.
     */
    public function regenerateApiToken(): string
    {
        return $this->generateApiToken();
    }

    /**
     * Revoke the API token.
     */
    public function revokeApiToken(): void
    {
        $this->update(['api_token' => null]);
    }

    /**
     * Check if the project has an API token.
     */
    public function hasApiToken(): bool
    {
        return $this->api_token !== null;
    }

    // ============================================
    // File Storage Methods
    // ============================================

    /**
     * Get all files for this project.
     */
    public function files(): HasMany
    {
        return $this->hasMany(ProjectFile::class);
    }

    /**
     * Check if project has storage available for the given size.
     */
    public function hasStorageAvailable(int $bytes): bool
    {
        $user = $this->user;

        if (! $user) {
            return false;
        }

        $plan = $user->getCurrentPlan();

        if (! $plan || ! $plan->fileStorageEnabled()) {
            return false;
        }

        if ($plan->hasUnlimitedStorage()) {
            return true;
        }

        $remainingBytes = $user->getRemainingStorageBytes();

        return $remainingBytes >= $bytes;
    }

    /**
     * Increment the storage used for this project.
     */
    public function incrementStorageUsed(int $bytes): void
    {
        $this->increment('storage_used_bytes', $bytes);
    }

    /**
     * Decrement the storage used for this project.
     */
    public function decrementStorageUsed(int $bytes): void
    {
        $bytes = max(0, $bytes);

        // Atomic, clamped-at-zero decrement so concurrent deletes can't drift the
        // counter (read-modify-write would lose one of two simultaneous updates).
        // CASE expression is portable across MySQL and SQLite (no GREATEST()).
        $this->newQuery()
            ->whereKey($this->getKey())
            ->update([
                'storage_used_bytes' => DB::raw("CASE WHEN storage_used_bytes < {$bytes} THEN 0 ELSE storage_used_bytes - {$bytes} END"),
            ]);

        $this->refresh();
    }

    /**
     * Detect if the new prompt is similar to recent user prompts.
     *
     * @param  string  $newPrompt  The incoming prompt
     * @param  int  $lookbackCount  Number of recent user messages to check
     * @return array{count: int, prompts: string[]}|null Null if no repetition detected
     */
    public function detectRepeatedPrompts(string $newPrompt, int $lookbackCount = 5): ?array
    {
        $history = $this->conversation_history ?? [];

        // Filter to user messages only
        $userMessages = array_values(array_filter($history, fn ($entry) => ($entry['role'] ?? '') === 'user'));

        // Take the most recent N user messages
        $recent = array_slice($userMessages, -$lookbackCount);

        $similarPrompts = [];
        foreach ($recent as $entry) {
            $content = $entry['content'] ?? '';
            if (self::arePromptsSimilar($newPrompt, $content)) {
                $similarPrompts[] = $content;
            }
        }

        if (count($similarPrompts) >= 2) {
            return [
                'count' => count($similarPrompts),
                'prompts' => $similarPrompts,
            ];
        }

        return null;
    }

    /**
     * Normalize text for similarity comparison.
     */
    public static function normalizeForComparison(string $text): string
    {
        $text = mb_strtolower(trim($text));
        // Remove common filler words
        $fillers = ['please', 'can', 'you', 'the', 'a', 'an', 'is', 'it', 'to', 'my', 'i', 'me', 'this', 'that', 'do', 'does', 'did', 'just', 'still', 'not', 'doesn\'t', 'don\'t', 'isn\'t', 'again'];
        $words = preg_split('/\s+/', $text);
        $words = array_filter($words, fn ($w) => strlen($w) > 2 && ! in_array($w, $fillers));

        return implode(' ', array_values($words));
    }

    /**
     * Check if two prompts are similar using Jaccard similarity on keyword sets.
     */
    public static function arePromptsSimilar(string $a, string $b, float $threshold = 0.5): bool
    {
        $normalizedA = self::normalizeForComparison($a);
        $normalizedB = self::normalizeForComparison($b);

        $setA = array_unique(preg_split('/\s+/', $normalizedA));
        $setB = array_unique(preg_split('/\s+/', $normalizedB));

        // Filter out empty strings
        $setA = array_filter($setA, fn ($w) => $w !== '');
        $setB = array_filter($setB, fn ($w) => $w !== '');

        if (empty($setA) || empty($setB)) {
            return false;
        }

        $intersection = count(array_intersect($setA, $setB));
        $union = count(array_unique(array_merge($setA, $setB)));

        if ($union === 0) {
            return false;
        }

        return ($intersection / $union) >= $threshold;
    }
}
