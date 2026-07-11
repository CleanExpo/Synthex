// tests/unit/marketing-agency/lora-train-cli.test.ts
// parseArgs + formatPlan are pure (no network/fs) and mirror the conventions
// in tests/unit/marketing-agency/ccw-catalogue-ingest-cli.test.ts.
// insertRegistryEntry/writeRegistryAtomic touch the filesystem (registry
// write atomicity + id-collision refusal) — those tests use a real
// fs.mkdtempSync tmpdir, never the repo's actual registry file.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  parseArgs,
  formatPlan,
  insertRegistryEntry,
  writeRegistryAtomic,
  type Plan,
} from '@/scripts/train-carpet-style-lora';
import type { DatasetItem } from '@/scripts/lib/lora-train-core';
import type {
  TrainedLora,
  TrainedLoraRegistry,
} from '@/lib/services/ai/image/trained-loras';

// --- parseArgs ---------------------------------------------------------------

describe('parseArgs', () => {
  it('defaults to plan-print mode: no confirm-spend, 1000 steps, default id', () => {
    const a = parseArgs([]);
    expect(a.confirmSpend).toBe(false);
    expect(a.steps).toBe(1000);
    expect(a.id).toBe('carpet-style-v1');
    expect(a.recover).toBeUndefined();
    expect(a.retire).toBeUndefined();
  });

  it('parses --confirm-spend', () => {
    expect(parseArgs(['--confirm-spend']).confirmSpend).toBe(true);
  });

  it('parses --steps as a number', () => {
    const a = parseArgs(['--confirm-spend', '--steps', '500']);
    expect(a.steps).toBe(500);
    expect(typeof a.steps).toBe('number');
  });

  it('parses --id override', () => {
    expect(parseArgs(['--confirm-spend', '--id', 'carpet-style-v2']).id).toBe(
      'carpet-style-v2'
    );
  });

  it('parses --recover <request_id>', () => {
    expect(parseArgs(['--recover', 'req-abc123']).recover).toBe('req-abc123');
  });

  it('parses --retire <id> --reason "…"', () => {
    const a = parseArgs([
      '--retire',
      'carpet-style-v1',
      '--reason',
      'quality regression',
    ]);
    expect(a.retire).toEqual({
      id: 'carpet-style-v1',
      reason: 'quality regression',
    });
  });

  it('parses --retire/--reason regardless of order', () => {
    const a = parseArgs([
      '--reason',
      'superseded',
      '--retire',
      'carpet-style-v1',
    ]);
    expect(a.retire).toEqual({ id: 'carpet-style-v1', reason: 'superseded' });
  });

  it('throws when --retire is missing --reason', () => {
    expect(() => parseArgs(['--retire', 'carpet-style-v1'])).toThrow(
      '--retire requires --reason'
    );
  });

  it('rejects unknown flags', () => {
    expect(() => parseArgs(['--nope'])).toThrow('unknown flag: --nope');
  });

  it('rejects flags with a missing trailing value', () => {
    expect(() => parseArgs(['--steps'])).toThrow('missing value for --steps');
    expect(() => parseArgs(['--id'])).toThrow('missing value for --id');
    expect(() => parseArgs(['--recover'])).toThrow(
      'missing value for --recover'
    );
    expect(() => parseArgs(['--retire'])).toThrow('missing value for --retire');
    expect(() =>
      parseArgs(['--retire', 'carpet-style-v1', '--reason'])
    ).toThrow('missing value for --reason');
  });
});

// --- formatPlan ----------------------------------------------------------------

describe('formatPlan', () => {
  const items: DatasetItem[] = [
    {
      path: 'carpet-cleaning/wand-01.webp',
      basename: 'wand-01.webp',
      caption:
        'Razorback AAM Pro Axial Air Mover, product photo on white background, ccwcarpet style',
      vendorKey: 'razorback',
      firstParty: false,
    },
    {
      path: 'carpet-cleaning/job-01.webp',
      basename: 'job-01.webp',
      caption: 'On-Site Carpet Extraction, on-site job photo, ccwcarpet style',
      vendorKey: 'unite-group',
      firstParty: true,
    },
    {
      path: 'carpet-cleaning/job-01.webp',
      basename: 'job-01-dup1.webp',
      caption: 'On-Site Carpet Extraction, on-site job photo, ccwcarpet style',
      vendorKey: 'unite-group',
      firstParty: true,
    },
    {
      path: 'carpet-cleaning/job-01.webp',
      basename: 'job-01-dup2.webp',
      caption: 'On-Site Carpet Extraction, on-site job photo, ccwcarpet style',
      vendorKey: 'unite-group',
      firstParty: true,
    },
  ];

  it('renders the (pre-oversample) image count', () => {
    const plan: Plan = { imageCount: 163, items, steps: 1000 };
    expect(formatPlan(plan)).toContain('163 images');
  });

  it('renders zip entry count as items + captions (double the oversampled item count)', () => {
    const plan: Plan = { imageCount: 163, items, steps: 1000 };
    const text = formatPlan(plan);
    // 4 oversampled items -> 4 images + 4 captions = 8 zip entries
    expect(text).toContain('zip entries: 8');
  });

  it('renders exactly 3 caption samples', () => {
    const plan: Plan = { imageCount: 163, items, steps: 1000 };
    const text = formatPlan(plan);
    expect(text).toContain(items[0].caption);
    expect(text).toContain(items[1].caption);
    expect(text).toContain(items[2].caption);
    // 4th item's caption is identical text to the 3rd's, so presence alone
    // doesn't prove truncation — assert the sample count directly instead.
    const sampleLines = text
      .split('\n')
      .filter(line => line.trim().startsWith('- '));
    expect(sampleLines).toHaveLength(3);
  });

  it('renders the exact cost line at 1000 steps: $25.50', () => {
    const plan: Plan = { imageCount: 163, items, steps: 1000 };
    expect(formatPlan(plan)).toContain('$25.50');
  });

  it('renders a different cost at a different step count', () => {
    const plan: Plan = { imageCount: 163, items, steps: 500 };
    expect(formatPlan(plan)).toContain('$12.75');
    expect(formatPlan(plan)).not.toContain('$25.50');
  });

  it('renders the requested step count', () => {
    const plan: Plan = { imageCount: 163, items, steps: 500 };
    expect(formatPlan(plan)).toContain('steps: 500');
  });

  it('handles fewer than 3 items without throwing', () => {
    const plan: Plan = { imageCount: 1, items: [items[0]], steps: 1000 };
    const text = formatPlan(plan);
    expect(text).toContain(items[0].caption);
    expect(text).toContain('zip entries: 2');
  });
});

