/**
 * Unit tests for the social cut renderer — lib/video/social-cut-renderer.ts
 *
 * Pure helpers are tested directly; render/claim/process flows run against
 * mocked prisma and an injected RendererIo, so no ffmpeg, network, or storage
 * is touched. Real filesystem tmp dirs ARE used (the renderer writes the
 * downloaded hero + rendered cut there) — the fakes write tiny stub files.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';

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
// Rendered cuts belong in durable object storage (DECISIONS.md FD-7), not the
// serverless filesystem. The real not-provisioned error class is kept.
const mockObjectUpload = jest.fn();
const mockPublicUrl = jest.fn();
jest.mock('@/lib/storage/object-storage', () => ({
  ...jest.requireActual('@/lib/storage/object-storage'),
  upload: (...a: unknown[]) => mockObjectUpload(...a),
  publicUrl: (...a: unknown[]) => mockPublicUrl(...a),
}));
import { uploadToStorage } from '@/lib/storage/platform-storage';
import { ObjectStorageNotProvisionedError } from '@/lib/storage/object-storage';

import {
  pctBoxToPixels,
  wrapCaptionLines,
  escapeDrawtext,
  buildVideoFilters,
  CAPTION_FONT_FILE,
  captionColours,
  escapeFilterPath,
  parseRenderPlan,
  claimSocialCut,
  renderSocialCut,
  processPendingSocialCuts,
  defaultIo,
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

  it('keeps the unbranded caption look when there is no kit', () => {
    const dims = { width: 1080, height: 1920 };
    const first = wrapCaptionLines(PLAN.caption.text)[0];
    // 1:1 crop of 1080x1920 -> 1080 high: font 35px, band top 86px.
    const legacy = `drawtext=fontfile=${escapeFilterPath(CAPTION_FONT_FILE)}:text='${escapeDrawtext(first)}':fontsize=35:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=12:x=(w-text_w)/2:y=86`;
    expect(buildVideoFilters(PLAN, dims)[1]).toBe(legacy);
    expect(buildVideoFilters(PLAN, dims, null)[1]).toBe(legacy);
  });

  it('names the bundled caption font in every drawtext', () => {
    expect(fs.existsSync(CAPTION_FONT_FILE)).toBe(true);
    const drawtexts = buildVideoFilters(PLAN, {
      width: 1080,
      height: 1920,
    }).filter(f => f.startsWith('drawtext='));
    expect(drawtexts.length).toBeGreaterThan(0);
    for (const d of drawtexts) {
      expect(d.startsWith(`drawtext=fontfile=`)).toBe(true);
    }
  });

  it('escapes the font path for both ffmpeg parsing levels', () => {
    // Option level: \ ' : get a backslash. Graph level: \ ' [ ] , ; get one more.
    expect(escapeFilterPath("/a b/it's:x,y\\z[1];")).toBe(
      "/a b/it\\\\\\'s\\\\:x\\,y\\\\\\\\z\\[1\\]\\;"
    );
  });

  it('fills the caption box with a dark brand colour and uses white text', () => {
    const filters = buildVideoFilters(
      PLAN,
      { width: 1080, height: 1920 },
      { primaryColor: '#0f172a', source: 'preset' }
    );
    const drawtexts = filters.filter(f => f.startsWith('drawtext='));
    expect(drawtexts.length).toBeGreaterThan(0);
    for (const d of drawtexts) {
      expect(d).toContain(':boxcolor=0x0f172a@0.85:');
      expect(d).toContain(':fontcolor=white:');
    }
  });

  it('uses black text on a light brand colour', () => {
    const filters = buildVideoFilters(
      PLAN,
      { width: 1080, height: 1920 },
      { primaryColor: '#fde047', source: 'dna' }
    );
    const drawtext = filters.find(f => f.startsWith('drawtext='));
    expect(drawtext).toContain(':boxcolor=0xfde047@0.85:');
    expect(drawtext).toContain(':fontcolor=black:');
  });
});

// The production ffmpeg builds (darwin-arm64 and linux-x64 4.1.0) have FreeType but no
// fontconfig, so drawtext without a font file refuses to start. Run the real binary on
// the real filter chain, from font paths holding every character either ffmpeg parsing
// level treats specially.
describe('buildVideoFilters() on the installed ffmpeg', () => {
  const ffmpegPath: string = jest.requireActual(
    '@ffmpeg-installer/ffmpeg'
  ).path;
  const BRANDED = { primaryColor: '#0f172a', source: 'preset' as const };
  const dirs: string[] = [];

  afterAll(() => {
    for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
  });

  it.each([
    ['unbranded', 'plain', null],
    ['branded', 'space and, comma', BRANDED],
    ['branded', 'co:lon', BRANDED],
    ['branded', "apo'strophe", BRANDED],
    ['branded', 'back\\slash', BRANDED],
    ['branded', 'semi;colon [brackets]', BRANDED],
  ])(
    'renders a %s caption frame from a font dir named %p',
    (_l, dirName, kit) => {
      const fontDir = fs.mkdtempSync(path.join(os.tmpdir(), `${dirName} `));
      dirs.push(fontDir);
      const fontFile = path.join(fontDir, 'caption.woff');
      fs.copyFileSync(CAPTION_FONT_FILE, fontFile);
      const filters = buildVideoFilters(
        PLAN,
        { width: 1080, height: 1920 },
        kit,
        fontFile
      );
      const run = spawnSync(
        ffmpegPath,
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-f',
          'lavfi',
          '-i',
          'color=c=gray:s=1080x1920:d=1',
          '-vf',
          filters.join(','),
          '-frames:v',
          '1',
          '-f',
          'null',
          '-',
        ],
        { encoding: 'utf8', timeout: 30_000 }
      );
      expect(run.stderr).toBe('');
      expect(run.status).toBe(0);
    }
  );
});

describe('captionColours()', () => {
  it.each([
    ['#ffffff', 'black'],
    ['#000000', 'white'],
    ['#ff6b35', 'black'],
    ['#1d4ed8', 'white'],
  ])('picks the higher-contrast text for %s', (primaryColor, expected) => {
    expect(
      captionColours({ primaryColor, source: 'organization' }).fontcolor
    ).toBe(expected);
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

  it('burns the founder org brand colour into the caption', async () => {
    const brandKit = jest.fn(async () => ({
      primaryColor: '#1d4ed8',
      source: 'preset' as const,
    }));
    const io = fakeIo({ brandKit });
    const result = await renderSocialCut(PENDING_ASSET, io);

    expect(result.status).toBe('ready');
    expect(brandKit).toHaveBeenCalledWith('user-001');
    const { filters } = (io.transcode as jest.Mock).mock.calls[0][0];
    expect(filters.find((f: string) => f.startsWith('drawtext='))).toContain(
      ':boxcolor=0x1d4ed8@0.85:'
    );
  });

  it('still renders, unbranded, when the brand kit lookup rejects', async () => {
    const io = fakeIo({
      brandKit: jest.fn().mockRejectedValue(new Error('db down')),
    });
    const result = await renderSocialCut(PENDING_ASSET, io);

    expect(result.status).toBe('ready');
    const { filters } = (io.transcode as jest.Mock).mock.calls[0][0];
    expect(filters).toEqual(
      buildVideoFilters(PLAN, { width: 1080, height: 1920 })
    );
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

describe('defaultIo.upload', () => {
  it('stores the cut in object storage bucket generated-videos, not the local filesystem', async () => {
    mockPublicUrl.mockReturnValue(
      'https://sb.example/storage/v1/object/public/generated-videos/user-001/social-cuts/social-cut-cut-001.mp4'
    );
    mockObjectUpload.mockResolvedValue(undefined);
    const buffer = Buffer.from('cut');

    const result = await defaultIo.upload(
      'user-001',
      'social-cut-cut-001.mp4',
      buffer,
      'video/mp4'
    );

    expect(mockObjectUpload).toHaveBeenCalledWith(
      'generated-videos',
      'user-001/social-cuts/social-cut-cut-001.mp4',
      buffer,
      'video/mp4',
      { upsert: true }
    );
    expect(result.url).toBe(
      'https://sb.example/storage/v1/object/public/generated-videos/user-001/social-cuts/social-cut-cut-001.mp4'
    );
    expect(uploadToStorage).not.toHaveBeenCalled();
  });

  it('fails the cut with a not-provisioned reason when storage credentials are missing', async () => {
    mockPublicUrl.mockImplementation(() => {
      throw new ObjectStorageNotProvisionedError();
    });
    const io = fakeIo({ upload: defaultIo.upload });

    const result = await renderSocialCut(PENDING_ASSET, io);

    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/FEATURE_NOT_PROVISIONED/);
    expect(result.error).toMatch(/not stored/);
    expect(mockObjectUpload).not.toHaveBeenCalled();
    expect(uploadToStorage).not.toHaveBeenCalled();
    const update = mockVideoAsset.update.mock.calls[0][0];
    expect(update.data.status).toBe('failed');
    expect(update.data.metadata.renderError).toMatch(/FEATURE_NOT_PROVISIONED/);
  });

  it('fails the cut when the storage upload itself errors', async () => {
    mockPublicUrl.mockReturnValue('https://sb.example/x.mp4');
    mockObjectUpload.mockRejectedValue(
      new Error('object storage upload failed')
    );
    const io = fakeIo({ upload: defaultIo.upload });

    const result = await renderSocialCut(PENDING_ASSET, io);

    expect(result.status).toBe('failed');
    expect(result.error).toContain('object storage upload failed');
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
