/**
 * Paper Banana Client
 *
 * HTTP client for the Paper Banana FastAPI microservice that generates
 * publication-quality academic diagrams, data plots, and visualizations
 * using a multi-agent pipeline (Retriever > Planner > Stylist > Visualizer > Critic)
 * powered by Google Gemini.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - PAPER_BANANA_SERVICE_URL (INTERNAL) — Base URL of the Paper Banana microservice
 * - PAPER_BANANA_API_KEY (SECRET) — API key for authenticating with the service
 *
 * FAILURE MODE: Returns error with retry suggestion if service unavailable
 *
 * @module lib/services/paper-banana-client
 */

import { logger } from '@/lib/logger';

// =============================================================================
// Types
// =============================================================================

export type VisualType = 'diagram' | 'plot' | 'infographic' | 'before_after';

export interface GenerateVisualRequest {
  type: VisualType;
  prompt: string;
  data?: Record<string, unknown>;
  style?: string;
  width?: number;
  height?: number;
}

export interface GenerateVisualResponse {
  success: boolean;
  imageUrl: string;
  thumbnailUrl?: string;
  metadata: {
    type: VisualType;
    width: number;
    height: number;
    format: string;
    generationTime: number;
    pipeline: {
      retriever: { sources: number };
      planner: { layout: string };
      stylist: { style: string };
      visualizer: { model: string };
      critic: { score: number; feedback: string };
    };
  };
}

export interface EvaluateVisualRequest {
  imageUrl: string;
  context?: string;
}

export interface EvaluateVisualResponse {
  success: boolean;
  qualityScore: number;       // 0-100 from Critic agent
  feedback: string;
  suggestions: string[];
  dimensions: {
    clarity: number;          // 0-100
    accuracy: number;         // 0-100
    aesthetics: number;       // 0-100
    readability: number;      // 0-100
    relevance: number;        // 0-100
  };
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  modelsLoaded: boolean;
  lastGeneration?: string;
}

export interface PaperBananaError {
  success: false;
  error: string;
  code: string;
  retryAfter?: number;
}

// =============================================================================
// Client Configuration
// =============================================================================

interface ClientConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
}

function getConfig(): ClientConfig {
  const baseUrl = process.env.PAPER_BANANA_SERVICE_URL;
  const apiKey = process.env.PAPER_BANANA_API_KEY;

  if (!baseUrl) {
    logger.warn('PAPER_BANANA_SERVICE_URL not configured — visual generation disabled');
  }
  if (!apiKey) {
    logger.warn('PAPER_BANANA_API_KEY not configured — visual generation disabled');
  }

  return {
    baseUrl: baseUrl || 'http://localhost:8100',
    apiKey: apiKey || '',
    timeout: 60000,   // 60s — generation can take time
    maxRetries: 2,
    retryDelay: 5000,  // 5s between retries
  };
}

// =============================================================================
// HTTP Helpers
// =============================================================================

