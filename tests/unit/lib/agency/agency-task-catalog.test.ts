import {
  AGENCY_TASK_CATALOG,
  AGENCY_TASK_IDS,
  CEO_TOP_15_IDS,
  getAgencyTask,
  isAgencyTaskId,
  listAgencyTasks,
} from '@/lib/agency/agency-task-catalog';

describe('agency-task-catalog', () => {
  it('defines 32 agency tasks AT-001 through AT-032', () => {
    expect(AGENCY_TASK_CATALOG).toHaveLength(32);
    expect(AGENCY_TASK_IDS[0]).toBe('AT-001');
    expect(AGENCY_TASK_IDS[31]).toBe('AT-032');
  });

  it('CEO top 15 matches catalog flag', () => {
    expect(CEO_TOP_15_IDS).toHaveLength(15);
    for (const id of CEO_TOP_15_IDS) {
      expect(getAgencyTask(id)?.ceoTop15).toBe(true);
    }
  });

  it('validates agency task IDs', () => {
    expect(isAgencyTaskId('AT-001')).toBe(true);
    expect(isAgencyTaskId('AT-032')).toBe(true);
    expect(isAgencyTaskId('AT-033')).toBe(false);
    expect(isAgencyTaskId('AT-1')).toBe(false);
    expect(isAgencyTaskId('')).toBe(false);
  });

  it('listAgencyTasks filters CEO top 15', () => {
    const top = listAgencyTasks({ ceoTop15Only: true });
    expect(top).toHaveLength(15);
    expect(top.every(t => t.ceoTop15)).toBe(true);
  });

  it('maps AT-002 copy to content task type', () => {
    expect(getAgencyTask('AT-002')?.defaultTaskType).toBe('content');
  });
});
