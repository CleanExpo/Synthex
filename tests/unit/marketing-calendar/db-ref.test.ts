/**
 * The portfolio CLI runs only against the Synthex Supabase project. The ref
 * must come from a real Supabase host, never from the username alone.
 */
import { supabaseProjectRef } from '@/lib/marketing-calendar/db-ref';

const REF = 'abcdefghijklmnopqrst';
// Placeholder password; these URLs are parsed, never connected to.
const url = (user: string, host: string) =>
  `postgresql://${user}:placeholder@${host}:5432/postgres`;

describe('supabaseProjectRef', () => {
  it('reads the ref from a direct Supabase host', () => {
    expect(supabaseProjectRef(url('postgres', `db.${REF}.supabase.co`))).toBe(
      REF
    );
  });

  it('reads the ref from a Supavisor pooler user', () => {
    expect(
      supabaseProjectRef(
        url(`postgres.${REF}`, 'aws-0-ap-southeast-2.pooler.supabase.com')
      )
    ).toBe(REF);
  });

  it('refuses the expected username on an unrelated host', () => {
    expect(supabaseProjectRef(url(`postgres.${REF}`, '127.0.0.1'))).toMatch(
      /^unknown/
    );
    expect(
      supabaseProjectRef(
        url(`postgres.${REF}`, 'pooler.supabase.com.evil.test')
      )
    ).toMatch(/^unknown/);
  });

  it('refuses a direct host whose user names another project', () => {
    expect(
      supabaseProjectRef(url('postgres.otherref', `db.${REF}.supabase.co`))
    ).toMatch(/^unknown/);
  });

  it('refuses a pooler URL without a project user, and non-Postgres URLs', () => {
    expect(
      supabaseProjectRef(
        url('postgres', 'aws-0-ap-southeast-2.pooler.supabase.com')
      )
    ).toMatch(/^unknown/);
    expect(
      supabaseProjectRef(`mysql://postgres:x@db.${REF}.supabase.co/postgres`)
    ).toMatch(/^unknown/);
    expect(supabaseProjectRef(undefined)).toBe('unset');
    expect(supabaseProjectRef('not a url')).toBe('unparseable');
  });
});
