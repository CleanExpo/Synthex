/**
 * Motion Studio — durable job state machine.
 *
 * Pure and replay-safe so it can run on whichever durable substrate is
 * approved (Vercel Workflow or Inngest; REE spec Phase 4 decision). Each event
 * carries an id; a replayed event is a no-op, which is what makes retries safe.
 */
export type MotionJobState =
  | 'BRIEFED'
  | 'PLANNED'
  | 'BLOCKED_FACTS'
  | 'RENDERED'
  | 'CRITIQUED'
  | 'NEEDS_FIX'
  | 'ESCALATED'
  | 'APPROVED'
  | 'EXPORTED';

export type MotionJobEvent =
  | { id: string; type: 'plan'; factsOk: boolean }
  | { id: string; type: 'render'; renderId: string }
  | { id: string; type: 'critique'; defects: string[] }
  | { id: string; type: 'approve'; approverId: string }
  | { id: string; type: 'export'; url: string };

export interface MotionJob {
  id: string;
  state: MotionJobState;
  fixAttempts: number;
  seenEvents: string[];
  renderId?: string;
  approverId?: string;
  exportUrl?: string;
  lastDefects: string[];
}

/** After this many fix rounds a human takes over. */
export const MAX_FIX_ATTEMPTS = 3;

export function newMotionJob(id: string): MotionJob {
  return {
    id,
    state: 'BRIEFED',
    fixAttempts: 0,
    seenEvents: [],
    lastDefects: [],
  };
}

export class IllegalMotionTransition extends Error {
  constructor(state: MotionJobState, event: MotionJobEvent['type']) {
    super(`Cannot ${event} a motion job in state ${state}`);
    this.name = 'IllegalMotionTransition';
  }
}

export function applyMotionEvent(
  job: MotionJob,
  event: MotionJobEvent
): MotionJob {
  if (job.seenEvents.includes(event.id)) return job;
  const next: MotionJob = { ...job, seenEvents: [...job.seenEvents, event.id] };
  const illegal = () => new IllegalMotionTransition(job.state, event.type);

  switch (event.type) {
    case 'plan':
      if (!['BRIEFED', 'BLOCKED_FACTS'].includes(job.state)) throw illegal();
      return { ...next, state: event.factsOk ? 'PLANNED' : 'BLOCKED_FACTS' };
    case 'render':
      if (!['PLANNED', 'NEEDS_FIX'].includes(job.state)) throw illegal();
      return { ...next, state: 'RENDERED', renderId: event.renderId };
    case 'critique':
      if (job.state !== 'RENDERED') throw illegal();
      if (event.defects.length === 0)
        return { ...next, state: 'CRITIQUED', lastDefects: [] };
      if (job.fixAttempts + 1 > MAX_FIX_ATTEMPTS) {
        return { ...next, state: 'ESCALATED', lastDefects: event.defects };
      }
      return {
        ...next,
        state: 'NEEDS_FIX',
        fixAttempts: job.fixAttempts + 1,
        lastDefects: event.defects,
      };
    case 'approve':
      if (job.state !== 'CRITIQUED') throw illegal();
      return { ...next, state: 'APPROVED', approverId: event.approverId };
    case 'export':
      if (job.state !== 'APPROVED') throw illegal();
      return { ...next, state: 'EXPORTED', exportUrl: event.url };
  }
}
