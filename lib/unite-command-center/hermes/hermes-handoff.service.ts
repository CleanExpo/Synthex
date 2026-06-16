export type HermesChannel = 'telegram' | 'whatsapp' | 'plaud' | 'obsidian';

export interface HermesRuntimeStatus {
  gatewayRunning: boolean;
  telegramConfigured: boolean;
  whatsappConfigured: boolean;
  scheduledJobsActive: number;
}

export interface HermesSourceMapEntry {
  channel: HermesChannel;
  label: string;
  mode: 'ready' | 'draft_bridge' | 'blocked';
  route: string;
  guardrail: string;
}

export interface HermesHandoffPacket {
  status: 'ready' | 'degraded' | 'blocked';
  sourceMap: HermesSourceMapEntry[];
  allowedUses: string[];
  blockedActions: string[];
  nextCheckpoint: string;
}

/** Environment lookup (presence only — values are never read for content). */
export interface HermesEnvironment {
  [key: string]: string | undefined;
}

/** Live runtime readiness for the Command Centre — packet plus audit metadata. */
export interface HermesHandoffReadiness {
  /** Worst-case handoff status from the packet. */
  status: HermesHandoffPacket['status'];
  packet: HermesHandoffPacket;
  runtime: HermesRuntimeStatus;
  /** Operator-facing labels for missing config — env-var names only, never values. */
  missing: string[];
  /** Where the status was derived from, for auditability. */
  sourceOfTruth: string;
}

const TELEGRAM_KEYS = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'] as const;
const WHATSAPP_KEYS = ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'] as const;

/**
 * Derive Hermes runtime status from environment presence only. Mirrors the
 * provider-readiness registry idiom: pure function of env, never reads a secret
 * value (only `Boolean(env[key])` presence), so it is fully unit-testable.
 */
export function collectHermesRuntimeStatus(
  env: HermesEnvironment
): HermesRuntimeStatus {
  return {
    // The Hermes gateway is the Telegram bot gateway — its token gates the runtime.
    gatewayRunning: Boolean(env.TELEGRAM_BOT_TOKEN),
    telegramConfigured: TELEGRAM_KEYS.every(key => Boolean(env[key])),
    whatsappConfigured: WHATSAPP_KEYS.every(key => Boolean(env[key])),
    // Active-job count is not derivable from env; surfaced honestly as 0 here.
    scheduledJobsActive: 0,
  };
}

/**
 * Build the live, auditable Hermes handoff readiness from environment presence.
 * Lists which config is missing by env-var name (names are not secrets) so the
 * operator can act, without ever exposing a credential value.
 */
export function buildHermesHandoffReadiness(
  env: HermesEnvironment
): HermesHandoffReadiness {
  const runtime = collectHermesRuntimeStatus(env);
  const packet = buildHermesHandoffPacket(runtime);

  const missing: string[] = [];
  if (!runtime.gatewayRunning) {
    missing.push('Hermes gateway (TELEGRAM_BOT_TOKEN) not configured');
  }
  if (!runtime.telegramConfigured) {
    missing.push('Telegram channel (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID) not fully configured');
  }
  if (!runtime.whatsappConfigured) {
    missing.push('WhatsApp channel (WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID) not configured');
  }

  return {
    status: packet.status,
    packet,
    runtime,
    missing,
    sourceOfTruth: 'Server environment presence checks (no secret values read)',
  };
}

export function buildHermesHandoffPacket(
  runtime: HermesRuntimeStatus
): HermesHandoffPacket {
  const sourceMap = buildHermesSourceMap(runtime);
  const hasReadyIntake = sourceMap.some(entry => entry.mode !== 'blocked');

  return {
    status:
      runtime.gatewayRunning && hasReadyIntake
        ? 'ready'
        : runtime.gatewayRunning
          ? 'degraded'
          : 'blocked',
    sourceMap,
    allowedUses: [
      'continuous observations',
      'morning action briefs',
      'Telegram input routing to draft intake',
      'portfolio health summaries',
      'stale task nudges',
    ],
    blockedActions: [
      'production deployments',
      'public publishing',
      'ad spend',
      'private data broadcast',
      'unaudited code commits',
    ],
    nextCheckpoint: runtime.gatewayRunning
      ? 'Route Telegram inputs to draft command packets only.'
      : 'Restore Hermes gateway before accepting live intake.',
  };
}

function buildHermesSourceMap(
  runtime: HermesRuntimeStatus
): HermesSourceMapEntry[] {
  return [
    {
      channel: 'telegram',
      label: 'Telegram command intake',
      mode:
        runtime.gatewayRunning && runtime.telegramConfigured
          ? 'draft_bridge'
          : 'blocked',
      route: '/api/command-centre/intake',
      guardrail: 'Create draft command packets only.',
    },
    {
      channel: 'whatsapp',
      label: 'WhatsApp command intake',
      mode:
        runtime.gatewayRunning && runtime.whatsappConfigured
          ? 'draft_bridge'
          : 'blocked',
      route: '/api/command-centre/intake',
      guardrail: 'Blocked until WhatsApp is configured and contact policy passes.',
    },
    {
      channel: 'plaud',
      label: 'Plaud meeting notes',
      mode: 'ready',
      route: '/api/command-centre/intake',
      guardrail: 'Transcript imports require evidence refs before review.',
    },
    {
      channel: 'obsidian',
      label: 'Brain-1 and Obsidian source',
      mode: 'ready',
      route: '/api/command-centre/intake',
      guardrail: 'Source notes become draft evidence, not direct execution.',
    },
  ];
}
