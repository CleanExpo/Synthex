/**
 * Connection-health spine (SYN-1030).
 *
 * A single shared mapper that tells the app and agents whether each operational
 * system Synthex depends on is ready, stale, blocked, or needs human action:
 * Linear intake, Obsidian / 2nd-brain writeback, Unite-Group CRM / Hermes handoff,
 * and social credential references.
 *
 * This module is a PURE mapper over already-collected signals (booleans, counts,
 * and the Hermes packet status). It never reads, prints, or stores a secret — the
 * route layer collects presence/health signals and hands them here. Output is
 * framed as operator actions, not raw technical diagnostics.
 *
 * @module lib/connection-spine/health
 */

import type { HermesHandoffPacket } from '@/lib/unite-command-center/hermes/hermes-handoff.service';

/** Operational status, ordered worst-last for severity ranking. */
export type SpineStatus = 'ready' | 'stale' | 'action_required' | 'blocked';

export type SpineSystem = 'linear' | 'obsidian' | 'hermes' | 'social';

export interface SpineSystemHealth {
  system: SpineSystem;
  label: string;
  status: SpineStatus;
  /** Operator-facing one-liner (what it means), never a raw stack/diagnostic. */
  detail: string;
  /** The action to take when not ready (omitted when ready). */
  action?: string;
}

export interface ConnectionSpineHealth {
  /** Worst status across all systems — the headline for the dashboard. */
  overall: SpineStatus;
  systems: SpineSystemHealth[];
  /** Count of systems that need a human action or are blocked. */
  blockerCount: number;
}

/**
 * Signals collected by the route. All presence/health booleans and counts — no
 * secret values ever cross this boundary.
 */
export interface ConnectionSpineSignals {
  linear: { webhookConfigured: boolean; queueReachable: boolean };
  obsidian: { enabled: boolean };
  /** Hermes handoff packet status (ready | degraded | blocked). */
  hermes: { status: HermesHandoffPacket['status'] };
  /** Social connection references — counts only, reference-only, review-gated. */
  social: { referenceCount: number; needsReauthCount: number };
}

const SEVERITY: Record<SpineStatus, number> = {
  ready: 0,
  stale: 1,
  action_required: 2,
  blocked: 3,
};

function mapLinear(s: ConnectionSpineSignals['linear']): SpineSystemHealth {
  if (!s.webhookConfigured) {
    return {
      system: 'linear',
      label: 'Linear intake',
      status: 'action_required',
      detail: 'Autonomous intake is off — the Linear webhook is not configured.',
      action: 'Add the Linear webhook secret so issues queue automatically.',
    };
  }
  if (!s.queueReachable) {
    return {
      system: 'linear',
      label: 'Linear intake',
      status: 'stale',
      detail: 'Webhook is configured but the task queue is unreachable, so work is not running.',
      action: 'Restore the queue worker to resume autonomous runs.',
    };
  }
  return {
    system: 'linear',
    label: 'Linear intake',
    status: 'ready',
    detail: 'Labelled issues queue and run automatically.',
  };
}

function mapObsidian(s: ConnectionSpineSignals['obsidian']): SpineSystemHealth {
  return s.enabled
    ? {
        system: 'obsidian',
        label: 'Obsidian / 2nd brain',
        status: 'ready',
        detail: 'Writeback to the 2nd-brain vault is active.',
      }
    : {
        system: 'obsidian',
        label: 'Obsidian / 2nd brain',
        status: 'action_required',
        detail: 'Research and decisions are not being written back to the 2nd brain.',
        action: 'Connect the Obsidian / 2nd-brain vault to enable writeback.',
      };
}

function mapHermes(s: ConnectionSpineSignals['hermes']): SpineSystemHealth {
  const base = { system: 'hermes' as const, label: 'Unite-Group CRM / Hermes' };
  if (s.status === 'ready') {
    return { ...base, status: 'ready', detail: 'CRM/Hermes handoff is ready for intake routing.' };
  }
  if (s.status === 'degraded') {
    return {
      ...base,
      status: 'stale',
      detail: 'Hermes gateway is up but some channels are in draft-only mode.',
      action: 'Restore the remaining Hermes channels for full intake.',
    };
  }
  return {
    ...base,
    status: 'blocked',
    detail: 'The Hermes gateway is down — no live CRM intake.',
    action: 'Restore the Hermes gateway before accepting live intake.',
  };
}

function mapSocial(s: ConnectionSpineSignals['social']): SpineSystemHealth {
  const base = { system: 'social' as const, label: 'Social credentials' };
  if (s.referenceCount === 0) {
    return {
      ...base,
      status: 'action_required',
      detail: 'No social connections are linked yet.',
      action: 'Link social accounts to enable publishing and metrics.',
    };
  }
  if (s.needsReauthCount > 0) {
    return {
      ...base,
      status: 'action_required',
      detail: `${s.needsReauthCount} social connection${s.needsReauthCount === 1 ? '' : 's'} need re-authorisation.`,
      action: 'Re-authorise the affected social connections.',
    };
  }
  return { ...base, status: 'ready', detail: 'Social connections are linked and current.' };
}

/** Map collected signals into a unified, operator-framed connection-health spine. */
export function mapConnectionSpineHealth(
  signals: ConnectionSpineSignals
): ConnectionSpineHealth {
  const systems: SpineSystemHealth[] = [
    mapLinear(signals.linear),
    mapObsidian(signals.obsidian),
    mapHermes(signals.hermes),
    mapSocial(signals.social),
  ];

  const overall = systems.reduce<SpineStatus>(
    (worst, s) => (SEVERITY[s.status] > SEVERITY[worst] ? s.status : worst),
    'ready'
  );
  const blockerCount = systems.filter(
    s => s.status === 'action_required' || s.status === 'blocked'
  ).length;

  return { overall, systems, blockerCount };
}
