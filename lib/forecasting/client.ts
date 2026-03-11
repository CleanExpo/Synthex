/**
 * Forecasting HTTP Client
 *
 * Server-side client for Prophet and BayesNF engines
 * in the Python AI service.
 *
 * Reuses the same service URL and API key as the BO client.
 *
 * @module lib/forecasting/client
 */

import { logger } from '@/lib/logger';
import type {
  TrainForecastRequest,
  ForecastModelResponse,
  ForecastPredictRequest,
  ForecastPredictResponse,
  RetrainForecastRequest,
  TrainSpatiotemporalRequest,
  SpatiotemporalModelResponse,
  SpatiotemporalPredictRequest,
  SpatiotemporalPredictResponse,
} from './types';

const BASE_URL = process.env.BAYESIAN_SERVICE_URL;
const API_KEY = process.env.BAYESIAN_SERVICE_API_KEY;

class ForecastingClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  // ─── Prophet (Forecasting) ────────────────────────────────────

  async trainForecastModel(request: TrainForecastRequest): Promise<ForecastModelResponse> {
    return this.request<ForecastModelResponse>('/api/v1/forecast/models', {
      method: 'POST',
      body: JSON.stringify(request),
    }, 120_000); // Training can take up to 2min
  }

  async getForecastModel(modelId: string): Promise<ForecastModelResponse> {
    return this.request<ForecastModelResponse>(`/api/v1/forecast/models/${modelId}`);
  }

  async predictForecast(
    modelId: string,
    request: ForecastPredictRequest,
  ): Promise<ForecastPredictResponse> {
    return this.request<ForecastPredictResponse>(
      `/api/v1/forecast/models/${modelId}/predict`,
      { method: 'POST', body: JSON.stringify(request) },
    );
  }

  async retrainForecastModel(
    modelId: string,
    request: RetrainForecastRequest,
  ): Promise<ForecastModelResponse> {
    return this.request<ForecastModelResponse>(
      `/api/v1/forecast/models/${modelId}/retrain`,
      { method: 'POST', body: JSON.stringify(request) },
      120_000,
    );
  }

  async listForecastModels(orgId: string): Promise<ForecastModelResponse[]> {
    return this.request<ForecastModelResponse[]>(
      `/api/v1/forecast/models?orgId=${encodeURIComponent(orgId)}`,
    );
  }

  // ─── BayesNF (Spatiotemporal) ─────────────────────────────────

  async trainSpatiotemporalModel(
    request: TrainSpatiotemporalRequest,
  ): Promise<SpatiotemporalModelResponse> {
    return this.request<SpatiotemporalModelResponse>('/api/v1/predict/models', {
      method: 'POST',
      body: JSON.stringify(request),
    }, 300_000); // GPU training can take 5min
  }

  async getSpatiotemporalModel(modelId: string): Promise<SpatiotemporalModelResponse> {
    return this.request<SpatiotemporalModelResponse>(
      `/api/v1/predict/models/${modelId}`,
    );
  }

  async predictSpatiotemporal(
    modelId: string,
    request: SpatiotemporalPredictRequest,
  ): Promise<SpatiotemporalPredictResponse> {
    return this.request<SpatiotemporalPredictResponse>(
      `/api/v1/predict/models/${modelId}/predict`,
      { method: 'POST', body: JSON.stringify(request) },
    );
  }

  async listSpatiotemporalModels(orgId: string): Promise<SpatiotemporalModelResponse[]> {
    return this.request<SpatiotemporalModelResponse[]>(
      `/api/v1/predict/models?orgId=${encodeURIComponent(orgId)}`,
    );
  }

  // ─── Internal ──────────────────────────────────────────────────

  private async request<T>(
    path: string,
    options?: RequestInit,
    timeoutMs: number = 30_000,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': this.apiKey,
        ...options?.headers,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error');
      logger.error(`Forecasting service error: ${response.status} ${error}`, { path });
      throw new Error(`Forecasting service error: ${response.status} — ${error}`);
    }

    return response.json() as Promise<T>;
  }
}

// ─── Singleton ──────────────────────────────────────────────────

let _client: ForecastingClient | null = null;

/**
 * Get the forecasting client if the service is configured.
 * Returns null if not configured (triggers graceful no-op).
 *
 * Note: health checking is handled by the BO client's getBayesianClient().
 * This client assumes the service is reachable and lets individual calls
 * fail with proper error handling at the call site.
 */
export function getForecastingClient(): ForecastingClient | null {
  if (!BASE_URL || !API_KEY) return null;

  if (!_client) {
    _client = new ForecastingClient(BASE_URL, API_KEY);
  }

  return _client;
}
