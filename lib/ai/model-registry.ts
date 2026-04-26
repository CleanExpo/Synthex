/**
 * Model Registry
 *
 * Central registry of the latest available models from each LLM provider.
 * This is the source of truth for which models SYNTHEX uses system-wide.
 *
 * Updated: 2026-03-22
 * Critical: This file must be updated whenever new models become available
 */

export type AIProvider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'openrouter'
  | 'ollama';
export type ModelTier = 'latest' | 'production' | 'legacy';

export interface ModelConfig {
  // Identifier
  id: string;
  provider: AIProvider;
  name: string;

  // Version info
  releaseDate: Date;
  tier: ModelTier;
  capabilities: string[];

  // Performance metrics
  contextWindow: number;
  costPer1kTokens: { input: number; output: number };

  // Compatibility
  supportsVision: boolean;
  supportsTools: boolean;
  supportsStreaming: boolean;

  // Status
  isDeprecated: boolean;
  deprecatedDate?: Date;
  replacementModel?: string;
}

/**
 * OFFICIAL MODEL REGISTRY
 * Last updated: 2026-03-22
 *
 * ⚠️ CRITICAL: This registry is the system's source of truth
 * Any model NOT in this registry will be rejected by the system
 */
const LATEST_MODELS: Record<AIProvider, ModelConfig[]> = {
  openai: [
    {
      id: 'gpt-4-turbo',
      provider: 'openai',
      name: 'GPT-4 Turbo',
      releaseDate: new Date('2024-04-09'),
      tier: 'production',
      capabilities: ['text', 'vision', 'tools', 'streaming'],
      contextWindow: 128000,
      costPer1kTokens: { input: 0.01, output: 0.03 },
      supportsVision: true,
      supportsTools: true,
      supportsStreaming: true,
      isDeprecated: false,
    },
    {
      id: 'gpt-4-o',
      provider: 'openai',
      name: 'GPT-4o',
      releaseDate: new Date('2024-05-13'),
      tier: 'latest',
      capabilities: ['text', 'vision', 'tools', 'streaming', 'multimodal'],
      contextWindow: 128000,
      costPer1kTokens: { input: 0.005, output: 0.015 },
      supportsVision: true,
      supportsTools: true,
      supportsStreaming: true,
      isDeprecated: false,
    },
    {
      id: 'gpt-4-o-mini',
      provider: 'openai',
      name: 'GPT-4o Mini',
      releaseDate: new Date('2024-07-18'),
      tier: 'latest',
      capabilities: ['text', 'vision', 'tools', 'streaming'],
      contextWindow: 128000,
      costPer1kTokens: { input: 0.00015, output: 0.0006 },
      supportsVision: true,
      supportsTools: true,
      supportsStreaming: true,
      isDeprecated: false,
    },
  ],

  anthropic: [
    {
      id: 'claude-opus-4-6',
      provider: 'anthropic',
      name: 'Claude Opus 4.6',
      releaseDate: new Date('2026-03-01'),
      tier: 'latest',
      capabilities: [
        'text',
        'vision',
        'tools',
        'streaming',
        'adaptive-thinking',
      ],
      contextWindow: 1000000,
      costPer1kTokens: { input: 0.015, output: 0.075 },
      supportsVision: true,
      supportsTools: true,
      supportsStreaming: true,
      isDeprecated: false,
    },
    {
      id: 'claude-sonnet-4-6',
      provider: 'anthropic',
      name: 'Claude Sonnet 4.6',
      releaseDate: new Date('2026-03-01'),
      tier: 'latest',
      capabilities: [
        'text',
        'vision',
        'tools',
        'streaming',
        'adaptive-thinking',
      ],
      contextWindow: 1000000,
      costPer1kTokens: { input: 0.003, output: 0.015 },
      supportsVision: true,
      supportsTools: true,
      supportsStreaming: true,
      isDeprecated: false,
    },
    {
      id: 'claude-haiku-4-5-20251001',
      provider: 'anthropic',
      name: 'Claude Haiku 4.5',
      releaseDate: new Date('2025-10-01'),
      tier: 'production',
      capabilities: ['text', 'vision', 'tools', 'streaming'],
      contextWindow: 200000,
      costPer1kTokens: { input: 0.0008, output: 0.004 },
      supportsVision: true,
      supportsTools: true,
      supportsStreaming: true,
      isDeprecated: false,
    },
    {
      id: 'claude-3-5-sonnet',
      provider: 'anthropic',
      name: 'Claude 3.5 Sonnet',
      releaseDate: new Date('2024-06-20'),
      tier: 'legacy',
      capabilities: [
        'text',
        'vision',
        'tools',
        'streaming',
        'extended-thinking',
      ],
      contextWindow: 200000,
      costPer1kTokens: { input: 0.003, output: 0.015 },
      supportsVision: true,
      supportsTools: true,
      supportsStreaming: true,
      isDeprecated: true,
      deprecatedDate: new Date('2026-03-01'),
      replacementModel: 'claude-sonnet-4-6',
    },
    {
      id: 'claude-3-opus',
      provider: 'anthropic',
      name: 'Claude 3 Opus',
      releaseDate: new Date('2024-03-04'),
      tier: 'legacy',
      capabilities: ['text', 'vision', 'tools', 'streaming'],
      contextWindow: 200000,
      costPer1kTokens: { input: 0.015, output: 0.075 },
      supportsVision: true,
      supportsTools: true,
      supportsStreaming: true,
      isDeprecated: true,
      deprecatedDate: new Date('2026-03-01'),
      replacementModel: 'claude-opus-4-6',
    },
  ],

  google: [
    // SYN-786 — Google Cloud Next 2026 (Apr 22-24): Gemini 3.1 Flash / Pro preview.
    // 70% time-to-first-token reduction over 2.5; Native Function Calling Combination.
    {
      id: 'gemini-3-1-flash',
      provider: 'google',
      name: 'Gemini 3.1 Flash',
      releaseDate: new Date('2026-04-22'),
      tier: 'latest',
      capabilities: [
        'text',
        'vision',
        'audio',
        'tools',
        'streaming',
        'multimodal',
        'thinking',
      ],
      contextWindow: 1048576,
      costPer1kTokens: { input: 0.000075, output: 0.0003 },
      supportsVision: true,
      supportsTools: true,
      supportsStreaming: true,
      isDeprecated: false,
    },
    {
      id: 'gemini-3-1-pro',
      provider: 'google',
      name: 'Gemini 3.1 Pro',
      releaseDate: new Date('2026-04-22'),
      tier: 'latest',
      capabilities: [
        'text',
        'vision',
        'audio',
        'tools',
        'streaming',
        'multimodal',
        'thinking',
      ],
      contextWindow: 2097152,
      costPer1kTokens: { input: 0.00125, output: 0.005 },
      supportsVision: true,
      supportsTools: true,
      supportsStreaming: true,
      isDeprecated: false,
    },
    {
      id: 'gemini-2-5-flash',
      provider: 'google',
      name: 'Gemini 2.5 Flash',
      releaseDate: new Date('2025-05-01'),
      tier: 'production',
      capabilities: [
        'text',
        'vision',
        'audio',
        'tools',
        'streaming',
        'multimodal',
        'thinking',
      ],
      contextWindow: 1048576,
      costPer1kTokens: { input: 0.000075, output: 0.0003 },
      supportsVision: true,
      supportsTools: true,
      supportsStreaming: true,
      isDeprecated: false,
    },
    {
      id: 'gemini-2-0-flash',
      provider: 'google',
      name: 'Gemini 2.0 Flash',
      releaseDate: new Date('2024-12-19'),
      tier: 'production',
      capabilities: [
        'text',
        'vision',
        'audio',
        'tools',
        'streaming',
        'multimodal',
      ],
      contextWindow: 1000000,
      costPer1kTokens: { input: 0.000075, output: 0.0003 },
      supportsVision: true,
      supportsTools: true,
      supportsStreaming: true,
      isDeprecated: false,
    },
    {
      id: 'gemini-1-5-pro',
      provider: 'google',
      name: 'Gemini 1.5 Pro',
      releaseDate: new Date('2024-05-14'),
      tier: 'production',
      capabilities: ['text', 'vision', 'tools', 'streaming'],
      contextWindow: 1000000,
      costPer1kTokens: { input: 0.00125, output: 0.005 },
      supportsVision: true,
      supportsTools: true,
      supportsStreaming: true,
      isDeprecated: false,
    },
    {
      id: 'gemini-1-5-flash',
      provider: 'google',
      name: 'Gemini 1.5 Flash',
      releaseDate: new Date('2024-06-12'),
      tier: 'production',
      capabilities: ['text', 'vision', 'tools', 'streaming'],
      contextWindow: 1000000,
      costPer1kTokens: { input: 0.000075, output: 0.0003 },
      supportsVision: true,
      supportsTools: true,
      supportsStreaming: true,
      isDeprecated: false,
    },
  ],

  openrouter: [
    {
      id: 'anthropic/claude-opus-4-6',
      provider: 'openrouter',
      name: 'Claude Opus 4.6 (via OpenRouter)',
      releaseDate: new Date('2026-03-01'),
      tier: 'latest',
      capabilities: [
        'text',
        'vision',
        'tools',
        'streaming',
        'adaptive-thinking',
      ],
      contextWindow: 1000000,
      costPer1kTokens: { input: 0.015, output: 0.075 },
      supportsVision: true,
      supportsTools: true,
      supportsStreaming: true,
      isDeprecated: false,
    },
    {
      id: 'anthropic/claude-sonnet-4-6',
      provider: 'openrouter',
      name: 'Claude Sonnet 4.6 (via OpenRouter)',
      releaseDate: new Date('2026-03-01'),
      tier: 'latest',
      capabilities: [
        'text',
        'vision',
        'tools',
        'streaming',
        'adaptive-thinking',
      ],
      contextWindow: 1000000,
      costPer1kTokens: { input: 0.003, output: 0.015 },
      supportsVision: true,
      supportsTools: true,
      supportsStreaming: true,
      isDeprecated: false,
    },
    {
      id: 'anthropic/claude-haiku-4-5',
      provider: 'openrouter',
      name: 'Claude Haiku 4.5 (via OpenRouter)',
      releaseDate: new Date('2025-10-01'),
      tier: 'production',
      capabilities: ['text', 'vision', 'tools', 'streaming'],
      contextWindow: 200000,
      costPer1kTokens: { input: 0.0008, output: 0.004 },
      supportsVision: true,
      supportsTools: true,
      supportsStreaming: true,
      isDeprecated: false,
    },
    // SYN-786 — Google Cloud Next 2026: Gemini 3.1 preview via OpenRouter.
    {
      id: 'google/gemini-3.1-flash',
      provider: 'openrouter',
      name: 'Google Gemini 3.1 Flash (via OpenRouter)',
      releaseDate: new Date('2026-04-22'),
      tier: 'latest',
      capabilities: ['text', 'vision', 'tools', 'streaming', 'thinking'],
      contextWindow: 1048576,
      costPer1kTokens: { input: 0.000075, output: 0.0003 },
      supportsVision: true,
      supportsTools: true,
      supportsStreaming: true,
      isDeprecated: false,
    },
    {
      id: 'google/gemini-3.1-pro',
      provider: 'openrouter',
      name: 'Google Gemini 3.1 Pro (via OpenRouter)',
      releaseDate: new Date('2026-04-22'),
      tier: 'latest',
      capabilities: ['text', 'vision', 'tools', 'streaming', 'thinking'],
      contextWindow: 2097152,
      costPer1kTokens: { input: 0.00125, output: 0.005 },
      supportsVision: true,
      supportsTools: true,
      supportsStreaming: true,
      isDeprecated: false,
    },
    {
      id: 'google/gemini-2.5-flash',
      provider: 'openrouter',
      name: 'Google Gemini 2.5 Flash (via OpenRouter)',
      releaseDate: new Date('2025-05-01'),
      tier: 'production',
      capabilities: ['text', 'vision', 'tools', 'streaming', 'thinking'],
      contextWindow: 1048576,
      costPer1kTokens: { input: 0.000075, output: 0.0003 },
      supportsVision: true,
      supportsTools: true,
      supportsStreaming: true,
      isDeprecated: false,
    },
    {
      id: 'google/gemini-2.0-flash',
      provider: 'openrouter',
      name: 'Google Gemini 2.0 Flash (via OpenRouter)',
      releaseDate: new Date('2024-12-19'),
      tier: 'production',
      capabilities: ['text', 'vision', 'tools', 'streaming'],
      contextWindow: 1000000,
      costPer1kTokens: { input: 0.000075, output: 0.0003 },
      supportsVision: true,
      supportsTools: true,
      supportsStreaming: true,
      isDeprecated: false,
    },
    // SYN-807 — DeepSeek V4 (released 2026-04-24): cheap-cloud tier for
    // research-heavy + mid-quality drafting tasks. ~10-20× cheaper than
    // Claude Sonnet at competitive benchmarks. 1M context window.
    {
      id: 'deepseek/deepseek-v4-flash',
      provider: 'openrouter',
      name: 'DeepSeek V4 Flash (via OpenRouter)',
      releaseDate: new Date('2026-04-24'),
      tier: 'latest',
      capabilities: ['text', 'tools', 'streaming'],
      contextWindow: 1000000,
      costPer1kTokens: { input: 0.00014, output: 0.00028 },
      supportsVision: false,
      supportsTools: true,
      supportsStreaming: true,
      isDeprecated: false,
    },
    {
      id: 'deepseek/deepseek-v4-pro',
      provider: 'openrouter',
      name: 'DeepSeek V4 Pro (via OpenRouter)',
      releaseDate: new Date('2026-04-24'),
      tier: 'latest',
      capabilities: ['text', 'tools', 'streaming'],
      contextWindow: 1000000,
      costPer1kTokens: { input: 0.000435, output: 0.00087 },
      supportsVision: false,
      supportsTools: true,
      supportsStreaming: true,
      isDeprecated: false,
    },
  ],

  // SYN-807 — Local Ollama-hosted models. Zero per-token cost; sole limit
  // is laptop CPU/RAM. Used for high-volume batch research, classification,
  // and draft scaffolding. Production deployments do NOT route here —
  // Vercel does not run Ollama. Only the local development environment
  // honours this provider.
  ollama: [
    {
      id: 'gemma4:e2b',
      provider: 'ollama',
      name: 'Google Gemma 4 E2B (local)',
      releaseDate: new Date('2026-04-02'),
      tier: 'production',
      capabilities: ['text', 'streaming', 'thinking'],
      contextWindow: 128000,
      costPer1kTokens: { input: 0, output: 0 },
      supportsVision: false,
      supportsTools: false,
      supportsStreaming: true,
      isDeprecated: false,
    },
    {
      id: 'gemma4:e4b',
      provider: 'ollama',
      name: 'Google Gemma 4 E4B (local)',
      releaseDate: new Date('2026-04-02'),
      tier: 'latest',
      capabilities: ['text', 'streaming', 'thinking'],
      contextWindow: 128000,
      costPer1kTokens: { input: 0, output: 0 },
      supportsVision: false,
      supportsTools: false,
      supportsStreaming: true,
      isDeprecated: false,
    },
  ],
};

