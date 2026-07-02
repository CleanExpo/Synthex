/**
 * DOM render test for AICalendarSlotCard connection-blocker UI (SYN-1024).
 *
 * Stand-in for the manual browser smoke (the worktree has no DB/secrets to run
 * an authenticated calendar): a connection-blocked slot must show the blocker
 * reason, suppress the Approve action and the "will publish" reassurance, and
 * prompt the operator to connect the account instead.
 */
import { render, screen } from '@testing-library/react';
import {
  AICalendarSlotCard,
  type SlotWithMeta,
} from '@/components/calendar/AICalendarSlotCard';

function slot(over: Partial<SlotWithMeta> = {}): SlotWithMeta {
  return {
    id: 'slot-1',
    dayOfWeek: 0,
    scheduledAt: '2026-06-15T10:00:00.000Z',
    platform: 'youtube',
    captions: ['Caption A', 'Caption B', 'Caption C'],
    hashtags: ['#x'],
    contentType: 'educational' as SlotWithMeta['contentType'],
    ...over,
  };
}

const noop = async () => {};
const baseProps = {
  calendarId: 'cal-1',
  onApprove: noop,
  onReject: noop,
  onCaptionSelect: noop,
};

describe('AICalendarSlotCard connection blocker', () => {
  it('shows the blocker reason and suppresses Approve in shadow mode', () => {
    render(
      <AICalendarSlotCard
        slot={slot({
          connectionBlocked: true,
          connectionBlockReason: 'No active youtube connection — connect the account.',
        })}
        shadowMode
        {...baseProps}
      />,
    );
    expect(screen.getByText(/no active youtube connection/i)).toBeInTheDocument();
    expect(screen.queryByText('Approve')).not.toBeInTheDocument();
    expect(screen.getByText(/connect youtube to publish/i)).toBeInTheDocument();
  });

  it('suppresses the "will publish automatically" reassurance in live mode when blocked', () => {
    render(
      <AICalendarSlotCard
        slot={slot({ connectionBlocked: true })}
        shadowMode={false}
        {...baseProps}
      />,
    );
    expect(
      screen.queryByText(/will publish automatically/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/connect youtube to publish/i)).toBeInTheDocument();
  });

  it('renders normally (Approve shown, no blocker) for a connected slot', () => {
    render(
      <AICalendarSlotCard slot={slot()} shadowMode {...baseProps} />,
    );
    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.queryByText(/connect youtube to publish/i)).not.toBeInTheDocument();
  });

  it('keeps the live-mode reassurance for a connected, pending slot', () => {
    render(
      <AICalendarSlotCard slot={slot()} shadowMode={false} {...baseProps} />,
    );
    expect(screen.getByText(/will publish automatically/i)).toBeInTheDocument();
  });
});
