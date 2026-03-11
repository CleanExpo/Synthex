/**
 * Bayesian Optimisation HTTP Client
 *
 * Server-side client for the Python BO service.
 * Uses direct fetch() — this runs in API routes, not client components.
 *
 * @module lib/bayesian/client
 */

import { logger } from '@/lib/logger';
import type {
  CreateSpaceRequest,
  SpaceResponse,
  ObserveRequest,
  ObserveResponse,
  SuggestResponse,
  MaximiseRequest,
  MaximiseResponse,
  BOJobStatus,
  ServiceHealth,
} from './types';

const BASE_URL = process.env.BAYESIAN_SERVICE_URL;
const API_KEY = process.env.BAYESIAN_SERVICE_API_KEY;

class BayesianClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  // ─── BO Engine (Optimisation) ──────────────────────────────────

  async createSpace(request: CreateSpaceRequest): Promise<SpaceResponse> {
    return this.request<SpaceResponse>('/api/v1/optimise/spaces', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getSpace(spaceId: string): Promise<SpaceResponse> {
    return this.request<SpaceResponse>(`/api/v1/optimise/spaces/${spaceId}`);
  }

  async observe(spaceId: string, obs: ObserveRequest): Promise<ObserveResponse> {
    return this.request<ObserveResponse>(`/api/v1/optimise/spaces/${spaceId}/observe`, {
      method: 'POST',
      body: JSON.stringify(obs),
    });
  }

  async suggest(spaceId: string): Promise<SuggestResponse> {
    return this.request<SuggestResponse>(`/api/v1/optimise/spaces/${spaceId}/suggest`, {
      method: 'POST',
    });
  }

  async maximise(spaceId: string, opts?: MaximiseRequest): Promise<MaximiseResponse> {
    return this.request<MaximiseResponse>(`/api/v1/optimise/spaces/${spaceId}/maximise`, {
      method: 'POST',
      body: JSON.stringify(opts || {}),
    });
  }

  async getJobStatus(jobId: string): Promise<BOJobStatus> {
    return this.request<BOJobStatus>(`/api/v1/optimise/jobs/${jobId}`);
  }

  // ─── Health ────────────────────────────────────────────────────

  async health(): Promise<ServiceHealth> {
    return this.request<ServiceHealth>('/api/v1/health');
  }

  // ─── Internal ──────────────────────────────────────────────────

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': this.apiKey,
        ...options?.headers,
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error');
      logger.error(`Bayesian service error: ${response.status} ${error}`, { path });
      throw new Error(`Bayesian service error: ${response.status} — ${error}`);
    }

    return response.json() as Promise<T>;
  }
}

// ─── Singleton with health-check caching ───────────────────────────

let _client: BayesianClient | null = null;
let _available: boolean | null = null;
let _lastCheck = 0;
const HEALTH_CACHE_MS = 60_000; // Cache health for 60s

/**
 * Get the Bayesian client if the service is configured and healthy.
 * Returns null if not configured or service is down (triggers fallback).
 */
export async function getBayesianClient(): Promise<BayesianClient | null> {
  if (!BASE_URL || !API_KEY) return null; // Not configured = fallback mode

  if (!_client) {
    _client = new BayesianClient(BASE_URL, API_KEY);
  }

  // Use cached availability if recent
  if (_available !== null && Date.now() - _lastCheck < HEALTH_CACHE_MS) {
    return _available ? _client : null;
  }

  // Health check
  try {
    const health = await _client.health();
    _available = health.status !== 'down';
    _lastCheck = Date.now();
    return _available ? _client : null;
  } catch {
    _available = false;
    _lastCheck = Date.now();
    logger.warn('Bayesian service health check failed — using fallback mode');
    return null;
  }
}

/** Get client without health check (for internal use when we know it's up). */
export function getBayesianClientDirect(): BayesianClient | null {
  if (!BASE_URL || !API_KEY) return null;
  if (!_client) {
    _client = new BayesianClient(BASE_URL, API_KEY);
  }
  return _client;
}
