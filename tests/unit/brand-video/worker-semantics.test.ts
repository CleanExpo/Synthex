/**
 * Brand Video planning and claim semantics — SYN-1113.
 *
 * The worker shipped with zero coverage, and not by oversight: it is an ESM
 * entrypoint that derives `__filename` from `import.meta.url` and calls `main()`
 * at module scope, so importing it ran the worker and exited the process. That is
 * why these functions now live in `lib/brand-video/planner.ts` — extracting them
 * is what makes any assertion about them possible.
 *
 * Provider-free and deterministic: no ElevenLabs, no image provider, no ffmpeg,
 * no Supabase. The client is a hand-written fake that records the exact query
 * chain, because what matters for claim semantics is which filters are sent.
 */
import { toBeats, claimJob } from '@/lib/brand-video/planner';

describe('toBeats — one visual beat per sentence', () => {
  it('splits on sentence terminators and keeps the terminator', () => {
    expect(toBeats('First beat. Second beat! Third beat?')).toEqual([
      'First beat.',
      'Second beat!',
      'Third beat?',
    ]);
  });

  it('treats a topic with no terminator as a single beat', () => {
    expect(toBeats('One continuous thought with no full stop')).toEqual([
      'One continuous thought with no full stop',
    ]);
  });

  it('drops empty fragments rather than rendering a blank image', () => {
    // Trailing whitespace and doubled terminators previously risked an empty
    // beat, which would have produced a prompt of just the style tokens.
    expect(toBeats('Alpha.   Beta.  ')).toEqual(['Alpha.', 'Beta.']);
  });

  it('returns no beats for an empty or whitespace-only topic', () => {
    // processJob relies on this to fail the job as 'Empty topic' before spending.
    expect(toBeats('')).toEqual([]);
    expect(toBeats('    ')).toEqual([]);
  });

  it('returns no beats for a punctuation-only topic', () => {
    // '...!?' has no whitespace to split on, so a truthiness filter kept it as a
    // single beat and the worker paid for voiceover and an image for a topic
    // with no words. '. . .' was worse — it split into three.
    expect(toBeats('...!?')).toEqual([]);
    expect(toBeats('. . .')).toEqual([]);
    expect(toBeats('?!')).toEqual([]);
    expect(toBeats(' -- ... -- ')).toEqual([]);
  });

  it('keeps a beat that pairs punctuation with real content', () => {
    expect(toBeats('Water damage? Act fast.')).toEqual([
      'Water damage?',
      'Act fast.',
    ]);
    expect(toBeats('24/7.')).toEqual(['24/7.']);
  });

  it('is deterministic — the same topic always yields the same beats', () => {
    const topic =
      'We restore homes. We document everything. Insurers trust it.';

    expect(toBeats(topic)).toEqual(toBeats(topic));
    expect(toBeats(topic)).toHaveLength(3);
  });
});

// ── Supabase fake ────────────────────────────────────────────────────────────

interface UpdateCall {
  patch: Record<string, unknown>;
  filters: Array<[string, unknown]>;
}

/**
 * Records the query chain rather than simulating Postgres. What matters for
 * claim semantics is which filters the worker sends, so the fake asserts on
 * those instead of on a pretend database.
 */
function fakeSupabase(options: {
  candidates: unknown[];
  claimed: unknown | null;
  /** Simulates the queue read failing. */
  selectError?: { message: string };
  /** Simulates the guarded update failing for a reason other than zero rows. */
  claimError?: { message: string };
}) {
  const updates: UpdateCall[] = [];

  const from = () => {
    const selectChain = {
      eq: () => selectChain,
      order: () => selectChain,
      limit: () =>
        Promise.resolve({
          data: options.selectError ? null : options.candidates,
          error: options.selectError ?? null,
        }),
    };

    return {
      select: () => selectChain,
      update: (patch: Record<string, unknown>) => {
        const call: UpdateCall = { patch, filters: [] };
        updates.push(call);

        const updateChain = {
          eq: (column: string, value: unknown) => {
            call.filters.push([column, value]);
            return updateChain;
          },
          select: () => updateChain,
          // maybeSingle, matching the client: a zero-row race is data null with
          // no error, so only a genuine failure carries one.
          maybeSingle: () =>
            Promise.resolve({
              data: options.claimError ? null : options.claimed,
              error: options.claimError ?? null,
            }),
        };

        return updateChain;
      },
    };
  };

  return { client: { from } as never, updates };
}

