/**
 * Unit tests for the calendar connection gate (SYN-1024 slice 2).
 *
 * The weekly calendar schedules slots from historical signals, not live
 * connection state. This gate must block slots whose platform is not connected
 * so they can't reach the publish path, and must un-block them once the account
 * is connected.
 */
import {
  annotateSlotsConnectivity,
  countBlockedSlots,
} from '@/lib/calendar/connectivityGate';
import type { CalendarSlot } from '@/lib/calendar/types';

function slot(platform: CalendarSlot['platform'], over: Partial<CalendarSlot> = {}): CalendarSlot {
  return {
    id: `slot-${platform}`,
    dayOfWeek: 0,
    scheduledAt: '2026-06-15T10:00:00.000Z',
    platform,
    captions: ['a', 'b', 'c'],
    hashtags: ['#x'],
    contentType: 'educational' as CalendarSlot['contentType'],
    ...over,
  };
}

describe('annotateSlotsConnectivity', () => {
  it('blocks a slot whose platform is not connected', () => {
    const [out] = annotateSlotsConnectivity([slot('youtube')], ['instagram']);
    expect(out.connectionBlocked).toBe(true);
    expect(out.connectionBlockReason).toMatch(/no active youtube connection/i);
  });

  it('leaves a connected slot unblocked (case-insensitive match)', () => {
    const [out] = annotateSlotsConnectivity([slot('instagram')], ['Instagram']);
    expect(out.connectionBlocked).toBeUndefined();
    expect(out.connectionBlockReason).toBeUndefined();
  });

  it('clears a stale block once the account is connected', () => {
    const stale = slot('linkedin', {
      connectionBlocked: true,
      connectionBlockReason: 'old reason',
    });
    const [out] = annotateSlotsConnectivity([stale], ['linkedin']);
    expect(out.connectionBlocked).toBeUndefined();
    expect(out.connectionBlockReason).toBeUndefined();
  });

  it('does not mutate the input slots', () => {
    const input = [slot('tiktok')];
    annotateSlotsConnectivity(input, []);
    expect(input[0].connectionBlocked).toBeUndefined();
  });

  it('blocks every slot when nothing is connected, and counts them', () => {
    const out = annotateSlotsConnectivity(
      [slot('instagram'), slot('facebook'), slot('linkedin')],
      [],
    );
    expect(countBlockedSlots(out)).toBe(3);
  });

  it('mixes blocked and unblocked across a week', () => {
    const out = annotateSlotsConnectivity(
      [slot('instagram'), slot('youtube'), slot('facebook')],
      ['instagram', 'facebook'],
    );
    expect(countBlockedSlots(out)).toBe(1);
    expect(out.find((s) => s.platform === 'youtube')?.connectionBlocked).toBe(true);
  });
});
