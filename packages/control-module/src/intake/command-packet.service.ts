/**
 * Command Centre — durable command packet persistence + lifecycle (SYN-1032).
 *
 * Turns a draft intake result (board input + command packet) into a persisted,
 * org-scoped work item with a durable lifecycle, and exposes the operations the
 * Command Centre and background workers need: list, inspect, and transition
 * (approve / route / complete / block). Provider execution is never triggered
 * here — a packet only carries intent and routing metadata; existing approval
 * and provider-readiness gates remain the sole execution authority.
 *
 * Extraction note (REV-2): the persistence functions used to close over a
 * module-level `import { prisma } from '@/lib/prisma'`. In the shared package
 * that host-specific client must not be imported; instead the service is a
 * factory — `createCommandPacketService(prisma)` — that threads an injected,
 * structurally-typed client through the same logic. The host binds it once (see
 * the Synthex stub `lib/unite-command-center/intake/command-packet.service.ts`).
 *
 * @module @unite-group/control-module/intake/command-packet.service
 */

import type { BoardInput } from './board-input.schema';
import type { CommandPacket } from '../ontology/command-ontology.schema';

/** Durable lifecycle states a persisted packet moves through. */
export type CommandPacketStatus =
  | 'pending'
  | 'approved'
  | 'routed'
  | 'complete'
  | 'blocked';

/** Operator/worker actions that drive the lifecycle. */
export type CommandPacketAction = 'approve' | 'route' | 'complete' | 'block';

export interface PersistCommandPacketInput {
  organizationId: string;
  createdById: string;
  boardInput: BoardInput;
  commandPacket: CommandPacket;
}

export interface TransitionResult {
  ok: boolean;
  /** Reason when ok === false (e.g. 'production_blocked', 'invalid_transition', 'not_found'). */
  error?: string;
  packet?: PersistedCommandPacket;
  /** True when the packet was already in the target state (idempotent no-op). */
  noop?: boolean;
}

