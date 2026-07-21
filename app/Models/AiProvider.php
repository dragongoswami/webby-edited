<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Http;

class AiProvider extends Model
{
    use HasFactory;

    const TYPE_OPENAI = 'openai';

    const TYPE_ANTHROPIC = 'anthropic';

    const TYPE_GROK = 'grok';

    const TYPE_DEEPSEEK = 'deepseek';

    const TYPE_ZHIPU = 'zhipu';

    const TYPE_OLLAMA = 'ollama';

    const TYPE_OPENROUTER = 'openrouter';

    const TYPES = [
        self::TYPE_OPENAI => 'OpenAI',
        self::TYPE_ANTHROPIC => 'Anthropic',
        self::TYPE_GROK => 'Grok',
        self::TYPE_DEEPSEEK => 'DeepSeek',
        self::TYPE_ZHIPU => 'ZhipuAI',
        self::TYPE_OLLAMA => 'Ollama Cloud',
        self::TYPE_OPENROUTER => 'OpenRouter',
    ];

    const DEFAULT_MODELS = [
        self::TYPE_OPENAI => [
            'gpt-5.5', 'gpt-5.5-pro',
            'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5.4-pro',
            'gpt-5.3-codex',
            'gpt-4.1', 'gpt-4.1-mini', 'gpt-4o-mini',
        ],
        self::TYPE_ANTHROPIC => [
            'claude-opus-4-8', 'claude-fable-5',
            'claude-opus-4-7', 'claude-opus-4-6', 'claude-opus-4-5',
            'claude-sonnet-4-6', 'claude-sonnet-4-5',
            'claude-haiku-4-5',
        ],
        self::TYPE_GROK => [
            'grok-4.3',
            'grok-build-0.1',
            'grok-4.20-0309-reasoning',
            'grok-4.20-0309-non-reasoning',
        ],
        self::TYPE_DEEPSEEK => [
            'deepseek-v4-pro',
            'deepseek-v4-flash',
        ],
        self::TYPE_ZHIPU => [
            'glm-5.2',
            'glm-5.1',
            'glm-5',
            'glm-5-turbo',
            'glm-4.7',
            'glm-4.7-flashx',
            'glm-4.7-flash',
            'glm-4.6',
            'glm-4.5',
            'glm-4.5-x',
            'glm-4.5-airx',
            'glm-4.5-air',
            'glm-4.5-flash',
        ],
        self::TYPE_OLLAMA => [
            'kimi-k2.7-code',
            'kimi-k2.6',
            'kimi-k2.5',
            'glm-5.1',
            'glm-5',
            'glm-4.7',
            'qwen3.5',
            'qwen3-coder-next',
            'minimax-m3',
            'minimax-m2.7',
            'minimax-m2.5',
            'minimax-m2.1',
            'deepseek-v4-pro',
            'deepseek-v4-flash',
            'gemma4',
            'nemotron-3-ultra',
            'nemotron-3-super',
            'nemotron-3-nano',
            'gemini-3-flash-preview',
            'gpt-oss',
        ],
        self::TYPE_OPENROUTER => [
            'anthropic/claude-opus-4.8',
            'anthropic/claude-fable-5',
            'openai/gpt-5.5',
            'openai/gpt-5.5-pro',
            'x-ai/grok-4.3',
            'google/gemini-3.5-flash',
            'deepseek/deepseek-v4-pro',
            'deepseek/deepseek-v4-flash',
            'z-ai/glm-5.2',
            'z-ai/glm-5.1',
            'moonshotai/kimi-k2.6',
            'minimax/minimax-m3',
            'qwen/qwen3.7-max',
        ],
    ];

    const DEFAULT_BASE_URLS = [
        self::TYPE_OPENAI => 'https://api.openai.com/v1',
        self::TYPE_ANTHROPIC => 'https://api.anthropic.com',
        self::TYPE_GROK => 'https://api.x.ai/v1',
        self::TYPE_DEEPSEEK => 'https://api.deepseek.com',
        self::TYPE_ZHIPU => 'https://api.z.ai/api/anthropic',
        self::TYPE_OLLAMA => 'https://ollama.com/v1',
        self::TYPE_OPENROUTER => 'https://openrouter.ai/api/v1',
    ];

    protected $fillable = [
        'name',
        'type',
        'credentials',
        'config',
        'available_models',
        'status',
        'is_default',
        'last_used_at',
        'total_requests',
    ];

    protected function casts(): array
    {
        return [
            'credentials' => 'encrypted:array',
            'config' => 'array',
            'available_models' => 'array',
            'is_default' => 'boolean',
            'last_used_at' => 'datetime',
        ];
    }

    protected $hidden = ['credentials'];

    /**
     * Scope: Active providers only.
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Scope: Filter by type.
     */
    public function scopeOfType($query, string $type)
    {
        return $query->where('type', $type);
    }

    /**
     * Get plans that use this provider as primary.
     */
    public function plans(): HasMany
    {
        return $this->hasMany(Plan::class, 'ai_provider_id');
    }

