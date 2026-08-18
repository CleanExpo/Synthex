/**
 * Unit tests for the social cut renderer — lib/video/social-cut-renderer.ts
 *
 * Pure helpers are tested directly; render/claim/process flows run against
 * mocked prisma and an injected RendererIo, so no ffmpeg, network, or storage
 * is touched. Real filesystem tmp dirs ARE used (the renderer writes the
 * downloaded hero + rendered cut there) — the fakes write tiny stub files.
 */
import * as fs from 'fs';

const mockVideoAsset = {
  findMany: jest.fn(),
  updateMany: jest.fn(),
  update: jest.fn(),
};
jest.mock('@/lib/prisma', () => ({
  prisma: { videoAsset: mockVideoAsset },
  default: { videoAsset: mockVideoAsset },
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
// Storage is only reached through defaultIo — mock it so an accidental
// defaultIo usage in tests fails loudly instead of hitting Supabase.
jest.mock('@/lib/storage/platform-storage', () => ({
  uploadToStorage: jest
    .fn()
    .mockRejectedValue(new Error('no storage in tests')),
}));

import {
  pctBoxToPixels,
  wrapCaptionLines,
  escapeDrawtext,
  buildVideoFilters,
  parseRenderPlan,
  claimSocialCut,
  renderSocialCut,
  processPendingSocialCuts,
  type RendererIo,
  type RenderPlan,
} from '@/lib/video/social-cut-renderer';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const CROP_1_1 = { xPct: 0, yPct: 21.875, wPct: 100, hPct: 56.25 }; // 9:16→1:1
const NO_CROP = { xPct: 0, yPct: 0, wPct: 100, hPct: 100 };

const PLAN: RenderPlan = {
  target: '1:1',
  crop: CROP_1_1,
  trim: { fromSec: 0, toSec: 15, heroDurationKnown: true },
  caption: {
    text: 'The touch test lied — meters decide',
    placement: 'upper',
    band: { xPct: 4, yPct: 8, wPct: 84, hPct: 20 },
  },
};

const METADATA = {
  source: 'deriveSocialCut',
  organizationId: 'org-001',
  derivedFrom: 'hero-va-001',
  derivation: {
    target: PLAN.target,
    crop: PLAN.crop,
    trim: PLAN.trim,
    caption: {
      text: PLAN.caption.text,
      placement: 'upper',
      band: PLAN.caption.band,
    },
  },
};

const PENDING_ASSET = {
  id: 'cut-001',
  founderId: 'user-001',
  url: 'https://storage.synthex.social/video/hero.mp4#t=0,15&xywh=percent:0,21.88,100,56.25',
  metadata: METADATA,
};

function fakeIo(overrides: Partial<RendererIo> = {}): RendererIo {
  return {
    download: jest.fn(async (_url: string, toPath: string) => {
      fs.writeFileSync(toPath, 'fake-hero');
    }),
    probe: jest.fn(async () => ({ width: 1080, height: 1920 })),
    transcode: jest.fn(async ({ outPath }: { outPath: string }) => {
      fs.writeFileSync(outPath, 'fake-cut');
    }),
    upload: jest.fn(async () => ({
      url: 'https://storage.synthex.social/video/cut-001.mp4',
    })),
    ...overrides,
  } as RendererIo;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVideoAsset.update.mockResolvedValue({});
  mockVideoAsset.updateMany.mockResolvedValue({ count: 1 });
});

// ── Pure helpers ─────────────────────────────────────────────────────────────

describe('pctBoxToPixels()', () => {
  it('converts the 9:16→1:1 centre-crop to even pixel dims', () => {
    const px = pctBoxToPixels(CROP_1_1, 1080, 1920);
    expect(px.w).toBe(1080);
    expect(px.h % 2).toBe(0);
    expect(px.h).toBe(1080); // 56.25% of 1920
    expect(px.y).toBe(420); // 21.875% of 1920
  });

  it('clamps the offset so the window never overflows the frame', () => {
    const px = pctBoxToPixels(
      { xPct: 99, yPct: 99, wPct: 50, hPct: 50 },
      100,
      100
    );
    expect(px.x + px.w).toBeLessThanOrEqual(100);
    expect(px.y + px.h).toBeLessThanOrEqual(100);
  });
});

describe('wrapCaptionLines()', () => {
  it('keeps a short caption on one line', () => {
    expect(wrapCaptionLines('Short caption')).toEqual(['Short caption']);
  });

  it('wraps at the 32-char estimate the adapter uses', () => {
    const lines = wrapCaptionLines(
      'Meter reads WET underneath — moisture trapped in underlay and wall cavity'
    );
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(32);
  });

  it('caps at maxLines with an ellipsis rather than overflowing the band', () => {
    const lines = wrapCaptionLines('word '.repeat(60), 32, 3);
    expect(lines).toHaveLength(3);
    expect(lines[2].endsWith('…')).toBe(true);
  });
});

describe('escapeDrawtext()', () => {
  it('escapes the characters that break drawtext parsing', () => {
    expect(escapeDrawtext("it's 50%: a,b\\c")).toBe(
      "it\\'s 50\\%\\: a\\,b\\\\c"
    );
  });
});

describe('buildVideoFilters()', () => {
  it('emits crop first, then one drawtext per wrapped line', () => {
    const filters = buildVideoFilters(PLAN, { width: 1080, height: 1920 });
    expect(filters[0]).toMatch(/^crop=1080:1080:0:420$/);
    const drawtexts = filters.filter(f => f.startsWith('drawtext='));
    expect(drawtexts.length).toBe(wrapCaptionLines(PLAN.caption.text).length);
    for (const d of drawtexts) {
      expect(d).toContain('box=1');
      expect(d).toContain('x=(w-text_w)/2');
    }
  });

  it('omits the crop filter when the plan keeps the full frame', () => {
    const filters = buildVideoFilters(
      { ...PLAN, crop: NO_CROP },
      { width: 1080, height: 1920 }
    );
    expect(filters.some(f => f.startsWith('crop='))).toBe(false);
    expect(filters.some(f => f.startsWith('drawtext='))).toBe(true);
  });
});

describe('parseRenderPlan()', () => {
  it('accepts the adapter metadata shape', () => {
    const parsed = parseRenderPlan(METADATA);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.plan.trim.toSec).toBe(15);
  });

  it('rejects foreign or malformed metadata', () => {
    expect(parseRenderPlan(null).ok).toBe(false);
    expect(parseRenderPlan({ source: 'other' }).ok).toBe(false);
    expect(
      parseRenderPlan({
        source: 'deriveSocialCut',
        derivation: { ...METADATA.derivation, trim: { fromSec: 5, toSec: 5 } },
      }).ok
    ).toBe(false);
  });
});

// ── Claim ────────────────────────────────────────────────────────────────────

describe('claimSocialCut()', () => {
  it('claims a pending row exactly once', async () => {
    mockVideoAsset.updateMany.mockResolvedValue({ count: 1 });
    await expect(claimSocialCut('cut-001')).resolves.toBe(true);
    expect(mockVideoAsset.updateMany).toHaveBeenCalledWith({
      where: { id: 'cut-001', status: 'pending' },
      data: { status: 'processing' },
    });
  });

  it('returns false when another worker already claimed it', async () => {
    mockVideoAsset.updateMany.mockResolvedValue({ count: 0 });
    await expect(claimSocialCut('cut-001')).resolves.toBe(false);
  });
});

// ── Render ───────────────────────────────────────────────────────────────────

describe('renderSocialCut()', () => {
  it('renders the happy path: fragment stripped, real URL lands, row ready', async () => {
    const io = fakeIo();
    const result = await renderSocialCut(PENDING_ASSET, io);

    expect(result.status).toBe('ready');
    expect(result.url).toBe('https://storage.synthex.social/video/cut-001.mp4');
    // Hero fetched WITHOUT the media-fragment plan suffix
    expect((io.download as jest.Mock).mock.calls[0][0]).toBe(
      'https://storage.synthex.social/video/hero.mp4'
    );
    // Row promoted to ready with the rendered URL, plan URL preserved
    const update = mockVideoAsset.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: 'cut-001' });
    expect(update.data.status).toBe('ready');
    expect(update.data.url).toBe(
      'https://storage.synthex.social/video/cut-001.mp4'
    );
    expect(update.data.metadata.planUrl).toBe(PENDING_ASSET.url);
  });

  it('marks the row failed when transcode throws, and never throws itself', async () => {
    const io = fakeIo({
      transcode: jest.fn().mockRejectedValue(new Error('ffmpeg exploded')),
    });
    const result = await renderSocialCut(PENDING_ASSET, io);

    expect(result.status).toBe('failed');
    expect(result.error).toContain('ffmpeg exploded');
    const update = mockVideoAsset.update.mock.calls[0][0];
    expect(update.data.status).toBe('failed');
    expect(update.data.metadata.renderError).toContain('ffmpeg exploded');
  });

  it('fails fast on a foreign row without touching IO', async () => {
    const io = fakeIo();
    const result = await renderSocialCut(
      { ...PENDING_ASSET, metadata: { source: 'something-else' } },
      io
    );
    expect(result.status).toBe('failed');
    expect(io.download).not.toHaveBeenCalled();
    expect(io.transcode).not.toHaveBeenCalled();
  });
});