/** The persisted row shape returned to callers (Prisma row). */
export interface PersistedCommandPacket {
  id: string;
  organizationId: string;
  createdById: string;
  source: string;
  speaker: string;
  rawText: string;
  cleanedText: string;
  sensitivity: string;
  boardInputId: string;
  title: string;
  ontologyRefs: string[];
  teamRoute: string[];
  scenarioState: string;
  approvalGate: string;
  risks: string[];
  nextAction: string;
  outcomeMetric: string;
  status: string;
  safetyFlags: string[];
  routingHints: unknown;
  evidenceRefs: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Minimal structural contract for the persistence client the host injects. The
 * real Synthex `@/lib/prisma` client (and any equivalent host client exposing a
 * `commandPacket` delegate) satisfies this by structural typing — the package
 * never imports `@prisma/client`, keeping it host-agnostic and dependency-light.
 */
export interface CommandPacketPrismaClient {
  commandPacket: {
    create(args: unknown): Promise<unknown>;
    findMany(args: unknown): Promise<unknown>;
    findFirst(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
}

/** The bound service surface returned by {@link createCommandPacketService}. */
export interface CommandPacketService {
  persistCommandPacket(
    input: PersistCommandPacketInput
  ): Promise<PersistedCommandPacket>;
  listCommandPackets(organizationId: string): Promise<PersistedCommandPacket[]>;
  getCommandPacket(
    organizationId: string,
    id: string
  ): Promise<PersistedCommandPacket | null>;
  transitionCommandPacket(
    organizationId: string,
    id: string,
    action: CommandPacketAction,
    evidenceRef?: string
  ): Promise<TransitionResult>;
}

/**
 * Allowed lifecycle transitions. A packet whose approvalGate is
 * `production_blocked` may never be approved — it stays out of the execution
 * path until a human resolves the block (then `block`/manual handling applies).
 */
const TRANSITIONS: Record<
  CommandPacketAction,
  { from: CommandPacketStatus[]; to: CommandPacketStatus }
> = {
  approve: { from: ['pending'], to: 'approved' },
  route: { from: ['approved'], to: 'routed' },
  complete: { from: ['routed', 'approved'], to: 'complete' },
  block: { from: ['pending', 'approved', 'routed'], to: 'blocked' },
};

/**
 * Derive durable safety flags from the source intake + packet. These travel with
 * the row so a worker can refuse to act without re-deriving from the raw text.
 */
const SENSITIVE_TIERS = new Set(['confidential', 'restricted']);

export function deriveSafetyFlags(
  boardInput: BoardInput,
  packet: CommandPacket
): string[] {
  const flags: string[] = [];
  if (packet.approvalGate === 'production_blocked')
    flags.push('production_blocked');
  if (SENSITIVE_TIERS.has(boardInput.sensitivity)) {
    flags.push(`sensitivity:${boardInput.sensitivity}`);
  }
  if (packet.risks.length > 0) flags.push('has_risks');
  return flags;
}

/**
 * Construct the command-packet persistence service bound to a host `prisma`
 * client. The returned functions carry the identical behaviour and signatures
 * the free-function exports had before extraction, so a host binding stub can
 * re-export them unchanged and every existing call site stays zero-arg.
 */
export function createCommandPacketService(
  prisma: CommandPacketPrismaClient
): CommandPacketService {
  /** Persist a draft intake result as a durable, pending command packet. */
  async function persistCommandPacket(
    input: PersistCommandPacketInput
  ): Promise<PersistedCommandPacket> {
    const { organizationId, createdById, boardInput, commandPacket } = input;
    return prisma.commandPacket.create({
      data: {
        organizationId,
        createdById,
        source: boardInput.source,
        speaker: boardInput.speaker,
        rawText: boardInput.rawText,
        cleanedText: boardInput.cleanedText,
        sensitivity: boardInput.sensitivity,
        boardInputId: commandPacket.boardInputId,
        title: commandPacket.title,
        ontologyRefs: commandPacket.ontologyRefs,
        teamRoute: commandPacket.teamRoute,
        scenarioState: commandPacket.scenarioState,
        approvalGate: commandPacket.approvalGate,
        risks: commandPacket.risks,
        nextAction: commandPacket.nextAction,
        outcomeMetric: commandPacket.outcomeMetric,
        status: 'pending',
        safetyFlags: deriveSafetyFlags(boardInput, commandPacket),
        evidenceRefs: [],
      },
    }) as Promise<PersistedCommandPacket>;
  }

  /** List an organisation's command packets, newest first. */
  async function listCommandPackets(
    organizationId: string
  ): Promise<PersistedCommandPacket[]> {
    return prisma.commandPacket.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    }) as Promise<PersistedCommandPacket[]>;
  }

  /** Inspect one packet, org-scoped (never returns another org's row). */
  async function getCommandPacket(
    organizationId: string,
    id: string
  ): Promise<PersistedCommandPacket | null> {
    return prisma.commandPacket.findFirst({
      where: { id, organizationId },
    }) as Promise<PersistedCommandPacket | null>;
  }

  /**
   * Drive a packet through its lifecycle. Org-scoped, idempotent (re-issuing the
   * same target state is a no-op), and gate-aware (a production_blocked packet can
   * never be approved). Optionally appends an evidence link on the transition.
   */
  async function transitionCommandPacket(
    organizationId: string,
    id: string,
    action: CommandPacketAction,
    evidenceRef?: string
  ): Promise<TransitionResult> {
    const packet = await getCommandPacket(organizationId, id);
    if (!packet) return { ok: false, error: 'not_found' };

    const rule = TRANSITIONS[action];
    if (!rule) return { ok: false, error: 'invalid_action' };

    // Idempotent no-op: already in the target state.
    if (packet.status === rule.to) {
      return { ok: true, noop: true, packet };
    }

    // Safety gate: never approve a production-blocked packet into the exec path.
    if (action === 'approve' && packet.approvalGate === 'production_blocked') {
      return { ok: false, error: 'production_blocked', packet };
    }

    if (!rule.from.includes(packet.status as CommandPacketStatus)) {
      return { ok: false, error: 'invalid_transition', packet };
    }

    const updated = (await prisma.commandPacket.update({
      where: { id: packet.id },
      data: {
        status: rule.to,
        ...(evidenceRef
          ? { evidenceRefs: { set: [...packet.evidenceRefs, evidenceRef] } }
          : {}),
      },
    })) as PersistedCommandPacket;

    return { ok: true, packet: updated };
  }

  return {
    persistCommandPacket,
    listCommandPackets,
    getCommandPacket,
    transitionCommandPacket,
  };
}
