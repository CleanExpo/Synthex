import type { GateStatus } from '../types';

export type SignalStatus =
  | 'captured'
  | 'linked'
  | 'scored'
  | 'assigned'
  | 'validated'
  | 'converted_to_opportunity'
  | 'blocked'
  | 'archived';

export type SignalSourceKind =
  | 'youtube'
  | 'reddit'
  | 'search'
  | 'social'
  | 'shopify'
  | 'crm'
  | 'obsidian'
  | 'manual'
  | 'analytics'
  | 'apify';

export interface GovernedSource {
  id: string;
  kind: SignalSourceKind;
  label: string;
  sourceUrl?: string;
  sourcePath?: string;
  capturedAt: string;
  permissionContext: 'public' | 'owned' | 'client-approved' | 'internal' | 'restricted';
}

export interface GovernedSignal {
  id: string;
  source: GovernedSource;
  capturedAt: string;
  business: string;
  client: string;
  product: string;
  audienceSegment: string;
  narrative: string;
  content: string;
  freshness: number;
  confidence: number;
  commercialImpact: number;
  creativePotential: number;
  risk: number;
  status: SignalStatus;
  evidenceRefs: string[];
}

export interface SignalScore {
  signalId: string;
  freshness: number;
  confidence: number;
  commercialImpact: number;
  creativePotential: number;
  risk: number;
  total: number;
}

export interface SignalRiskState {
  signalId: string;
  state: 'clear' | 'watch' | 'blocked';
  reasons: string[];
}

export interface SignalApprovalGate {
  signalId: string;
  status: GateStatus;
  blockedReasons: string[];
  warnings: string[];
}

export interface RankedSignal {
  signal: GovernedSignal;
  score: SignalScore;
  riskState: SignalRiskState;
  approvalGate: SignalApprovalGate;
  canConvertToOpportunity: boolean;
}

export interface GovernedOpportunity {
  id: string;
  signalId: string;
  title: string;
  recommendation: string;
  score: number;
  confidence: number;
  risk: number;
  evidenceRefs: string[];
  approvalGate: SignalApprovalGate;
  nextAction: string;
  outcomeMetric: string;
}

const MINIMUM_EVIDENCE_COUNT = 1;
const MINIMUM_CONFIDENCE = 0.55;
const HIGH_RISK_THRESHOLD = 0.75;
const WATCH_RISK_THRESHOLD = 0.45;

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function sourceHasReference(source: GovernedSource): boolean {
  return Boolean(source.sourceUrl || source.sourcePath);
}

export function scoreGovernedSignal(signal: GovernedSignal): SignalScore {
  const freshness = clampScore(signal.freshness);
  const confidence = clampScore(signal.confidence);
  const commercialImpact = clampScore(signal.commercialImpact);
  const creativePotential = clampScore(signal.creativePotential);
  const risk = clampScore(signal.risk);

  const total =
    freshness * 0.2 +
    confidence * 0.25 +
    commercialImpact * 0.25 +
    creativePotential * 0.2 -
    risk * 0.1;

  return {
    signalId: signal.id,
    freshness,
    confidence,
    commercialImpact,
    creativePotential,
    risk,
    total: roundScore(clampScore(total)),
  };
}

export function evaluateSignalRisk(signal: GovernedSignal): SignalRiskState {
  const reasons: string[] = [];

  if (signal.evidenceRefs.length < MINIMUM_EVIDENCE_COUNT) {
    reasons.push('Signal has no linked evidence references.');
  }

  if (!sourceHasReference(signal.source)) {
    reasons.push('Signal source is missing a URL or Wiki path reference.');
  }

  if (clampScore(signal.confidence) < MINIMUM_CONFIDENCE) {
    reasons.push('Signal confidence is below the opportunity threshold.');
  }

  if (clampScore(signal.risk) >= HIGH_RISK_THRESHOLD) {
    reasons.push('Signal risk is too high for opportunity conversion.');
  }

  if (reasons.length > 0) {
    return { signalId: signal.id, state: 'blocked', reasons };
  }

  if (clampScore(signal.risk) >= WATCH_RISK_THRESHOLD) {
    return {
      signalId: signal.id,
      state: 'watch',
      reasons: ['Signal can proceed only as draft intelligence until review.'],
    };
  }

  return { signalId: signal.id, state: 'clear', reasons: [] };
}

export function buildSignalApprovalGate(signal: GovernedSignal): SignalApprovalGate {
  return gateFromRiskState(signal.id, evaluateSignalRisk(signal));
}

function gateFromRiskState(signalId: string, riskState: SignalRiskState): SignalApprovalGate {
  if (riskState.state === 'blocked') {
    return {
      signalId,
      status: 'blocked',
      blockedReasons: riskState.reasons,
      warnings: [],
    };
  }

  return {
    signalId,
    status: riskState.state === 'watch' ? 'warn' : 'pass',
    blockedReasons: [],
    warnings: riskState.reasons,
  };
}

export function rankGovernedSignals(signals: GovernedSignal[]): RankedSignal[] {
  return signals
    .map(signal => {
      const score = scoreGovernedSignal(signal);
      const riskState = evaluateSignalRisk(signal);
      const approvalGate = gateFromRiskState(signal.id, riskState);

      return {
        signal,
        score,
        riskState,
        approvalGate,
        canConvertToOpportunity: approvalGate.status !== 'blocked',
      };
    })
    .sort((a, b) => b.score.total - a.score.total);
}

export function convertSignalsToOpportunities(
  signals: GovernedSignal[]
): GovernedOpportunity[] {
  return rankGovernedSignals(signals)
    .filter(ranked => ranked.canConvertToOpportunity)
    .map(ranked => ({
      id: `opportunity-${ranked.signal.id}`,
      signalId: ranked.signal.id,
      title: ranked.signal.narrative,
      recommendation: `Draft a campaign scenario for ${ranked.signal.product} aimed at ${ranked.signal.audienceSegment}.`,
      score: Math.round(ranked.score.total * 100),
      confidence: ranked.score.confidence,
      risk: ranked.score.risk,
      evidenceRefs: ranked.signal.evidenceRefs,
      approvalGate: ranked.approvalGate,
      nextAction: 'Create a draft scenario with evidence, risk, and approval gates preserved.',
      outcomeMetric: 'Validated opportunity converted into a reviewed campaign draft.',
    }));
}