// ── Process loop ─────────────────────────────────────────────────────────────

describe('processPendingSocialCuts()', () => {
  it('isolates failures: one bad cut does not stop the batch', async () => {
    const second = { ...PENDING_ASSET, id: 'cut-002' };
    mockVideoAsset.findMany.mockResolvedValue([PENDING_ASSET, second]);
    let call = 0;
    const io = fakeIo({
      transcode: jest.fn(async ({ outPath }: { outPath: string }) => {
        call += 1;
        if (call === 1) throw new Error('first one dies');
        fs.writeFileSync(outPath, 'fake-cut');
      }),
    });

    const results = await processPendingSocialCuts({ io });
    expect(results.map(r => r.status)).toEqual(['failed', 'ready']);
  });

  it('skips rows another worker claimed', async () => {
    mockVideoAsset.findMany.mockResolvedValue([PENDING_ASSET]);
    mockVideoAsset.updateMany.mockResolvedValue({ count: 0 });
    const io = fakeIo();

    const results = await processPendingSocialCuts({ io });
    expect(results).toEqual([
      {
        assetId: 'cut-001',
        status: 'skipped',
        error: 'claimed by another worker',
      },
    ]);
    expect(io.download).not.toHaveBeenCalled();
  });

  it('respects the time budget', async () => {
    mockVideoAsset.findMany.mockResolvedValue([PENDING_ASSET]);
    const io = fakeIo();
    const results = await processPendingSocialCuts({ io, timeBudgetMs: -1 });
    expect(results[0].status).toBe('skipped');
    expect(results[0].error).toBe('time budget exhausted');
  });
});
