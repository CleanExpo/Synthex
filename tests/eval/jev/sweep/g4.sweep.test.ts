/**
 * JEV sweep G4 — publish safety at volume (gate vectors).
 *
 * SEAM: lib/publish/safetyChecks.ts runSafetyChecks, the gate every
 * publish-queue item passes before dispatch (J8 drives the queue engine
 * around it on 140 fixed scenarios; this file does not repeat them). Each
 * case is a seeded random world: a vector of gate states (subscription,
 * calendar mode, kill switch, slot approval or social-cut provenance,
 * campaign-authority manifest, platform connection, token expiry and shape,
 * digest count) seeded into the in-memory Prisma fake (lib/fake-db.ts).
 * The oracle is written from the gate list, not from the code: the item may
 * publish only when every gate clears.
 * Catches: a gate that lets a failing world through, a gate that refuses a
 * fully cleared world. Misses: the queue's claim/retry engine (J8), platform
 * adapters (stubbed nowhere here: the gate makes no platform call).
 *
 * Criteria:
 *  G4.C1 any gate fails -> runSafetyChecks refuses (pass:false).
 *  G4.C2 every gate clears -> runSafetyChecks allows (the oracle is sound).
 * G4.C3 (read failures) lives in g4-reads.sweep.test.ts.
 */
import { Sink, SWEEP, disarmed, pick, quietConsole, rng } from './lib/sink';
import { db, resetDb, table } from './lib/fake-db';

jest.mock('@/lib/prisma', () => require('./lib/fake-db').prismaModule());
jest.mock('@/lib/logger', () => ({
  logger: { info() {}, warn() {}, error() {}, debug() {} },
}));

type Row = Record<string, unknown>;
type Safety = typeof import('@/lib/publish/safetyChecks').runSafetyChecks;

const PLATFORMS = [
  'facebook',
  'instagram',
  'linkedin',
  'threads',
  'tiktok',
  'twitter',
  'youtube',
] as const;
const ORG = 'org-A';
const NOW = Date.now();

/** One gate dimension: a value, and whether it clears its gate. */
interface Vector {
  platform: (typeof PLATFORMS)[number];
  payload: 'slot' | 'social-cut';
  users: number;
  subscription: string | null; // status, or null for no row
  subOtherOrg: boolean;
  orgRow: boolean;
  calendarMode: string | null;
  paused: boolean | null;
  slotStatus: string | null; // null = slot missing
  slotOtherOrg: boolean;
  manifest: 'approved' | 'none' | 'other-platform';
  cut: 'derived' | 'manual-upload' | 'other-org' | 'no-url' | 'missing';
  connection:
    | 'active'
    | 'none'
    | 'inactive'
    | 'deleted'
    | 'other-platform'
    | 'other-org';
  expiry: 'none' | 'future' | 'past';
  refreshToken: boolean;
  token: 'plain' | 'empty' | 'placeholder' | 'bad-ciphertext';
  digests: number;
}

const GOOD = {
  subscription: ['active', 'trialing'],
  calendarMode: ['live'],
  paused: [false, null],
  slotStatus: ['approved'],
  manifest: ['approved'],
  cut: ['derived'],
  connection: ['active'],
  expiry: ['none', 'future'],
  token: ['plain'],
} as const;
const BAD = {
  subscription: ['canceled', 'past_due', 'incomplete', 'ACTIVE', null],
  calendarMode: ['shadow', 'draft', null, 'LIVE', ' live', 'paused'],
  paused: [true],
  slotStatus: [
    'draft',
    'rejected',
    'pending_approval',
    'APPROVED',
    'scheduled',
    null,
  ],
  manifest: ['none', 'other-platform'],
  cut: ['manual-upload', 'other-org', 'no-url', 'missing'],
  connection: ['none', 'inactive', 'deleted', 'other-platform', 'other-org'],
  expiry: ['past'],
  token: ['empty', 'placeholder', 'bad-ciphertext'],
} as const;

