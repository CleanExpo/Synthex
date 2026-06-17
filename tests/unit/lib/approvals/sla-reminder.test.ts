/**
 * Unit test — sendApprovalSlaReminders (backlog #12 SLA-reminder slice).
 *
 * Isolates the worker by mocking prisma. Covers the dedupe query (open status +
 * lapsed dueDate + not-yet-reminded), the no-op early return, the submitter
 * notification shape, and the slaReminderSentAt stamp that prevents re-notifying.
 */

const findManyApproval = jest.fn();
const updateManyApproval = jest.fn();
const createManyNotification = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    approvalRequest: {
      findMany: (...a: unknown[]) => findManyApproval(...a),
      updateMany: (...a: unknown[]) => updateManyApproval(...a),
    },
    notification: {
      createMany: (...a: unknown[]) => createManyNotification(...a),
    },
  },
}));

import { sendApprovalSlaReminders } from '@/lib/approvals/sla-reminder';

const NOW = new Date('2026-06-18T09:15:00.000Z');

beforeEach(() => {
  jest.clearAllMocks();
  findManyApproval.mockResolvedValue([]);
  createManyNotification.mockResolvedValue({ count: 0 });
  updateManyApproval.mockResolvedValue({ count: 0 });
});

describe('sendApprovalSlaReminders', () => {
  test('no overdue approvals → reminded 0, no writes', async () => {
    const res = await sendApprovalSlaReminders({ now: NOW });
    expect(res).toEqual({ reminded: 0 });
    expect(createManyNotification).not.toHaveBeenCalled();
    expect(updateManyApproval).not.toHaveBeenCalled();
  });

  test('query is scoped: open status, lapsed dueDate, not yet reminded', async () => {
    await sendApprovalSlaReminders({ now: NOW });
    expect(findManyApproval.mock.calls[0][0].where).toEqual({
      status: { in: ['pending', 'in_review'] },
      dueDate: { lte: NOW },
      slaReminderSentAt: null,
    });
  });

  test('overdue → notifies the submitter with the SLA source tag', async () => {
    findManyApproval.mockResolvedValue([
      { id: 'appr-1', title: 'Launch post', submittedBy: 'user-1' },
      { id: 'appr-2', title: 'Q3 campaign', submittedBy: 'user-2' },
    ]);
    const res = await sendApprovalSlaReminders({ now: NOW });

    expect(res).toEqual({ reminded: 2 });
    const data = createManyNotification.mock.calls[0][0].data;
    expect(data).toHaveLength(2);
    expect(data[0]).toMatchObject({
      userId: 'user-1',
      type: 'warning',
      title: 'Approval overdue: "Launch post"',
      data: { source: 'approval_sla_reminder', approvalId: 'appr-1' },
    });
  });

  test('stamps slaReminderSentAt on the reminded approvals (dedupe)', async () => {
    findManyApproval.mockResolvedValue([
      { id: 'appr-1', title: 'Launch post', submittedBy: 'user-1' },
    ]);
    await sendApprovalSlaReminders({ now: NOW });
    expect(updateManyApproval).toHaveBeenCalledWith({
      where: { id: { in: ['appr-1'] } },
      data: { slaReminderSentAt: NOW },
    });
  });

  test('notifies before stamping (stamp only after the reminder is sent)', async () => {
    findManyApproval.mockResolvedValue([
      { id: 'appr-1', title: 'Launch post', submittedBy: 'user-1' },
    ]);
    const order: string[] = [];
    createManyNotification.mockImplementation(async () => {
      order.push('notify');
      return { count: 1 };
    });
    updateManyApproval.mockImplementation(async () => {
      order.push('stamp');
      return { count: 1 };
    });
    await sendApprovalSlaReminders({ now: NOW });
    expect(order).toEqual(['notify', 'stamp']);
  });
});
