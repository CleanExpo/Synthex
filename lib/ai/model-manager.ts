/**
 * Model Manager Agent
 *
 * CRITICAL SYSTEM COMPONENT
 * Ensures SYNTHEX always operates with the latest available LLM models.
 * 
 * Prevents model degradation by:
 * 1. Hard-coding latest model selection
 * 2. Blocking fallback to deprecated models
 * 3. Validating models on every request
 * 4. Monitoring for new model releases
 *
 * This agent is the guardian of model freshness across the entire system.
 */

import {
  AIProvider,
  ModelConfig,
  getLatestModel,
  getModel,
  isModelAvailable,
  getProductionModels,
  validateModel,
  getAllLatestModels,
} from './model-registry';

export interface ModelSelectionStrategy {
  provider: AIProvider;
  preferredModels: string[]; // Ordered by preference
  fallbackStrategy: 'latest' | 'production' | 'error';
  requirements?: {
    minContextWindow?: number;
    requireVision?: boolean;
    requireTools?: boolean;
    requireStreaming?: boolean;
  };
}

/**
 * Model Manager State
 * Tracks which models are in use and their health status
 */
export interface ModelManagerState {
  lastUpdated: Date;
  activeModels: Map<AIProvider, ModelConfig>;
  modelHealth: Map<string, { failureCount: number; lastFailure?: Date }>;
  deprecatedModelsBlocked: string[];
}

class ModelManagerAgent {
  private state: ModelManagerState;
  private readonly UPDATE_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  private updateTimer?: NodeJS.Timeout;

  constructor() {
    this.state = {
      lastUpdated: new Date(),
      activeModels: new Map(),
      modelHealth: new Map(),
      deprecatedModelsBlocked: [],
    };

    this.initializeLatestModels();
    this.startAutoUpdate();
  }

  /**
   * Initialize with the latest models from registry
   * This runs on system startup
   */
  private initializeLatestModels(): void {
    const providers: AIProvider[] = ['openai', 'anthropic', 'google', 'openrouter'];

    for (const provider of providers) {
      try {
        const latest = getLatestModel(provider);
        this.state.activeModels.set(provider, latest);
      } catch (error) {
        console.error(`❌ [ModelManager] Failed to initialize ${provider}:`, error);
      }
    }
  }

  /**
   * Get the current model for a provider
   * ALWAYS returns the latest available model
   * Will NEVER return a deprecated model
   */
  public getModel(provider: AIProvider): ModelConfig {
    // Always fetch fresh from registry (never cache)
    const latest = getLatestModel(provider);

    // Validate the model is available
    if (!isModelAvailable(provider, latest.id)) {
      throw new Error(
        `Model ${latest.id} is no longer available. System requires latest models only.`
      );
    }

    // Update active model tracker
    this.state.activeModels.set(provider, latest);

    return latest;
  }

  /**
   * Select a model based on strategy
   * Enforces that only available, non-deprecated models are used
   */
  public selectModel(strategy: ModelSelectionStrategy): ModelConfig {
    const { provider, preferredModels, fallbackStrategy, requirements } = strategy;

    // Try preferred models in order
    for (const modelId of preferredModels) {
      const model = getModel(provider, modelId);

      // Skip if not available or deprecated
      if (!model || model.isDeprecated) {
        console.warn(
          `⚠️  [ModelManager] Preferred model ${modelId} is no longer available (deprecated or removed)`
        );
        continue;
      }

      // Validate against requirements
      if (requirements && !validateModel(model, requirements)) {
        console.warn(
          `⚠️  [ModelManager] Model ${modelId} does not meet requirements`
        );
        continue;
      }

      return model;
    }

    // If no preferred model worked, use fallback strategy
    if (fallbackStrategy === 'error') {
      throw new Error(
        `No available model for ${provider}. All preferred models are deprecated.`
      );
    }

    if (fallbackStrategy === 'latest') {
      return this.getModel(provider);
    }

    if (fallbackStrategy === 'production') {
      const production = getProductionModels(provider)[0];
      if (!production) {
        throw new Error(`No production models available for ${provider}`);
      }
      return production;
    }

    throw new Error(`Unknown fallback strategy: ${fallbackStrategy}`);
  }

