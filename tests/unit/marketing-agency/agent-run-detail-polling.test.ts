/**
 * Unit test for the AgentRunDetail polling decision (SYN-1031).
 *
 * The outcome-first flow links to the run page while the run is still
 * `queued`/`running`. `isRunPreparing` drives whether the page keeps polling
 * until the worker reaches a terminal state.
 */
import { isRunPreparing } from '@/components/marketing-agency/agent/AgentRunDetail';

describe('isRunPreparing', () => {
  it('keeps polling while the run is queued or running', () => {
    expect(isRunPreparing('queued')).toBe(true);
    expect(isRunPreparing('running')).toBe(true);
  });

  it('stops polling once the run reaches a terminal state', () => {
    expect(isRunPreparing('completed')).toBe(false);
    expect(isRunPreparing('failed')).toBe(false);
    expect(isRunPreparing('cancelled')).toBe(false);
  });

  it('treats an unknown/undefined status as not preparing', () => {
    expect(isRunPreparing(undefined)).toBe(false);
    expect(isRunPreparing('')).toBe(false);
  });
});
