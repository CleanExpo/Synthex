/**
 * Weekly outcomes digest tests (Flywheel C3) — the pure layers: ISO-week
 * labelling, note rendering, and the wiki commit's create-vs-update handling.
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
  commitWikiOutcomesNote,
  isoWeekLabel,
  renderOutcomesNote,
  type OrgOutcomes,
} from '@/lib/outcomes/weekly-digest';

const OUTCOMES: OrgOutcomes[] = [
  {
    orgSlug: 'carsi',
    postsPublished: 3,
    byPlatform: {
      linkedin: {
        posts: 2,
        likes: 41,
        comments: 6,
        shares: 9,
        impressions: 2100,
      },
      facebook: {
        posts: 1,
        likes: 12,
        comments: 1,
        shares: 2,
        impressions: 640,
      },
    },
  },
];

describe('isoWeekLabel', () => {
  it('labels ISO weeks correctly across year boundaries', () => {
    expect(isoWeekLabel(new Date('2026-07-09T00:00:00Z'))).toBe('2026-W28');
    expect(isoWeekLabel(new Date('2026-01-01T00:00:00Z'))).toBe('2026-W01');
    // 2027-01-01 is a Friday → ISO week 53 of 2026.
    expect(isoWeekLabel(new Date('2027-01-01T00:00:00Z'))).toBe('2026-W53');
  });
});

describe('renderOutcomesNote', () => {
  it('renders dated frontmatter, per-org sections, and per-platform lines', () => {
    const note = renderOutcomesNote(
      OUTCOMES,
      '2026-W28',
      new Date('2026-07-09T07:00:00Z')
    );
    expect(note).toContain('updated: 2026-07-09');
    expect(note).toContain('# Distribution outcomes — 2026-W28');
    expect(note).toContain('## carsi — 3 post(s)');
    expect(note).toContain(
      '- linkedin: 2 post(s), 41 likes, 6 comments, 9 shares, 2100 impressions'
    );
  });

  it('states the empty window plainly', () => {
    const note = renderOutcomesNote(
      [],
      '2026-W28',
      new Date('2026-07-09T07:00:00Z')
    );
    expect(note).toContain('No estate posts were published');
  });
});

describe('commitWikiOutcomesNote', () => {
  function fetchSequence(responses: Array<Partial<Response>>) {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    let i = 0;
    const impl = (async (url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return responses[Math.min(i++, responses.length - 1)] as Response;
    }) as typeof fetch;
    return { impl, calls };
  }

  it('creates the note when absent (404 → PUT without sha)', async () => {
    const { impl, calls } = fetchSequence([
      { ok: false, status: 404 },
      { ok: true, status: 201, json: async () => ({}) },
    ]);
    const result = await commitWikiOutcomesNote({
      repo: 'CleanExpo/brain-1',
      token: 't',
      isoWeek: '2026-W28',
      content: '# note',
      fetchImpl: impl,
    });
    expect(result).toEqual({
      path: 'Wiki/outcomes/outcomes-2026-W28.md',
      updated: false,
    });
    const putBody = JSON.parse(String(calls[1].init?.body));
    expect(putBody.sha).toBeUndefined();
    expect(Buffer.from(putBody.content, 'base64').toString()).toBe('# note');
  });

  it('updates idempotently when the week note exists (sha carried)', async () => {
    const { impl, calls } = fetchSequence([
      { ok: true, status: 200, json: async () => ({ sha: 'abc123' }) },
      { ok: true, status: 200, json: async () => ({}) },
    ]);
    const result = await commitWikiOutcomesNote({
      repo: 'CleanExpo/brain-1',
      token: 't',
      isoWeek: '2026-W28',
      content: '# note v2',
      fetchImpl: impl,
    });
    expect(result.updated).toBe(true);
    expect(JSON.parse(String(calls[1].init?.body)).sha).toBe('abc123');
  });

  it('throws loudly on commit failure', async () => {
    const { impl } = fetchSequence([
      { ok: false, status: 404 },
      { ok: false, status: 403 },
    ]);
    await expect(
      commitWikiOutcomesNote({
        repo: 'CleanExpo/brain-1',
        token: 't',
        isoWeek: '2026-W28',
        content: 'x',
        fetchImpl: impl,
      })
    ).rejects.toThrow('brain-1 commit failed: 403');
    expect(jest.isMockFunction).toBeDefined();
  });
});
