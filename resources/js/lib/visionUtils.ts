/**
 * Check if a given provider and model support vision capabilities.
 * This mirrors the logic in the Go builder's factory.go.
 */

const VISION_PATTERNS: Record<string, string[]> = {
    openai: ['gpt-4o', 'gpt-4-turbo', 'gpt-4-vision', 'gpt-4o-mini'],
    anthropic: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-3.5', 'claude-sonnet-4', 'claude-opus-4'],
    grok: ['grok-vision', 'grok-1.5v'],
    deepseek: ['deepseek-vl', 'deepseek-chat-v2.5'],
    zhipu: ['glm-4v', 'glm-4v-plus', 'glm-4v-plus-250414'],
    ollama: ['llava', 'bakllava', 'moondream', 'qwen2-vl'],
    openrouter: ['gpt-4o', 'gpt-4-vision', 'claude-3-opus', 'claude-3-sonnet', 'gemini-1.5', 'gemini-pro-vision'],
    kimi: ['moonshot-v1-vision', 'kimi-vl', 'kimi-k2.6'],
    minimax: ['minimax-01', 'minimax-m3', 'abab6.5s', 'abab6.5g', 'video-01'],
    nvidia: ['nvidia-', 'nim-', 'llama-', 'mistral-', 'mixtral-', 'gemma-', 'nemotron', 'mistral-nemo'],
};

export function modelSupportsVision(providerType: string, model: string): boolean {
    const provider = providerType.toLowerCase();
    const modelLower = model.toLowerCase();

    const patterns = VISION_PATTERNS[provider];
    if (!patterns) {
        return false;
    }

    return patterns.some(pattern => modelLower.includes(pattern.toLowerCase()));
}

export function getVisionModelsList(): Record<string, string[]> {
    return VISION_PATTERNS;
}