async function makeRequest<T>(
  path: string,
  options: {
    method: 'GET' | 'POST';
    body?: Record<string, unknown>;
    timeout?: number;
  }
): Promise<T> {
  const config = getConfig();
  const url = `${config.baseUrl}${path}`;
  const timeout = options.timeout || config.timeout;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: options.method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey,
        'User-Agent': 'SYNTHEX-PaperBanana-Client/1.0',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      throw new PaperBananaServiceError(
        `Paper Banana service returned ${response.status}: ${errorBody}`,
        response.status === 429 ? 'RATE_LIMITED' : 'SERVICE_ERROR',
        response.status === 429 ? 30 : undefined
      );
    }

    return await response.json() as T;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof PaperBananaServiceError) throw error;

    if (error instanceof Error && error.name === 'AbortError') {
      throw new PaperBananaServiceError(
        `Paper Banana request timed out after ${timeout}ms`,
        'TIMEOUT',
        30
      );
    }

    throw new PaperBananaServiceError(
      `Paper Banana service unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'UNAVAILABLE',
      30
    );
  }
}

async function requestWithRetry<T>(
  path: string,
  options: { method: 'GET' | 'POST'; body?: Record<string, unknown>; timeout?: number }
): Promise<T> {
  const config = getConfig();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    try {
      return await makeRequest<T>(path, options);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (error instanceof PaperBananaServiceError && error.code === 'RATE_LIMITED') {
        throw error; // Don't retry rate limits
      }

      if (attempt <= config.maxRetries) {
        logger.warn('Paper Banana request failed, retrying', {
          attempt,
          maxRetries: config.maxRetries,
          error: lastError.message,
        });
        await new Promise(resolve => setTimeout(resolve, config.retryDelay * attempt));
      }
    }
  }

  throw lastError;
}

// =============================================================================
// Error Class
// =============================================================================

export class PaperBananaServiceError extends Error {
  public readonly code: string;
  public readonly retryAfter?: number;

  constructor(message: string, code: string, retryAfter?: number) {
    super(message);
    this.name = 'PaperBananaServiceError';
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Generate a diagram using Paper Banana's multi-agent pipeline.
 * Pipeline: Retriever → Planner → Stylist → Visualizer → Critic
 */
export async function generateDiagram(request: GenerateVisualRequest): Promise<GenerateVisualResponse> {
  logger.info('Generating diagram via Paper Banana', { type: request.type, promptLength: request.prompt.length });

  const endpoint = request.type === 'plot' ? '/api/generate/plot' : '/api/generate/diagram';

  const result = await requestWithRetry<GenerateVisualResponse>(endpoint, {
    method: 'POST',
    body: {
      prompt: request.prompt,
      type: request.type,
      data: request.data,
      style: request.style || 'academic',
      width: request.width || 1200,
      height: request.height || 800,
    },
    timeout: 90000, // 90s for generation
  });

  logger.info('Diagram generated successfully', {
    type: request.type,
    qualityScore: result.metadata?.pipeline?.critic?.score,
  });

  return result;
}

/**
 * Evaluate an existing visual using the Critic agent.
 */
export async function evaluateVisual(request: EvaluateVisualRequest): Promise<EvaluateVisualResponse> {
  logger.info('Evaluating visual quality', { imageUrl: request.imageUrl });

  return requestWithRetry<EvaluateVisualResponse>('/api/evaluate', {
    method: 'POST',
    body: {
      imageUrl: request.imageUrl,
      context: request.context,
    },
  });
}

/**
 * Check Paper Banana service health.
 */
export async function checkHealth(): Promise<HealthCheckResponse> {
  return makeRequest<HealthCheckResponse>('/health', {
    method: 'GET',
    timeout: 10000,
  });
}

/**
 * Check if Paper Banana service is configured and available.
 */
export function isConfigured(): boolean {
  return !!(process.env.PAPER_BANANA_SERVICE_URL && process.env.PAPER_BANANA_API_KEY);
}

/**
 * Generate with quality gate — auto-retries if Critic score is below threshold.
 * Returns the best result after maxAttempts.
 */
export async function generateWithQualityGate(
  request: GenerateVisualRequest,
  options: { minQuality?: number; maxAttempts?: number } = {}
): Promise<GenerateVisualResponse> {
  const { minQuality = 70, maxAttempts = 3 } = options;
  let bestResult: GenerateVisualResponse | null = null;
  let bestScore = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await generateDiagram(request);
    const criticScore = result.metadata?.pipeline?.critic?.score || 0;

    if (criticScore > bestScore) {
      bestResult = result;
      bestScore = criticScore;
    }

    if (criticScore >= minQuality) {
      logger.info('Quality gate passed', { attempt, score: criticScore, threshold: minQuality });
      return result;
    }

    if (attempt < maxAttempts) {
      logger.info('Quality gate not met, refining prompt', {
        attempt,
        score: criticScore,
        threshold: minQuality,
        feedback: result.metadata?.pipeline?.critic?.feedback,
      });

      // Enhance prompt with critic feedback for next attempt
      const feedback = result.metadata?.pipeline?.critic?.feedback;
      if (feedback) {
        request = {
          ...request,
          prompt: `${request.prompt}\n\nImprovement instructions: ${feedback}`,
        };
      }
    }
  }

  logger.warn('Quality gate not met after all attempts, returning best result', {
    bestScore,
    threshold: minQuality,
  });

  return bestResult!;
}
