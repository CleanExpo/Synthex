import { holdAutopilotForReview } from '@/lib/autopilot/hold-for-review';

describe('holdAutopilotForReview', () => {
  it('never turns a schedule decision into a send', () => {
    expect(holdAutopilotForReview('schedule')).toBe('draft');
    expect(holdAutopilotForReview('draft')).toBe('draft');
    expect(holdAutopilotForReview('reject')).toBe('reject');
  });
});
