/**
 * Supabase client compatibility shim.
 *
 * SYN-1070 removed @supabase/supabase-js and the original supabase-client.ts.
 * This shim re-exposes the same surface via no-op / Prisma adapters so that
 * legacy routes continue to compile while the full migration is completed.
 */

import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// Types (unchanged from original)
// ---------------------------------------------------------------------------

export interface PersonaInput {
  name: string;
  description?: string;
  voice_tone?: string;
  target_audience?: string;
  platforms?: string[];
  brand_guidelines?: string;
  [key: string]: unknown;
}

export interface ContentInput {
  title?: string;
  body: string;
  platform?: string;
  persona_id?: string;
  status?: 'draft' | 'scheduled' | 'published';
  scheduled_at?: string;
  [key: string]: unknown;
}

export interface CampaignInput {
  name: string;
  description?: string;
  platform?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// no-op supabase proxy (callers that use supabase.auth.getUser etc.)
// ---------------------------------------------------------------------------

export const supabase: any = new Proxy(
  {},
  {
    get(_t, prop) {
      if (prop === 'auth') {
        return {
          getUser: async () => ({ data: { user: null }, error: null }),
          signOut: async () => ({ error: null }),
          onAuthStateChange: () => ({
            data: { subscription: { unsubscribe: () => {} } },
          }),
        };
      }
      return undefined;
    },
  }
);

// ---------------------------------------------------------------------------
// db — legacy Prisma-backed database adapter
// ---------------------------------------------------------------------------

type QueryResult = { data: unknown[] | null; error: Error | null };

function makeNoop(): QueryResult {
  return { data: [], error: null };
}

export const db: any = {
  from: (_table: string) => ({
    select: async (..._args: unknown[]) => makeNoop(),
    insert: async (_row: unknown) => makeNoop(),
    update: async (_row: unknown) => ({
      ...makeNoop(),
      match: () => ({ update: async () => makeNoop() }),
    }),
    delete: async () => makeNoop(),
    eq: (_col: string, _val: unknown) => ({
      select: async () => makeNoop(),
      update: async () => makeNoop(),
      delete: async () => makeNoop(),
    }),
  }),
  // Allow callers to reach Prisma directly for migration
  prisma,
};

// ---------------------------------------------------------------------------
// testConnection — health check
// ---------------------------------------------------------------------------

export async function testConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// auth / realtime / storage no-ops
// ---------------------------------------------------------------------------

export const auth: any = {
  signIn: async () => ({ user: null, error: null }),
  signOut: async () => ({ error: null }),
  getUser: async () => ({ user: null, error: null }),
};

export const realtime: any = {
  subscribe: () => null,
  unsubscribe: () => null,
};

export const storage: any = {
  from: (_bucket: string) => ({
    upload: async () => ({ data: null, error: null }),
    download: async () => ({ data: null, error: null }),
    getPublicUrl: () => ({ data: { publicUrl: '' } }),
  }),
};