// --- insertRegistryEntry ------------------------------------------------------
// REFUSE if id exists — never overwrite (§5.6).

function makeLora(overrides: Partial<TrainedLora> = {}): TrainedLora {
  return {
    id: 'carpet-style-v1',
    kind: 'style',
    industry: 'carpet-cleaning',
    triggerToken: 'ccwcarpet',
    loraUrl: 'https://fal.example.com/loras/carpet-style-v1.safetensors',
    configUrl: 'https://fal.example.com/loras/carpet-style-v1.json',
    trainedAt: '2026-07-11',
    steps: 1000,
    learningRate: 0.00005,
    costUsd: 25.5,
    imageCount: 163,
    falRequestId: 'req-abc123',
    status: 'active',
    sourceImages: [],
    ...overrides,
  };
}

function emptyRegistry(): TrainedLoraRegistry {
  return { version: 1, loras: [] };
}

describe('insertRegistryEntry', () => {
  it('throws when the id already exists — never overwrite', () => {
    const existing = makeLora({ id: 'carpet-style-v1' });
    const reg: TrainedLoraRegistry = { version: 1, loras: [existing] };
    const duplicate = makeLora({
      id: 'carpet-style-v1',
      falRequestId: 'req-different',
    });

    expect(() => insertRegistryEntry(reg, duplicate)).toThrow(
      /already has an entry with id "carpet-style-v1"/
    );
  });

  it('does not mutate the input registry when refusing a collision', () => {
    const existing = makeLora({ id: 'carpet-style-v1' });
    const reg: TrainedLoraRegistry = { version: 1, loras: [existing] };
    const duplicate = makeLora({ id: 'carpet-style-v1' });

    expect(() => insertRegistryEntry(reg, duplicate)).toThrow();
    expect(reg.loras).toHaveLength(1);
    expect(reg.loras[0]).toBe(existing);
  });

  it('appends a new entry, preserving existing entries and their order', () => {
    const first = makeLora({ id: 'lora-a' });
    const second = makeLora({ id: 'lora-b' });
    const reg: TrainedLoraRegistry = { version: 1, loras: [first, second] };
    const next = makeLora({ id: 'lora-c' });

    const result = insertRegistryEntry(reg, next);

    expect(result.loras).toHaveLength(3);
    expect(result.loras.map(l => l.id)).toEqual(['lora-a', 'lora-b', 'lora-c']);
    expect(result.loras[0]).toBe(first);
    expect(result.loras[1]).toBe(second);
    expect(result.loras[2]).toBe(next);
  });

  it('appends into an empty registry', () => {
    const entry = makeLora({ id: 'carpet-style-v1' });
    const result = insertRegistryEntry(emptyRegistry(), entry);
    expect(result.loras).toEqual([entry]);
  });
});

// --- writeRegistryAtomic -------------------------------------------------------
// Real fs.mkdtempSync tmpdir — no repo files touched. Asserts the write
// round-trips identically and the rename leaves no stray .tmp file behind.

describe('writeRegistryAtomic', () => {
  let tmpDir: string;
  let registryPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lora-registry-test-'));
    registryPath = path.join(tmpDir, 'trained-loras.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes a registry that parses back identical', () => {
    const reg: TrainedLoraRegistry = {
      version: 1,
      loras: [makeLora({ id: 'carpet-style-v1' })],
    };

    writeRegistryAtomic(reg, registryPath);

    const written = JSON.parse(
      fs.readFileSync(registryPath, 'utf8')
    ) as TrainedLoraRegistry;
    expect(written).toEqual(reg);
  });

  it('leaves no .tmp file behind — the rename completed', () => {
    const reg: TrainedLoraRegistry = {
      version: 1,
      loras: [makeLora({ id: 'carpet-style-v1' })],
    };

    writeRegistryAtomic(reg, registryPath);

    expect(fs.existsSync(`${registryPath}.tmp`)).toBe(false);
    expect(fs.existsSync(registryPath)).toBe(true);
    expect(fs.readdirSync(tmpDir).sort()).toEqual(['trained-loras.json']);
  });
});
