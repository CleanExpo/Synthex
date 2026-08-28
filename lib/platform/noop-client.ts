/**
 * lib/platform/noop-client — FAIL-LOUD STUB (was: silent no-op).
 *
 * History: introduced by SYN-1070 (581bd820, 2026-08-18) as a placeholder while
 * routes migrated Supabase client calls -> Prisma. It returned `{ data: [], error: null }`
 * for every operation, so any route not yet migrated SILENTLY DISCARDED writes and
 * fabricated empty reads while reporting success. That is production data loss.
 *
 * This module now THROWS on every data / auth / storage operation instead of faking
 * success, converting silent corruption into a loud, traceable failure. Construction
 * (`createClient()`) is intentionally side-effect-free so module-scope `const c =
 * createClient()` cannot explode at import time; the throw happens per-request on first
 * real use, returning a 500 for that route only.
 *
 * The fix for a route that throws here is to migrate it to the real Prisma client
 * (lib/prisma) or a real Supabase server client — NOT to re-silence this stub.
 *
 * Guard: tests/unit/platform/noop-client.test.ts asserts every operation throws.
 */

export const NOOP_CLIENT_MARKER = 'NOOP_CLIENT_NOT_MIGRATED' as const;

function unmigrated(op: string): never {
  throw new Error(
    `${NOOP_CLIENT_MARKER}: lib/platform/noop-client.${op}() was invoked. ` +
      `This route still relies on the removed Supabase client and must be migrated ` +
      `to Prisma (lib/prisma). Refusing to fake a successful "${op}" and lose data. ` +
      `See SYN-1070.`
  );
}

// Realtime SUBSCRIPTION is genuinely optional and was already a no-op; the passive
// lifecycle methods stay inert rather than throwing, so SSR/presence paths degrade
// quietly instead of 500-ing. Receiving nothing is a degradation, not data loss.
//
// OUTBOUND is a different case, and the blanket exception used to cover it: `send`
// and `track` accepted a payload, discarded it, and returned 'ok'. That is precisely
// the fabricated-success data loss this module exists to convert into a loud failure
// — the same defect as the original `.insert()` no-op, wearing realtime's clothes
// (found by independent review, P1; the review named `removeChannel`, but the class
// is the outbound pair). They now throw.
//
// THE SPLIT IS LOAD-BEARING, and here is the caller that decides it.
// hooks/use-realtime-stats.ts:322 builds a channel from this stub and uses on(),
// subscribe() and removeChannel() inside a useEffect and its cleanup. It never
// calls send() or track(). So making the outbound pair throw reaches no live
// caller, while making the PASSIVE methods throw would blow up that effect and
// its unmount path — which is exactly the SSR/presence damage the original
// blanket exception was written to avoid.
//
// A later review re-raised removeChannel as an inconsistency. It is not: it is
// teardown, it carries no payload, and it has a live caller that must not throw.
// An earlier version of this comment claimed "no call site in app/, lib/ or
// components/", which was true only because that search never looked in hooks/.
// The narrower claim was right by luck; this one is right by evidence.
//
// Known, pre-existing, and out of scope for this branch: that hook's
// subscribe(status => ...) callback is never invoked by the stub, so isConnected
// stays false and the polling fallback never starts — realtime stats sit stale
// rather than degrading to polling. Fixing it means migrating the hook off this
// stub, which is the SYN-1070 migration, not a change to the stub.
function createChannel() {
  const channel: any = {
    on() {
      return channel;
    },
    async subscribe() {
      return channel;
    },
    async send(..._args: any[]): Promise<never> {
      return unmigrated('channel.send');
    },
    async track(..._args: any[]): Promise<never> {
      return unmigrated('channel.track');
    },
    presenceState() {
      return {};
    },
    unsubscribe() {
      return Promise.resolve('ok');
    },
  };
  return channel;
}

export type AuthChangeEvent = string;
export type Session = {
  user?: {
    id: string;
    email?: string;
  } | null;
  access_token?: string;
  refresh_token?: string;
};
export type RealtimeChannel = ReturnType<typeof createChannel>;
export type RealtimePostgresChangesPayload<T> = {
  eventType?: string;
  schema?: string;
  table?: string;
  new?: T;
  old?: T;
};
export type SupabaseClient = ReturnType<typeof createClient>;

export function createClient<T = any>(..._args: any[]) {
  void (null as unknown as T); // preserve the generic for callers typing createClient<Db>()
  return {
    auth: {
      async signUp(..._args: any[]): Promise<any> {
        return unmigrated('auth.signUp');
      },
      async signInWithPassword(..._args: any[]): Promise<any> {
        return unmigrated('auth.signInWithPassword');
      },
      async signOut(..._args: any[]): Promise<any> {
        return unmigrated('auth.signOut');
      },
      async getSession(..._args: any[]): Promise<any> {
        return unmigrated('auth.getSession');
      },
      async getUser(..._args: any[]): Promise<any> {
        return unmigrated('auth.getUser');
      },
      async resetPasswordForEmail(..._args: any[]): Promise<any> {
        return unmigrated('auth.resetPasswordForEmail');
      },
      async updateUser(..._args: any[]): Promise<any> {
        return unmigrated('auth.updateUser');
      },
      onAuthStateChange(..._args: any[]): any {
        return unmigrated('auth.onAuthStateChange');
      },
      admin: {
        async deleteUser(..._args: any[]): Promise<any> {
          return unmigrated('auth.admin.deleteUser');
        },
      },
    },
    // Return `any`, not `never`. These throw at runtime — that is the fail-loud
    // guarantee — but typing the return as `never` made every downstream
    // `.from('x').select(...)` chain a type error, producing 205 build-breaking
    // errors across the routes still on this stub. The runtime contract is what
    // protects data; over-tightening the type only broke `next build`.
    from(..._args: any[]): any {
      return unmigrated('from');
    },
    channel(..._args: any[]) {
      return createChannel();
    },
    removeChannel(..._args: any[]) {
      return Promise.resolve('ok');
    },
    rpc(..._args: any[]): any {
      return unmigrated('rpc');
    },
    storage: {
      async listBuckets(..._args: any[]): Promise<any> {
        return unmigrated('storage.listBuckets');
      },
      async createBucket(..._args: any[]): Promise<any> {
        return unmigrated('storage.createBucket');
      },
      from(..._args: any[]) {
        return {
          async upload(..._args: any[]): Promise<any> {
            return unmigrated('storage.upload');
          },
          async remove(..._args: any[]): Promise<any> {
            return unmigrated('storage.remove');
          },
          async list(..._args: any[]): Promise<any> {
            return unmigrated('storage.list');
          },
          async download(..._args: any[]): Promise<any> {
            return unmigrated('storage.download');
          },
          async createSignedUrls(..._args: any[]): Promise<any> {
            return unmigrated('storage.createSignedUrls');
          },
          getPublicUrl(..._args: any[]): any {
            return unmigrated('storage.getPublicUrl');
          },
        };
      },
    },
  };
}