    /**
     * Get the API key from credentials.
     */
    public function getApiKey(): ?string
    {
        return $this->credentials['api_key'] ?? null;
    }

    /**
     * Get the base URL for API calls.
     */
    public function getBaseUrl(): string
    {
        return $this->config['base_url']
            ?? self::DEFAULT_BASE_URLS[$this->type]
            ?? '';
    }

    /**
     * Get the default model for this provider.
     */
    public function getDefaultModel(): string
    {
        if (! empty($this->config['default_model'])) {
            return $this->config['default_model'];
        }

        $models = $this->available_models ?? self::DEFAULT_MODELS[$this->type] ?? [];

        return $models[0] ?? match ($this->type) {
            self::TYPE_ANTHROPIC => 'claude-sonnet-4-6',
            self::TYPE_ZHIPU => 'glm-5',
            self::TYPE_OLLAMA => 'kimi-k2.7-code',
            self::TYPE_OPENROUTER => 'anthropic/claude-opus-4.8',
            default => 'gpt-5.5',
        };
    }

    /**
     * Get max tokens setting.
     */
    public function getMaxTokens(): int
    {
        return $this->config['max_tokens'] ?? 8192;
    }

    /**
     * Test connection to the AI provider.
     */
    public function testConnection(): array
    {
        $apiKey = $this->getApiKey();

        if (empty($apiKey)) {
            return ['success' => false, 'message' => 'No API key configured'];
        }

        try {
            switch ($this->type) {
                case self::TYPE_OPENAI:
                    return $this->testOpenAiConnection();
                case self::TYPE_ANTHROPIC:
                    return $this->testAnthropicConnection();
                case self::TYPE_GROK:
                    return $this->testGrokConnection();
                case self::TYPE_DEEPSEEK:
                    return $this->testDeepSeekConnection();
                case self::TYPE_ZHIPU:
                    return $this->testZhipuConnection();
                case self::TYPE_OLLAMA:
                    return $this->testOllamaConnection();
                case self::TYPE_OPENROUTER:
                    return $this->testOpenRouterConnection();
                default:
                    return ['success' => false, 'message' => 'Unknown provider type'];
            }
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /**
     * Test OpenAI API connection.
     */
    protected function testOpenAiConnection(): array
    {
        $response = Http::withHeaders([
            'Authorization' => 'Bearer '.$this->getApiKey(),
        ])->get($this->getBaseUrl().'/models');

        if ($response->successful()) {
            return ['success' => true, 'message' => 'Connection successful'];
        }

        return [
            'success' => false,
            'message' => $response->json('error.message', 'Connection failed'),
        ];
    }

    /**
     * Test Anthropic API connection.
     */
    protected function testAnthropicConnection(): array
    {
        $response = Http::withHeaders([
            'x-api-key' => $this->getApiKey(),
            'anthropic-version' => '2023-06-01',
        ])->post($this->getBaseUrl().'/v1/messages', [
            'model' => $this->getDefaultModel(),
            'max_tokens' => 1,
            'messages' => [['role' => 'user', 'content' => 'Hi']],
        ]);

        if ($response->successful()) {
            return ['success' => true, 'message' => 'Connection successful'];
        }

        return [
            'success' => false,
            'message' => $response->json('error.message', 'Connection failed'),
        ];
    }

    /**
     * Test Grok API connection.
     */
    protected function testGrokConnection(): array
    {
        $response = Http::withHeaders([
            'Authorization' => 'Bearer '.$this->getApiKey(),
        ])->post($this->getBaseUrl().'/chat/completions', [
            'model' => $this->getDefaultModel(),
            'max_tokens' => 1,
            'messages' => [['role' => 'user', 'content' => 'Hi']],
        ]);

        if ($response->successful()) {
            return ['success' => true, 'message' => 'Connection successful'];
        }

        return [
            'success' => false,
            'message' => $response->json('error.message', 'Connection failed'),
        ];
    }

    /**
     * Test DeepSeek API connection.
     */
    protected function testDeepSeekConnection(): array
    {
        $response = Http::withHeaders([
            'Authorization' => 'Bearer '.$this->getApiKey(),
        ])->post($this->getBaseUrl().'/chat/completions', [
            'model' => $this->getDefaultModel(),
            'max_tokens' => 1,
            'messages' => [['role' => 'user', 'content' => 'Hi']],
        ]);

        if ($response->successful()) {
            return ['success' => true, 'message' => 'Connection successful'];
        }

        return [
            'success' => false,
            'message' => $response->json('error.message', 'Connection failed'),
        ];
    }

    /**
     * Test ZhipuAI (z.ai) API connection.
     */
    protected function testZhipuConnection(): array
    {
        $response = Http::withHeaders([
            'x-api-key' => $this->getApiKey(),
            'anthropic-version' => '2023-06-01',
        ])->post($this->getBaseUrl().'/v1/messages', [
            'model' => $this->getDefaultModel(),
            'max_tokens' => 1,
            'messages' => [['role' => 'user', 'content' => 'Hi']],
        ]);

        if ($response->successful()) {
            return ['success' => true, 'message' => 'Connection successful'];
        }

        return [
            'success' => false,
            'message' => $response->json('error.message', 'Connection failed'),
        ];
    }

    /**
     * Test Ollama Cloud API connection.
     * Ollama exposes an OpenAI-compatible API at https://ollama.com/v1.
     */
    protected function testOllamaConnection(): array
    {
        $response = Http::withHeaders([
            'Authorization' => 'Bearer '.$this->getApiKey(),
        ])->get($this->getBaseUrl().'/models');

        if ($response->successful()) {
            return ['success' => true, 'message' => 'Connection successful'];
        }

        return [
            'success' => false,
            'message' => $response->json('error.message', 'Connection failed'),
        ];
    }

    /**
     * Test OpenRouter API connection (OpenAI-compatible).
     */
    protected function testOpenRouterConnection(): array
    {
        $response = Http::withHeaders([
            'Authorization' => 'Bearer '.$this->getApiKey(),
        ])->get($this->getBaseUrl().'/models');

        if ($response->successful()) {
            return ['success' => true, 'message' => 'Connection successful'];
        }

        return [
            'success' => false,
            'message' => $response->json('error.message', 'Connection failed'),
        ];
    }

    /**
     * Increment the request counter and update last used timestamp.
     */
    public function recordUsage(): void
    {
        $this->increment('total_requests');
        $this->update(['last_used_at' => now()]);
    }

    /**
     * Convert provider settings to AI config format for BuilderService.
     */
    public function toAiConfig(): array
    {
        $agent = [
            'api_key' => $this->getApiKey(),
            'base_url' => $this->getBaseUrl(),
            'model' => $this->getDefaultModel(),
            'max_tokens' => $this->getMaxTokens(),
            'provider_type' => $this->type,
            'enable_prompt_caching' => $this->getEnablePromptCaching(),
        ];

        return [
            'provider' => $this->type,
            'provider_type' => $this->type,
            'agent' => $agent,
            'summarizer' => [
                'api_key' => $this->getApiKey(),
                'base_url' => $this->getBaseUrl(),
                'model' => $this->getSummarizerModel(),
                'max_tokens' => $this->getSummarizerMaxTokens(),
                'provider_type' => $this->type,
            ],
            'suggestions' => [
                'api_key' => $this->getApiKey(),
                'base_url' => $this->getBaseUrl(),
                'model' => $this->getSuggestionsModel(),
                'provider_type' => $this->type,
            ],
        ];
    }

    /**
     * Whether this provider uses the Anthropic messages protocol
     * (native Anthropic, or ZhipuAI via the z.ai Anthropic-compatible endpoint).
     * These providers require explicit cache_control markers on content blocks
     * to enable prompt caching — the builder handles that when the flag is on.
     */
    public function usesAnthropicProtocol(): bool
    {
        return in_array($this->type, [self::TYPE_ANTHROPIC, self::TYPE_ZHIPU], true);
    }

    /**
     * Whether prompt caching should be enabled for this provider.
     *
     * - Anthropic / ZhipuAI: builder sets cache_control markers on the system
     *   prompt so the provider caches it for ~5 minutes. Big savings on
     *   repeated-input tokens and rate-limit pressure.
     * - OpenAI, Grok, DeepSeek: prompt caching is AUTOMATIC server-side for
     *   prompts ≥ a threshold (OpenAI ≥ 1024 tokens, DeepSeek ≥ 64 tokens).
     *   No client-side header needed; the provider reports cached token usage
     *   in its response. This flag is a no-op for those providers but is kept
     *   for UI parity and future compatibility.
     *
     * Default: ON. Admins can disable per-provider via
     * `config.enable_prompt_caching = false`.
     */
    public function getEnablePromptCaching(): bool
    {
        $val = $this->config['enable_prompt_caching'] ?? true;
        if (is_string($val)) {
            $val = filter_var($val, FILTER_VALIDATE_BOOLEAN);
        }

        return (bool) $val;
    }

    /**
     * Get the model to use for summarization.
     * Uses the same model as agent for consistency.
     */
    protected function getSummarizerModel(): string
    {
        return $this->getDefaultModel();
    }

    /**
     * Get max tokens for summarizer.
     * Configurable per provider, defaults to 500 (reasonable for summaries).
     */
    public function getSummarizerMaxTokens(): int
    {
        return $this->config['summarizer_max_tokens'] ?? 1500;
    }

    /**
     * Get the model to use for suggestions.
     * Uses the same model as agent for consistency.
     */
    protected function getSuggestionsModel(): string
    {
        return $this->getDefaultModel();
    }

    /**
     * Get the type label.
     */
    public function getTypeLabelAttribute(): string
    {
        return self::TYPES[$this->type] ?? $this->type;
    }

    /**
     * Check if credentials are configured.
     */
    public function getHasCredentialsAttribute(): bool
    {
        return ! empty($this->credentials['api_key']);
    }

    /**
     * Clear default flag from all other providers.
     */
    public function makeDefault(): void
    {
        static::where('id', '!=', $this->id)->update(['is_default' => false]);
        $this->update(['is_default' => true]);
    }
}