/** Every gate this vector fails, by name. Empty = the item may publish. */
function failingGates(v: Vector): string[] {
  const f: string[] = [];
  const has = <T>(xs: readonly T[], x: T) => xs.includes(x);
  if (
    v.users > 0 &&
    (v.subOtherOrg || !has(GOOD.subscription, v.subscription as never))
  )
    f.push('subscription');
  if (!v.orgRow) f.push('org-missing');
  else {
    if (!has(GOOD.calendarMode, v.calendarMode as never))
      f.push('calendar-mode');
    if (!has(GOOD.paused, v.paused as never)) f.push('paused');
  }
  if (v.payload === 'slot') {
    if (v.slotOtherOrg) f.push('slot-other-org');
    else if (!has(GOOD.slotStatus, v.slotStatus as never))
      f.push('slot-status');
    else if (v.manifest !== 'approved') f.push('manifest');
  } else if (v.cut !== 'derived') f.push('social-cut');
  if (v.connection !== 'active') f.push('connection');
  else {
    // Refreshable mid-publish: YouTube, TikTok, and X OAuth 2.0 (an expiring X
    // token is OAuth 2.0; OAuth 1.0a tokens carry no expiry).
    const refreshable =
      v.refreshToken && ['youtube', 'tiktok', 'twitter'].includes(v.platform);
    if (v.expiry === 'past' && !refreshable) f.push('token-expired');
    if (v.token !== 'plain') f.push('token-shape');
  }
  if (v.users === 0 || v.digests < 3) f.push('digests');
  return f;
}

function goodVector(r: () => number): Vector {
  return {
    platform: pick(r, PLATFORMS),
    payload: r() < 0.7 ? 'slot' : 'social-cut',
    users: pick(r, [1, 2, 3]),
    subscription: pick(r, GOOD.subscription),
    subOtherOrg: false,
    orgRow: true,
    calendarMode: 'live',
    paused: pick(r, GOOD.paused),
    slotStatus: 'approved',
    slotOtherOrg: false,
    manifest: 'approved',
    cut: 'derived',
    connection: 'active',
    expiry: pick(r, GOOD.expiry),
    refreshToken: r() < 0.5,
    token: 'plain',
    digests: pick(r, [3, 4, 7]),
  };
}

/** Seeded vector: about one in five fully clear, the rest with 1..3 gates broken. */
function vector(r: () => number): Vector {
  const v = goodVector(r);
  if (r() < 0.2) return v;
  const breaks = 1 + Math.floor(r() * 3);
  for (let i = 0; i < breaks; i++) {
    switch (Math.floor(r() * 12)) {
      case 0:
        v.subscription = pick(r, BAD.subscription);
        break;
      case 1:
        v.subOtherOrg = true;
        break;
      case 2:
        v.calendarMode = pick(r, BAD.calendarMode);
        break;
      case 3:
        v.paused = true;
        break;
      case 4:
        if (v.payload === 'slot') v.slotStatus = pick(r, BAD.slotStatus);
        else v.cut = pick(r, BAD.cut);
        break;
      case 5:
        if (v.payload === 'slot') v.manifest = pick(r, BAD.manifest);
        else v.cut = pick(r, BAD.cut);
        break;
      case 6:
        v.connection = pick(r, BAD.connection);
        break;
      case 7:
        v.expiry = 'past';
        break;
      case 8:
        v.token = pick(r, BAD.token);
        break;
      case 9:
        v.digests = pick(r, [0, 1, 2]);
        break;
      case 10:
        v.users = 0;
        break;
      case 11:
        if (v.payload === 'slot') v.slotOtherOrg = true;
        else v.orgRow = false;
        break;
    }
  }
  return v;
}

let manifestFor: (platforms: string[]) => unknown;

