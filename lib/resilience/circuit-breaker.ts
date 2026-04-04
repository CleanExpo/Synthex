/**
 * Circuit Breaker — External API Resilience
 *
 * Prevents cascading failures when external services (OpenRouter, Stripe, social APIs) go down.
 * Three states: CLOSED (normal), OPEN (blocking), HALF_OPEN (testing recovery).
 *
 * Usage:
 *   const breaker = getCircuitBreaker('openrouter', { failureThreshold: 5, resetTimeoutMs: 30_000 });
 *   const result = await breaker.execute(() => fetch('https://openrouter.ai/api/...'));
 *
 * QA-AUDIT-2026-03-14: Created to address H3 — no circuit breakers for external APIs.
 *
 * @module lib/resilience/circuit-breaker
 */

import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export enum CircuitState {
  CLOSED = 'CLOSED',       // Normal operation — requests pass through
  OPEN = 'OPEN',           // Service down — requests fail fast
  HALF_OPEN = 'HALF_OPEN', // Testing recovery — single request allowed
}

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit. Default: 5 */
  failureThreshold?: number;
  /** Time in ms to wait before testing recovery (OPEN → HALF_OPEN). Default: 30,000 (30s) */
  resetTimeoutMs?: number;
  /** Time in ms before a single request times out. Default: 10,000 (10s) */
  requestTimeoutMs?: number;
  /** Callback when circuit opens (for alerting). */
  onOpen?: (serviceName: string) => void;
  /** Callback when circuit closes (recovery). */
  onClose?: (serviceName: string) => void;
}

export class CircuitBreakerError extends Error {
  public readonly serviceName: string;
  public readonly state: CircuitState;

  constructor(serviceName: string, state: CircuitState) {
    super(`Circuit breaker OPEN for ${serviceName} — service temporarily unavailable`);
    this.name = 'CircuitBreakerError';
    this.serviceName = serviceName;
    this.state = state;
  }
}

// ============================================================================
// CIRCUIT BREAKER IMPLEMENTATION
// ============================================================================

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly serviceName: string;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly requestTimeoutMs: number;
  private readonly onOpen?: (serviceName: string) => void;
  private readonly onClose?: (serviceName: string) => void;

  constructor(serviceName: string, options: CircuitBreakerOptions = {}) {
    this.serviceName = serviceName;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30_000;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 10_000;
    this.onOpen = options.onOpen;
    this.onClose = options.onClose;
  }

  /**
   * Execute a function through the circuit breaker.
   * Throws CircuitBreakerError if circuit is OPEN and reset timeout hasn't elapsed.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if we should transition from OPEN → HALF_OPEN
    if (this.state === CircuitState.OPEN) {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.resetTimeoutMs) {
        this.state = CircuitState.HALF_OPEN;
        logger.info(`Circuit breaker HALF_OPEN for ${this.serviceName} — testing recovery`, {
          service: this.serviceName,
          elapsedMs: elapsed,
        });
      } else {
        throw new CircuitBreakerError(this.serviceName, this.state);
      }
    }

    try {
      // Add timeout wrapper
      const result = await this.withTimeout(fn(), this.requestTimeoutMs);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Get the current state of the circuit breaker.
   */
  getState(): { state: CircuitState; failureCount: number; serviceName: string } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      serviceName: this.serviceName,
    };
  }

  /**
   * Manually reset the circuit breaker to CLOSED state.
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = 0;
    logger.info(`Circuit breaker manually reset for ${this.serviceName}`, {
      service: this.serviceName,
    });
  }

  // --- Private methods ---

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      // Recovery confirmed — close the circuit
      this.state = CircuitState.CLOSED;
      this.failureCount = 0;
      logger.info(`Circuit breaker CLOSED for ${this.serviceName} — service recovered`, {
        service: this.serviceName,
      });
      this.onClose?.(this.serviceName);
    } else {
      // Reset failure count on success in CLOSED state
      this.failureCount = 0;
    }
  }

  private onFailure(error: unknown): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      // Recovery test failed — reopen
      this.state = CircuitState.OPEN;
      logger.warn(`Circuit breaker re-OPENED for ${this.serviceName} — recovery test failed`, {
        service: this.serviceName,
        error: error instanceof Error ? error.message : String(error),
      });
    } else if (this.failureCount >= this.failureThreshold) {
      // Threshold exceeded — open the circuit
      this.state = CircuitState.OPEN;
      logger.error(`Circuit breaker OPENED for ${this.serviceName} — ${this.failureCount} consecutive failures`, {
        service: this.serviceName,
        failureCount: this.failureCount,
        error: error instanceof Error ? error.message : String(error),
      });
      this.onOpen?.(this.serviceName);
    } else {
      logger.warn(`Circuit breaker failure ${this.failureCount}/${this.failureThreshold} for ${this.serviceName}`, {
        service: this.serviceName,
        failureCount: this.failureCount,
        threshold: this.failureThreshold,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Request to ${this.serviceName} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
}

// ============================================================================
// SINGLETON REGISTRY — one breaker per service
// ============================================================================

const breakers = new Map<string, CircuitBreaker>();

/**
 * Get or create a circuit breaker for a named service.
 * Breakers are singletons — calling with the same name returns the same instance.
 *
 * @example
 * const breaker = getCircuitBreaker('openrouter');
 * const response = await breaker.execute(() => fetch('https://openrouter.ai/api/v1/chat/completions', { ... }));
 */
export function getCircuitBreaker(
  serviceName: string,
  options?: CircuitBreakerOptions
): CircuitBreaker {
  const existing = breakers.get(serviceName);
  if (existing) return existing;

  const breaker = new CircuitBreaker(serviceName, options);
  breakers.set(serviceName, breaker);
  return breaker;
}

/**
 * Get the health status of all circuit breakers.
 * Useful for health check endpoints.
 */
export function getAllCircuitBreakerStates(): Array<{
  serviceName: string;
  state: CircuitState;
  failureCount: number;
}> {
  return Array.from(breakers.values()).map((b) => b.getState());
}

// ============================================================================
// PRE-CONFIGURED BREAKERS for common Synthex external services
// ============================================================================

/** Circuit breaker for OpenRouter AI API */
export const openRouterBreaker = getCircuitBreaker('openrouter', {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  requestTimeoutMs: 30_000, // AI calls can be slow
});

/** Circuit breaker for Stripe payment API */
export const stripeBreaker = getCircuitBreaker('stripe', {
  failureThreshold: 3,
  resetTimeoutMs: 15_000,
  requestTimeoutMs: 10_000,
});

/** Circuit breaker for social platform APIs (shared threshold) */
export function getSocialPlatformBreaker(platform: string): CircuitBreaker {
  return getCircuitBreaker(`social:${platform}`, {
    failureThreshold: 5,
    resetTimeoutMs: 60_000,
    requestTimeoutMs: 15_000,
  });
}
