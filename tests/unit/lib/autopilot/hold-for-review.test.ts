import {
  autopilotPostStatus,
  holdAutopilotForReview,
  HOLD_FOR_REVIEW,
} from '@/lib/autopilot/hold-for-review';

describe('holdAutopilotForReview', () => {
  it('never turns a schedule decision into a send', () => {
    expect(holdAutopilotForReview('schedule')).toBe('draft');
    expect(holdAutopilotForReview('draft')).toBe('draft');
    expect(holdAutopilotForReview('reject')).toBe('reject');
  });
});

describe('autopilotPostStatus', () => {
  // The Phase 7 invariant used to be carried only by a comment in the route.
  // SYN-1211: a comment cannot fail, so it did not notice when the derivation
  // was rewritten. These assertions are what carries it now.
  //
  // 'schedule' is the load-bearing case. It is the ONLY decision the quality
  // gate can return that would otherwise yield 'scheduled', so a test that fed
  // 'draft' would pass with the hold switched off and prove nothing.
  it('holds a schedule decision as a draft, never scheduled', () => {
    expect(autopilotPostStatus('schedule')).toBe('draft');
    expect(autopilotPostStatus('schedule')).not.toBe('scheduled');
  });

  it('never yields scheduled for any decision the gate can return', () => {
    const decisions: Array<'schedule' | 'draft' | 'reject'> = [
      'schedule',
      'draft',
      'reject',
    ];
    for (const decision of decisions) {
      expect(autopilotPostStatus(decision)).toBe('draft');
    }
  });

  it('keeps the hold switch on, so autopilot cannot auto-send', () => {
    // Guards the switch itself. Flipping HOLD_FOR_REVIEW to false is a
    // publishing-behaviour change and must be a deliberate, reviewed decision -
    // never a way to silence a type error.
    expect(HOLD_FOR_REVIEW).toBe(true);
  });
});