/** Seed the fake store for this vector; returns the SafetyCheckInput. */
function seed(v: Vector, n: number) {
  resetDb();
  const otherOrg = 'org-B';
  for (let i = 0; i < v.users; i++)
    table('user').push({ id: `${ORG}-u${i}`, organizationId: ORG });
  table('user').push({ id: `${otherOrg}-u0`, organizationId: otherOrg });
  if (v.subscription !== null && v.users > 0)
    table('subscription').push({
      id: 'sub-1',
      userId: v.subOtherOrg ? `${otherOrg}-u0` : `${ORG}-u0`,
      status: v.subscription,
    });
  if (v.orgRow)
    table('organization').push({
      id: ORG,
      calendarMode: v.calendarMode,
      autoPublishPaused: v.paused,
    });
  const digestOwner = v.users > 0 ? `${ORG}-u0` : `${otherOrg}-u0`;
  for (let i = 0; i < v.digests; i++)
    table('aIWeeklyDigest').push({ id: `dg-${i}`, userId: digestOwner });

  let slotId = `slot-${n}`;
  const calendarId = 'cal-1';
  if (v.payload === 'slot') {
    const slots =
      v.slotStatus === null
        ? []
        : [
            {
              id: slotId,
              platform: v.platform,
              status: v.slotStatus,
              captions: ['Synthetic caption'],
              ...(v.manifest === 'none'
                ? {}
                : {
                    campaignAuthorityManifest: manifestFor(
                      v.manifest === 'approved'
                        ? [v.platform]
                        : [v.platform === 'youtube' ? 'facebook' : 'youtube']
                    ),
                  }),
            },
          ];
    table('contentCalendar').push({
      id: calendarId,
      organizationId: v.slotOtherOrg ? otherOrg : ORG,
      slots: { weekStart: '2026-10-19', weekEnd: '2026-10-25', slots },
    });
  } else {
    const assetId = `asset-${n}`;
    slotId = `social-cut:${assetId}`;
    if (v.cut !== 'missing')
      table('videoAsset').push({
        id: assetId,
        url: v.cut === 'no-url' ? '' : 'https://cdn.example.test/cut.mp4',
        metadata: {
          source:
            v.cut === 'manual-upload' ? 'manual-upload' : 'deriveSocialCut',
          organizationId: v.cut === 'other-org' ? otherOrg : ORG,
          derivation: { caption: { text: 'Synthetic cut' } },
        },
      });
  }
  if (v.connection !== 'none')
    table('platformConnection').push({
      id: 'conn-1',
      organizationId: v.connection === 'other-org' ? otherOrg : ORG,
      platform:
        v.connection === 'other-platform'
          ? v.platform === 'youtube'
            ? 'facebook'
            : 'youtube'
          : v.platform,
      isActive: v.connection !== 'inactive',
      deletedAt: v.connection === 'deleted' ? new Date(NOW - 86_400_000) : null,
      accessToken: {
        plain: 'tok-synthetic',
        empty: '',
        placeholder: 'PENDING_OAUTH',
        'bad-ciphertext': 'enc:v1:not-a-real-ciphertext',
      }[v.token],
      refreshToken: v.refreshToken ? 'refresh-synthetic' : null,
      expiresAt:
        v.expiry === 'none'
          ? null
          : new Date(NOW + (v.expiry === 'future' ? 86_400_000 : -86_400_000)),
      metadata: null,
    });
  return { organizationId: ORG, calendarId, slotId, platform: v.platform };
}

const describeV = (v: Vector) =>
  `${v.platform}/${v.payload} users=${v.users} sub=${v.subscription}${v.subOtherOrg ? '@other-org' : ''} org=${v.orgRow ? `${v.calendarMode}/paused=${v.paused}` : 'missing'} ` +
  (v.payload === 'slot'
    ? `slot=${v.slotStatus}${v.slotOtherOrg ? '@other-org' : ''} manifest=${v.manifest}`
    : `cut=${v.cut}`) +
  ` conn=${v.connection} exp=${v.expiry} refresh=${v.refreshToken} token=${v.token} digests=${v.digests}`;

