/**
 * Guard test for lib/platform/noop-client.
 *
 * The stub previously returned `{ data: [], error: null }` for every operation,
 * silently discarding writes and fabricating empty reads while reporting success
 * (SYN-1070 half-finished migration, production data loss). It now must FAIL LOUD:
 * every data / auth / storage operation throws, tagged NOOP_CLIENT_NOT_MIGRATED.
 *
 * This is a control that fires when the defect (silent success) is present:
 * if anyone re-silences the stub to return success, these expectations fail.
 */

import { describe, it, expect } from '@jest/globals';
import { createClient, NOOP_CLIENT_MARKER } from '@/lib/platform/noop-client';

describe('lib/platform/noop-client — fail-loud stub', () => {
  it('constructs without throwing (import-safe at module scope)', () => {
    expect(() => createClient()).not.toThrow();
  });

  /**
   * ENUMERATE THE SURFACE, DO NOT SAMPLE IT.
   *
   * The first version of this guard listed seven methods and its own header
   * claimed "every data / auth / storage operation throws". Those are different
   * statements, and an independent review caught the gap: a mutant restoring
   * silent success to auth.signUp, auth.signOut, auth.updateUser,
   * auth.admin.deleteUser, storage.createBucket or storage.remove would not have
   * been observed by any assertion here. The P0 this file exists to prevent was
   * mutation-survivable on most of its own surface.
   *
   * The walk derives the surface from the object itself, so a method added to the
   * stub tomorrow is covered without anyone remembering to add a test.
   */
  const CONTAINERS = new Set(['channel', 'storage.from']);

  /** Deliberately inert — passive realtime. See the rationale in the module. */
  const INERT = new Set([
    'channel',
    'removeChannel',
    'channel.on',
    'channel.subscribe',
    'channel.presenceState',
    'channel.unsubscribe',
  ]);

  function walk(node: any, prefix = ''): string[] {
    const found: string[] = [];
    for (const key of Object.keys(node)) {
      const path = prefix ? `${prefix}.${key}` : key;
      const value = node[key];
      if (typeof value === 'function') {
        if (CONTAINERS.has(path)) {
          found.push(...walk(value.call(node, 'x'), prefix ? path : key));
          continue;
        }
        found.push(path);
      } else if (value && typeof value === 'object') {
        found.push(...walk(value, path));
      }
    }
    return found;
  }

  const surface = walk(createClient() as any);
  const mustThrow = surface.filter(p => !INERT.has(p));

  it('discovers the real surface (positive control on the walk itself)', () => {
    // An empty or tiny surface would make every assertion below vacuous, and a
    // walk that silently stopped descending would look exactly like a clean pass.
    expect(surface.length).toBeGreaterThanOrEqual(24);
    // The six the review named as unguarded — proof the walk reaches them now.
    for (const path of [
      'auth.signUp',
      'auth.signOut',
      'auth.updateUser',
      'auth.admin.deleteUser',
      'storage.createBucket',
      'storage.from.remove',
    ]) {
      expect(mustThrow).toContain(path);
    }
    // Nested containers were entered, not skipped.
    expect(mustThrow).toContain('storage.from.upload');
    expect(mustThrow).toContain('channel.send');
  });

  it('lists exactly the intended inert exemptions', () => {
    // A new exemption has to be added here deliberately; it cannot be smuggled in
    // by making a method stop throwing.
    expect([...INERT].sort()).toEqual(
      [
        'channel',
        'channel.on',
        'channel.presenceState',
        'channel.subscribe',
        'channel.unsubscribe',
        'removeChannel',
      ].sort()
    );
  });

  it.each(walk(createClient() as any).filter(p => !INERT.has(p)))(
    'throws instead of faking success: %s',
    async path => {
      const client: any = createClient();
      // Re-resolve the callable from a fresh client, entering containers as needed.
      const parts = path.split('.');
      let node: any = client;
      for (let i = 0; i < parts.length - 1; i++) {
        const step = node[parts[i]];
        node = typeof step === 'function' ? step.call(node, 'x') : step;
      }
      const fn = node[parts[parts.length - 1]];
      await expect(
        Promise.resolve().then(() => fn.call(node, 'x'))
      ).rejects.toThrow(NOOP_CLIENT_MARKER);
    }
  );

  it('keeps passive subscription inert rather than 500-ing an SSR path', async () => {
    // Receiving nothing is a degradation; it is not data loss. Pinned so a later
    // "make everything throw" sweep cannot break server rendering by accident —
    // hooks/use-realtime-stats.ts uses exactly these in a useEffect and cleanup.
    const c: any = createClient();
    const ch = c.channel('room');
    expect(() => ch.on('postgres_changes', {}, () => {})).not.toThrow();
    await expect(ch.subscribe()).resolves.toBeDefined();
    expect(ch.presenceState()).toEqual({});
    await expect(ch.unsubscribe()).resolves.toBe('ok');
    await expect(c.removeChannel(ch)).resolves.toBe('ok');
  });
});
