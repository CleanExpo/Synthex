/**
 * SYN-1032 — durable Command Centre command packet persistence + lifecycle.
 */

const mockCreate = jest.fn();
const mockFindMany = jest.fn();
const mockFindFirst = jest.fn();
const mockUpdate = jest.fn();
jest.mock('@/lib/prisma', () => ({
  prisma: {
    commandPacket: {
      create: (...a: unknown[]) => mockCreate(...a),
      findMany: (...a: unknown[]) => mockFindMany(...a),
      findFirst: (...a: unknown[]) => mockFindFirst(...a),
      update: (...a: unknown[]) => mockUpdate(...a),
    },
  },
}));

import {
  deriveSafetyFlags,
  persistCommandPacket,
  listCommandPackets,
  getCommandPacket,
  transitionCommandPacket,
} from '@/lib/unite-command-center/intake/command-packet.service';
import type { BoardInput } from '@/lib/unite-command-center/intake/board-input.schema';
import type { CommandPacket } from '@/lib/unite-command-center/ontology/command-ontology.schema';

const ORG = 'org-1';

function boardInput(overrides: Partial<BoardInput> = {}): BoardInput {
  return {
    id: 'bi-1',
    organizationId: ORG,
    source: 'manual',
    speaker: 'Phill',
    rawText: 'launch the spring campaign',
    cleanedText: 'launch the spring campaign',
    sensitivity: 'public',
    capturedAt: '2026-06-16T00:00:00.000Z',
    evidenceRefs: [],
    ...overrides,
  };
}

function commandPacket(overrides: Partial<CommandPacket> = {}): CommandPacket {
  return {
    id: 'cp-1',
    boardInputId: 'bi-1',
    title: 'Launch spring campaign',
    ontologyRefs: ['campaign'],
    teamRoute: ['@marketing'],
    scenarioState: 'ready_for_review',
    approvalGate: 'human_review',
    risks: [],
    nextAction: 'draft brief',
    outcomeMetric: 'approved_command_packet',
    ...overrides,
  };
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cp-1',
    organizationId: ORG,
    status: 'pending',
    approvalGate: 'human_review',
    evidenceRefs: [],
    ...overrides,
  };
}

describe('command-packet.service — safety flags (SYN-1032)', () => {
  it('flags production_blocked, sensitive tiers, and risks', () => {
    const flags = deriveSafetyFlags(
      boardInput({ sensitivity: 'restricted' }),
      commandPacket({ approvalGate: 'production_blocked', risks: ['legal'] })
    );
    expect(flags).toEqual(
      expect.arrayContaining(['production_blocked', 'sensitivity:restricted', 'has_risks'])
    );
  });

  it('does not flag public/internal sensitivity or a clean human_review packet', () => {
    expect(deriveSafetyFlags(boardInput({ sensitivity: 'public' }), commandPacket())).toEqual([]);
    expect(deriveSafetyFlags(boardInput({ sensitivity: 'internal' }), commandPacket())).toEqual([]);
  });
});

describe('command-packet.service — persistence', () => {
  beforeEach(() => jest.clearAllMocks());

  it('persists a draft as a pending packet with mapped fields + derived flags', async () => {
    mockCreate.mockResolvedValue(row());
    await persistCommandPacket({
      organizationId: ORG,
      createdById: 'user-1',
      boardInput: boardInput({ sensitivity: 'confidential' }),
      commandPacket: commandPacket({ risks: ['budget'] }),
    });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const data = mockCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({
      organizationId: ORG,
      createdById: 'user-1',
      status: 'pending',
      title: 'Launch spring campaign',
      boardInputId: 'bi-1',
    });
    expect(data.safetyFlags).toEqual(
      expect.arrayContaining(['sensitivity:confidential', 'has_risks'])
    );
    expect(data.evidenceRefs).toEqual([]);
  });

  it('lists packets org-scoped, newest first', async () => {
    mockFindMany.mockResolvedValue([row()]);
    await listCommandPackets(ORG);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { organizationId: ORG },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('inspects a packet org-scoped (id + organizationId)', async () => {
    mockFindFirst.mockResolvedValue(row());
    await getCommandPacket(ORG, 'cp-1');
    expect(mockFindFirst).toHaveBeenCalledWith({ where: { id: 'cp-1', organizationId: ORG } });
  });
});

describe('command-packet.service — lifecycle transitions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns not_found when the packet does not exist', async () => {
    mockFindFirst.mockResolvedValue(null);
    const r = await transitionCommandPacket(ORG, 'missing', 'approve');
    expect(r).toEqual({ ok: false, error: 'not_found' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('approves a pending packet (pending → approved)', async () => {
    mockFindFirst.mockResolvedValue(row({ status: 'pending' }));
    mockUpdate.mockResolvedValue(row({ status: 'approved' }));
    const r = await transitionCommandPacket(ORG, 'cp-1', 'approve');
    expect(r.ok).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'cp-1' },
      data: { status: 'approved' },
    });
  });

  it('refuses to approve a production_blocked packet (safety gate)', async () => {
    mockFindFirst.mockResolvedValue(row({ status: 'pending', approvalGate: 'production_blocked' }));
    const r = await transitionCommandPacket(ORG, 'cp-1', 'approve');
    expect(r).toMatchObject({ ok: false, error: 'production_blocked' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('is idempotent — re-issuing the current state is a no-op', async () => {
    mockFindFirst.mockResolvedValue(row({ status: 'approved' }));
    const r = await transitionCommandPacket(ORG, 'cp-1', 'approve');
    expect(r).toMatchObject({ ok: true, noop: true });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rejects an invalid transition (route while still pending)', async () => {
    mockFindFirst.mockResolvedValue(row({ status: 'pending' }));
    const r = await transitionCommandPacket(ORG, 'cp-1', 'route');
    expect(r).toMatchObject({ ok: false, error: 'invalid_transition' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('appends an evidence ref on completion', async () => {
    mockFindFirst.mockResolvedValue(row({ status: 'routed', evidenceRefs: ['linear:SYN-1'] }));
    mockUpdate.mockResolvedValue(row({ status: 'complete' }));
    await transitionCommandPacket(ORG, 'cp-1', 'complete', 'obsidian:note-9');
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'cp-1' },
      data: { status: 'complete', evidenceRefs: { set: ['linear:SYN-1', 'obsidian:note-9'] } },
    });
  });
});