const QUEUED_JOB = {
  id: 'job-1',
  brand: 'RestoreAssist',
  style: 'flat-line',
  topic: 'A beat.',
  count: 1,
  status: 'queued',
  organization_id: 'org-1',
  created_by: 'user-1',
};

describe('claimJob — claim semantics', () => {
  it('returns null when nothing is queued', async () => {
    const { client, updates } = fakeSupabase({ candidates: [], claimed: null });

    await expect(claimJob(client)).resolves.toBeNull();
    // Nothing queued must not issue a write at all.
    expect(updates).toEqual([]);
  });

  it('claims the candidate by flipping queued to rendering', async () => {
    const { client, updates } = fakeSupabase({
      candidates: [QUEUED_JOB],
      claimed: { ...QUEUED_JOB, status: 'rendering' },
    });

    const job = await claimJob(client);

    expect(job).toMatchObject({ id: 'job-1', status: 'rendering' });
    expect(updates).toHaveLength(1);
    expect(updates[0].patch).toMatchObject({ status: 'rendering' });
  });

  it('guards the write on status=queued so two workers cannot both claim it', async () => {
    // The lost-update guard is the only thing preventing a double render, since
    // the read and the write are separate statements.
    const { client, updates } = fakeSupabase({
      candidates: [QUEUED_JOB],
      claimed: { ...QUEUED_JOB, status: 'rendering' },
    });

    await claimJob(client);

    expect(updates[0].filters).toEqual([
      ['id', 'job-1'],
      ['status', 'queued'],
    ]);
  });

  it('yields nothing to the worker that loses the race', async () => {
    // Loser: it read the candidate, but the guarded update matched no row.
    const { client } = fakeSupabase({
      candidates: [QUEUED_JOB],
      claimed: null,
    });

    await expect(claimJob(client)).resolves.toBeNull();
  });

  it('throws when the queue read fails instead of reporting an empty queue', async () => {
    // Both queries used to discard `error`, so a database outage looked exactly
    // like "nothing to do" and the worker slept while the queue backed up.
    const { client, updates } = fakeSupabase({
      candidates: [],
      claimed: null,
      selectError: { message: 'connection terminated' },
    });

    await expect(claimJob(client)).rejects.toThrow('connection terminated');
    // A failed read must not attempt a write.
    expect(updates).toEqual([]);
  });

  it('throws when the guarded update fails for a reason other than losing the race', async () => {
    const { client } = fakeSupabase({
      candidates: [QUEUED_JOB],
      claimed: null,
      claimError: { message: 'deadlock detected' },
    });

    await expect(claimJob(client)).rejects.toThrow('deadlock detected');
  });

  it('names the job it could not claim, so the failure is traceable', async () => {
    const { client } = fakeSupabase({
      candidates: [QUEUED_JOB],
      claimed: null,
      claimError: { message: 'deadlock detected' },
    });

    await expect(claimJob(client)).rejects.toThrow('job-1');
  });

  it('stamps updated_at on the claim so a stuck job is detectable', async () => {
    const { client, updates } = fakeSupabase({
      candidates: [QUEUED_JOB],
      claimed: { ...QUEUED_JOB, status: 'rendering' },
    });

    await claimJob(client);

    expect(typeof updates[0].patch.updated_at).toBe('string');
    expect(
      Number.isNaN(Date.parse(updates[0].patch.updated_at as string))
    ).toBe(false);
  });
});
