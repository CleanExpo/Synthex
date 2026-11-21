/**
 * @jest-environment node
 */
/**
 * Brand Video final status write — SYN-1145.
 *
 * The worker's old finish() ignored the update result, so a status write that
 * changed nothing (the row was deleted, or the id was wrong) let the worker log
 * "Done" for a job no row recorded. setJobStatus must change exactly one row.
 */
import { setJobStatus } from '@/lib/brand-video/planner';

function fakeClient(result: {
  data: unknown[] | null;
  error: { message: string } | null;
}) {
  const calls: Array<{
    table: string;
    patch: Record<string, unknown>;
    filters: Array<[string, unknown]>;
    selected: string | null;
  }> = [];
  const client = {
    from(table: string) {
      return {
        update(patch: Record<string, unknown>) {
          const call = {
            table,
            patch,
            filters: [] as Array<[string, unknown]>,
            selected: null as string | null,
          };
          calls.push(call);
          const chain = {
            eq(column: string, value: unknown) {
              call.filters.push([column, value]);
              return chain;
            },
            select(columns: string) {
              call.selected = columns;
              return Promise.resolve(result);
            },
          };
          return chain;
        },
      };
    },
  };
  return { client, calls };
}

describe('setJobStatus', () => {
  it('writes the status to the one job and returns when one row changed', async () => {
    const { client, calls } = fakeClient({
      data: [{ id: 'job-1' }],
      error: null,
    });
    await expect(
      setJobStatus(client, 'job-1', { status: 'done', output_url: 'u' })
    ).resolves.toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe('brand_video_jobs');
    expect(calls[0].filters).toEqual([['id', 'job-1']]);
    expect(calls[0].patch).toMatchObject({ status: 'done', output_url: 'u' });
    expect(typeof calls[0].patch.updated_at).toBe('string');
    expect(calls[0].selected).toBe('id');
  });

  it('throws when no row changed, so a lost row is never logged as done', async () => {
    const { client } = fakeClient({ data: [], error: null });
    await expect(
      setJobStatus(client, 'job-gone', { status: 'done' })
    ).rejects.toThrow(/0 rows changed, expected 1/);
  });

  it('throws when the update returns no data at all', async () => {
    const { client } = fakeClient({ data: null, error: null });
    await expect(
      setJobStatus(client, 'job-1', { status: 'failed', error: 'x' })
    ).rejects.toThrow(/0 rows changed/);
  });

  it('throws on a query error', async () => {
    const { client } = fakeClient({
      data: null,
      error: { message: 'permission denied' },
    });
    await expect(
      setJobStatus(client, 'job-1', { status: 'failed' })
    ).rejects.toThrow(/permission denied/);
  });
});