/**
 * Get the latest model for a provider
 * Returns the most recent non-deprecated model in 'latest' tier
 */
export function getLatestModel(provider: AIProvider): ModelConfig {
  const models = LATEST_MODELS[provider];
  const latest = models
    .filter(m => !m.isDeprecated && m.tier === 'latest')
    .sort((a, b) => b.releaseDate.getTime() - a.releaseDate.getTime())[0];

  if (!latest) {
    // Fallback to production tier if no latest available
    const production = models
      .filter(m => !m.isDeprecated && m.tier === 'production')
      .sort((a, b) => b.releaseDate.getTime() - a.releaseDate.getTime())[0];

    if (!production) {
      throw new Error(`No available models for provider: ${provider}`);
    }

    return production;
  }

  return latest;
}

/**
 * Get all models for a provider
 */
export function getModels(provider: AIProvider): ModelConfig[] {
  return LATEST_MODELS[provider];
}

/**
 * Get a specific model by ID
 */
export function getModel(
  provider: AIProvider,
  modelId: string
): ModelConfig | null {
  const models = LATEST_MODELS[provider];
  return models.find(m => m.id === modelId) || null;
}

/**
 * Check if a model is still available and not deprecated
 */
export function isModelAvailable(
  provider: AIProvider,
  modelId: string
): boolean {
  const model = getModel(provider, modelId);
  return model ? !model.isDeprecated : false;
}

