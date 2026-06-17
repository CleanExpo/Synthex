/**
 * Unit tests for workflowContentToCalendarSlot (SYN-1040 slice 1) — the pure
 * mapper bridging approved workflow content to a ContentCalendar slot.
 */
import {
  workflowContentToCalendarSlot,
  extractCaption,
  extractHashtags,
} from '@/lib/workflow/publish-mapping';

describe('extractCaption', () => {
  it('handles a raw string', () => {
    expect(extractCaption('hello')).toBe('hello');
  });
  it('handles { content } and { caption } and { captions: [...] }', () => {
    expect(extractCaption({ content: 'a' })).toBe('a');
    expect(extractCaption({ caption: 'b' })).toBe('b');
    expect(extractCaption({ captions: ['c', 'd'] })).toBe('c');
  });
  it('returns empty for unusable shapes', () => {
    expect(extractCaption(null)).toBe('');
    expect(extractCaption({ foo: 1 })).toBe('');
  });
});

describe('extractHashtags', () => {
  it('pulls and de-duplicates hashtags', () => {
    expect(extractHashtags('water #restoration and #IICRC #restoration')).toEqual([
      '#restoration',
      '#IICRC',
    ]);
  });
  it('returns [] when there are none', () => {
    expect(extractHashtags('no tags here')).toEqual([]);
  });
});

describe('workflowContentToCalendarSlot', () => {
  // 2026-06-15 is a Monday → dayOfWeek 0 under the 0=Monday convention.
  const monday = new Date('2026-06-15T10:00:00.000Z');

  it('maps approved content into a calendar slot', () => {
    const slot = workflowContentToCalendarSlot({
      id: 'slot-1',
      content: { content: 'Field tech captures it once. #restoration #IICRC' },
      platform: 'LinkedIn',
      scheduledAt: monday,
    });
    expect(slot.id).toBe('slot-1');
    expect(slot.platform).toBe('linkedin');
    expect(slot.dayOfWeek).toBe(0); // Monday
    expect(slot.scheduledAt).toBe(monday.toISOString());
    expect(slot.captions).toEqual(['Field tech captures it once. #restoration #IICRC']);
    expect(slot.hashtags).toEqual(['#restoration', '#IICRC']);
    expect(slot.contentType).toBe('educational');
  });

  it('converts JS Sunday to the 0=Monday convention (Sunday → 6)', () => {
    const sunday = new Date('2026-06-21T10:00:00.000Z'); // Sunday
    const slot = workflowContentToCalendarSlot({
      id: 's',
      content: 'x',
      platform: 'instagram',
      scheduledAt: sunday,
    });
    expect(slot.dayOfWeek).toBe(6);
  });

  it('honours an explicit contentType', () => {
    const slot = workflowContentToCalendarSlot({
      id: 's',
      content: 'x',
      platform: 'facebook',
      scheduledAt: monday,
      contentType: 'promotional',
    });
    expect(slot.contentType).toBe('promotional');
  });

  it('throws on an unsupported platform rather than mis-routing a publish', () => {
    expect(() =>
      workflowContentToCalendarSlot({
        id: 's',
        content: 'x',
        platform: 'myspace',
        scheduledAt: monday,
      }),
    ).toThrow(/unsupported platform "myspace"/);
  });

  it('yields empty captions when there is no usable content', () => {
    const slot = workflowContentToCalendarSlot({
      id: 's',
      content: null,
      platform: 'twitter',
      scheduledAt: monday,
    });
    expect(slot.captions).toEqual([]);
    expect(slot.hashtags).toEqual([]);
  });
});
