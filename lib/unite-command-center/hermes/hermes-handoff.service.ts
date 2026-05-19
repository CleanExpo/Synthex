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