/** The detector: does the gate's answer match the oracle for this world? */
async function judge(v: Vector, n: number, gate: Safety) {
  const fails = failingGates(v);
  const res = await gate(seed(v, n));
  const passed = fails.length > 0 ? res.pass === false : res.pass === true;
  return {
    criterion: fails.length > 0 ? 'G4.C1' : 'G4.C2',
    passed,
    detail: `${describeV(v)} | expected ${fails.length ? `refuse [${fails.join(',')}]` : 'allow'} | got pass=${res.pass}${res.failedGate ? ` gate=${res.failedGate}` : ''}`,
  };
}

const N = Number(process.env.SWEEP_G4_CASES ?? 95_000);
const sink = new Sink('G4');
let runSafetyChecks: Safety | undefined;
let importError = '';

beforeAll(async () => {
  quietConsole();
  try {
    runSafetyChecks = (await import('@/lib/publish/safetyChecks'))
      .runSafetyChecks;
    const f = await import('@/tests/helpers/campaign-authority-manifest');
    manifestFor = platforms =>
      f.buildApprovedCampaignAuthorityManifest({
        platformOutputs: platforms.map(p => ({
          platform: p,
          status: 'approved',
          contentRef: `post-${p}`,
        })),
      });
  } catch (err) {
    importError =
      err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  }
});
afterAll(() => sink.write());

it('G4 gate-vector cases', async () => {
  const r = rng(SWEEP.seed ^ 0x4a4);
  for (let n = 0; n < N; n++) {
    const v = vector(r);
    if (!runSafetyChecks) {
      sink.verdict(
        failingGates(v).length ? 'G4.C1' : 'G4.C2',
        null,
        `import failed: ${importError}`
      );
      continue;
    }
    try {
      const j = await judge(v, n, runSafetyChecks);
      sink.verdict(
        j.criterion,
        j.passed,
        j.detail,
        'lib/publish/safetyChecks.ts#runSafetyChecks'
      );
    } catch (err) {
      sink.verdict(
        failingGates(v).length ? 'G4.C1' : 'G4.C2',
        null,
        `threw: ${String(err).slice(0, 120)}`
      );
    }
  }
});

it('G4 planted controls', async () => {
  const real = runSafetyChecks;
  const r = rng(SWEEP.seed ^ 0xc4);
  const base = goodVector(r);
  const controls: [string, string, Partial<Vector>, Safety][] = [
    // Gate stubbed to always pass.
    [
      'G4-C01',
      'G4.C1',
      { slotStatus: 'draft', paused: true },
      async () => ({ pass: true }),
    ],
    // Kill switch ignored: the gate reads the org as unpaused.
    [
      'G4-C02',
      'G4.C1',
      { paused: true },
      async input => {
        for (const o of table('organization')) o.autoPublishPaused = false;
        return real!(input);
      },
    ],
    // Digest gate off by one (two digests treated as three).
    [
      'G4-C03',
      'G4.C1',
      { digests: 2 },
      async input => {
        const u = table('aIWeeklyDigest')[0] as Row | undefined;
        if (u) table('aIWeeklyDigest').push({ ...u, id: 'dg-planted' });
        return real!(input);
      },
    ],
    // Expired, non-refreshable token accepted.
    [
      'G4-C04',
      'G4.C1',
      { platform: 'facebook', expiry: 'past' },
      async input => {
        for (const c of table('platformConnection')) c.expiresAt = null;
        return real!(input);
      },
    ],
  ];
  for (const [id, criterion, patch, mutant] of controls) {
    if (!real) {
      sink.control(id, criterion, null, `import failed: ${importError}`);
      continue;
    }
    const v = { ...base, payload: 'slot' as const, ...patch };
    const j = await judge(v, 900_000, disarmed(id) ? real : mutant);
    sink.control(id, criterion, !j.passed, j.detail);
  }
  void db;
});
