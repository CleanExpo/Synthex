/**
 * Bayesian Optimisation Type Definitions
 *
 * Shared types for the BO parameter optimisation engine.
 *
 * @module lib/bayesian/types
 */

// ─── Optimisation Surface Identifiers ──────────────────────────────

export type BOSurface =
  | 'geo_score_weights'
  | 'tactic_weights'
  | 'experiment_sampling'
  | 'content_scheduling'
  | 'prompt_testing'
  | 'backlink_scoring'
  | 'authority_validation'
  | 'psychology_levers'
  | 'self_healing_priority'
  | 'campaign_roi';

export type AcquisitionFunction = 'ucb' | 'ei' | 'poi';

// ─── Request/Response Types ────────────────────────────────────────

export interface ParameterBounds {
  min: number;
  max: number;
}

export interface CreateSpaceRequest {
  spaceId: string;
  orgId: string;
  surface: BOSurface;
  parameters: Record<string, ParameterBounds>;
  acquisitionFunction?: AcquisitionFunction;
  constraints?: {
    sumEquals?: number;
  };
}

export interface SpaceResponse {
  spaceId: string;
  orgId: string;
  surface: string;
  parameters: Record<string, ParameterBounds>;
  acquisitionFunction: string;
  totalObservations: number;
  bestParameters: Record<string, number> | null;
  bestTarget: number | null;
}

export interface ObserveRequest {
  parameters: Record<string, number>;
  target: number;
  metadata?: Record<string, unknown>;
}

export interface ObserveResponse {
  id: string;
  spaceId: string;
  totalObservations: number;
}

export interface SuggestResponse {
  suggestedParameters: Record<string, number>;
  expectedImprovement: number;
  acquisitionValue: number;
  iteration: number;
}

export interface MaximiseRequest {
  initPoints?: number;
  nIterations?: number;
  callbackUrl?: string;
}

export interface MaximiseResponse {
  jobId: string;
  status: string;
}

export interface BOJobStatus {
  jobId: string;
  spaceId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  currentIteration: number;
  bestParameters: Record<string, number> | null;
  bestTarget: number | null;
  error: string | null;
}

// ─── Service Health ────────────────────────────────────────────────

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'down';
  version: string;
  engines: Record<string, string>;
  activeJobs: number;
}
