/**
 * Forecasting Type Definitions
 *
 * Shared types for Prophet time-series forecasting
 * and BayesNF spatiotemporal prediction.
 *
 * @module lib/forecasting/types
 */

// ─── Forecast Metric Identifiers ────────────────────────────────

export type ForecastMetric =
  | 'engagement_rate'
  | 'impressions'
  | 'reach'
  | 'clicks'
  | 'conversions'
  | 'geo_score'
  | 'authority_score'
  | 'follower_growth';

export type ForecastPlatform =
  | 'instagram'
  | 'linkedin'
  | 'twitter'
  | 'facebook'
  | 'tiktok'
  | 'youtube'
  | 'pinterest'
  | 'reddit'
  | 'threads';

export type ForecastHorizon = 7 | 30 | 90;

// ─── Prophet Request/Response Types ─────────────────────────────

export interface TrainForecastRequest {
  orgId: string;
  metric: ForecastMetric;
  platform?: string;
  data: ForecastDataPoint[];
  seasonality?: SeasonalityConfig;
  holidays?: string; // Country code (e.g., 'AU')
}

export interface ForecastDataPoint {
  ds: string; // ISO date string
  y: number;
}

export interface SeasonalityConfig {
  weekly?: boolean;
  yearly?: boolean;
  daily?: boolean;
}

export interface ForecastModelResponse {
  modelId: string;
  orgId: string;
  metric: string;
  platform: string | null;
  status: 'pending' | 'training' | 'ready' | 'failed';
  trainingPoints: number;
  lastTrainedAt: string | null;
  accuracy: ForecastAccuracy | null;
  seasonality: DetectedSeasonality | null;
}

export interface ForecastAccuracy {
  mape: number;
  rmse: number;
  mae?: number;
}

export interface DetectedSeasonality {
  weekly?: { peak_day: string };
  yearly?: { peak_month: string };
  daily?: { peak_hour: number };
}

export interface ForecastPredictRequest {
  horizonDays: ForecastHorizon;
}

export interface ForecastPrediction {
  ds: string;
  yhat: number;
  yhat_lower: number;
  yhat_upper: number;
}

export interface ForecastPredictResponse {
  modelId: string;
  predictions: ForecastPrediction[];
  accuracy: ForecastAccuracy | null;
  seasonality: DetectedSeasonality | null;
}

export interface RetrainForecastRequest {
  data: ForecastDataPoint[];
}

// ─── BayesNF Spatiotemporal Types ───────────────────────────────

export interface TrainSpatiotemporalRequest {
  orgId: string;
  name: string;
  targetMetric: string;
  dimensions: SpatiotemporalDimensions;
  data: SpatiotemporalDataPoint[];
  config?: BayesNFConfig;
}

export interface SpatiotemporalDimensions {
  spatial: string[]; // e.g., ['platform', 'region']
  temporal: string[]; // e.g., ['date']
}

export interface SpatiotemporalDataPoint {
  [key: string]: string | number;
}

export interface BayesNFConfig {
  numIterations?: number;
  learningRate?: number;
  numParticles?: number;
}

export interface SpatiotemporalModelResponse {
  modelId: string;
  orgId: string;
  name: string;
  targetMetric: string;
  dimensions: SpatiotemporalDimensions;
  status: 'pending' | 'training' | 'ready' | 'failed';
  trainingPoints: number;
  lastTrainedAt: string | null;
  accuracy: Record<string, number> | null;
}

export interface SpatiotemporalPredictRequest {
  points: SpatiotemporalDataPoint[];
  quantiles?: number[];
}

export interface SpatiotemporalPredictResponse {
  modelId: string;
  predictions: SpatiotemporalPredictionResult[];
}

export interface SpatiotemporalPredictionResult {
  point: SpatiotemporalDataPoint;
  mean: number;
  std: number;
  quantiles: Record<string, number>;
}

// ─── Service Health (extended) ──────────────────────────────────

export interface ForecastServiceHealth {
  status: 'healthy' | 'degraded' | 'down';
  version: string;
  engines: Record<string, string>;
  activeJobs: number;
}
