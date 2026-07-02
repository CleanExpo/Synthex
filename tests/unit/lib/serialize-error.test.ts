/**
 * Tests for serializeError (SYN-999) — the fix that makes Error message+stack survive
 * logger.error's JSON.stringify (they're non-enumerable on Error, so `{ error }` logged as {}).
 */

import { serializeError } from '@/lib/observability/serialize-error';

describe('serializeError', () => {
  it('extracts name, message and stack from an Error', () => {
    const e = new TypeError('boom');
    const s = serializeError(e);
    expect(s.name).toBe('TypeError');
    expect(s.message).toBe('boom');
    expect(typeof s.stack).toBe('string');
  });

  it('survives JSON.stringify with the message intact (the actual bug)', () => {
    // The pre-fix anti-pattern lost everything:
    expect(JSON.stringify({ error: new Error('boom') })).toBe('{"error":{}}');
    // serializeError keeps the cause visible in the log line:
    expect(JSON.stringify(serializeError(new Error('boom')))).toContain('boom');
  });

  it('handles non-Error throws (string / object)', () => {
    expect(serializeError('plain string')).toMatchObject({
      name: 'NonError',
      message: 'plain string',
    });
    expect(serializeError({ code: 42 }).message).toBe('{"code":42}');
  });

  it('truncates very long stacks', () => {
    const e = new Error('x');
    e.stack = 'S'.repeat(5000);
    expect(serializeError(e, 100).stack).toHaveLength(100);
  });
});