/**
 * Get production-ready models (for stable operations)
 */
export function getProductionModels(provider: AIProvider): ModelConfig[] {
  return LATEST_MODELS[provider]
    .filter(
      m => (m.tier === 'production' || m.tier === 'latest') && !m.isDeprecated
    )
    .sort((a, b) => b.releaseDate.getTime() - a.releaseDate.getTime());
}

/**
 * Validate model configuration
 * Ensures the model meets system requirements
 */
export function validateModel(
  model: ModelConfig,
  requirements?: {
    minContextWindow?: number;
    requireVision?: boolean;
    requireTools?: boolean;
    requireStreaming?: boolean;
  }
): boolean {
  if (model.isDeprecated) return false;

  if (requirements) {
    if (
      requirements.minContextWindow &&
      model.contextWindow < requirements.minContextWindow
    ) {
      return false;
    }
    if (requirements.requireVision && !model.supportsVision) return false;
    if (requirements.requireTools && !model.supportsTools) return false;
    if (requirements.requireStreaming && !model.supportsStreaming) return false;
  }

  return true;
}

/**
 * List all active providers with their latest models
 */
export function getAllLatestModels(): Record<AIProvider, ModelConfig> {
  return {
    openai: getLatestModel('openai'),
    anthropic: getLatestModel('anthropic'),
    google: getLatestModel('google'),
    openrouter: getLatestModel('openrouter'),
    ollama: getLatestModel('ollama'),
  };
}