  /**
   * Record a model failure to track health
   */
  public recordFailure(modelId: string, provider: AIProvider): void {
    const key = `${provider}:${modelId}`;
    const current = this.state.modelHealth.get(key) || { failureCount: 0 };

    current.failureCount++;
    current.lastFailure = new Date();

    this.state.modelHealth.set(key, current);

    // Log if model has multiple failures
    if (current.failureCount > 3) {
      console.warn(
        `⚠️  [ModelManager] Model ${modelId} (${provider}) has ${current.failureCount} failures`
      );
    }
  }

  /**
   * Reset health for a model
   */
  public recordSuccess(modelId: string, provider: AIProvider): void {
    const key = `${provider}:${modelId}`;
    this.state.modelHealth.set(key, { failureCount: 0 });
  }

  /**
   * Force update from registry (for immediate model refresh)
   */
  public forceUpdate(): void {
    this.initializeLatestModels();
    this.state.lastUpdated = new Date();
  }

  /**
   * Start automatic update timer
   * Checks for new models every 24 hours
   */
  private startAutoUpdate(): void {
    this.updateTimer = setInterval(() => {
      this.forceUpdate();
    }, this.UPDATE_INTERVAL);

    // Also run once on first load after delay
    setTimeout(() => {
      this.forceUpdate();
    }, 60000); // Check after 1 minute
  }

  /**
   * Prevent model degradation
   * Validates that we're never using an older model than the latest
   */
  public validateNoDowngrade(
    provider: AIProvider,
    requestedModel: string
  ): boolean {
    const latest = getLatestModel(provider);
    const requested = getModel(provider, requestedModel);

    if (!requested) {
      console.error(
        `❌ [ModelManager] Attempted to use non-existent model: ${requestedModel}`
      );
      return false;
    }

    if (requested.isDeprecated) {
      console.error(
        `❌ [ModelManager] BLOCKED: Attempted to use deprecated model ${requestedModel}. Latest is ${latest.id}`
      );
      return false;
    }

    if (requested.releaseDate.getTime() < latest.releaseDate.getTime()) {
      console.warn(
        `⚠️  [ModelManager] Using older model ${requestedModel} when newer ${latest.id} is available`
      );
      // Still allow it but with warning
    }

    return true;
  }

  /**
   * Get health report
   */
  public getHealthReport(): {
    timestamp: Date;
    activeModels: Record<AIProvider, string>;
    unhealthyModels: Array<{ modelId: string; failureCount: number; lastFailure: Date }>;
    registryLastUpdated: Date;
  } {
    return {
      timestamp: new Date(),
      activeModels: {
        openai: this.state.activeModels.get('openai')?.name || 'UNKNOWN',
        anthropic: this.state.activeModels.get('anthropic')?.name || 'UNKNOWN',
        google: this.state.activeModels.get('google')?.name || 'UNKNOWN',
        openrouter: this.state.activeModels.get('openrouter')?.name || 'UNKNOWN',
      },
      unhealthyModels: Array.from(this.state.modelHealth.entries())
        .filter(([_, health]) => health.failureCount > 0)
        .map(([modelId, health]) => ({
          modelId,
          failureCount: health.failureCount,
          lastFailure: health.lastFailure || new Date(),
        })),
      registryLastUpdated: this.state.lastUpdated,
    };
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
  }
}

/**
 * Global instance of the Model Manager Agent
 * This ensures a single source of truth for model selection across the entire system
 */
export const modelManager = new ModelManagerAgent();

/**
 * Get the latest model for immediate use
 * This is the recommended way to get models for any AI operation
 */
export function getLatestModelForProvider(provider: AIProvider): ModelConfig {
  return modelManager.getModel(provider);
}

/**
 * Safely select a model with fallback strategy
 */
export function selectModelSafely(
  strategy: ModelSelectionStrategy
): ModelConfig {
  return modelManager.selectModel(strategy);
}

/**
 * Validate before using a model
 * Prevents system from reverting to deprecated models
 */
export function validateBeforeUse(
  provider: AIProvider,
  modelId: string
): boolean {
  return modelManager.validateNoDowngrade(provider, modelId);
}
