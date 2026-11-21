/**
 * @jest-environment node
 */
/**
 * Brand Video worker connection and preflight — SYN-1145.
 *
 * The August runs failed with "Invalid API key": the key did not belong to the
 * project the URL named. These tests pin the three yes/no preflight answers and
 * the rule that no URL, key or project reference ever reaches output.
 *
 * Fixtures are built at run time from obviously fake parts. No real key or
 * real project reference is written here: this repository is public.
 */
import {
  DEFAULT_BRAND_VIDEO_BUCKET,
  BrandVideoConfigError,
  brandVideoPreflightPassed,
  classifyKey,
  createBrandVideoClient,
  createBrandVideoLogger,
  BRAND_VIDEO_PUBLIC_ERROR_CODES,
  formatBrandVideoPreflight,
  publicErrorSummary,
  publicJobId,
  projectRefFromUrl,
  redactBrandVideoSecrets,
  resolveBrandVideoConfig,
  resolveBucket,
  runBrandVideoPreflight,
} from '@/lib/brand-video/connection';
import { BrandVideoQueueError } from '@/lib/brand-video/planner';

const REF_A = 'fakeprojectaaaaaaaaa'; // 20 characters, like a real reference
const REF_B = 'fakeprojectbbbbbbbbb';
const urlFor = (ref: string) => `https://${ref}.supabase.co`;

function fakeJwt(payload: Record<string, unknown>): string {
  const enc = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc(payload)}.sentinelsignaturezzzz`;
}

const SERVICE_A = fakeJwt({
  iss: 'supabase',
  ref: REF_A,
  role: 'service_role',
});
const SERVICE_B = fakeJwt({
  iss: 'supabase',
  ref: REF_B,
  role: 'service_role',
});
const ANON_A = fakeJwt({ iss: 'supabase', ref: REF_A, role: 'anon' });
const SECRET = 'sb_secret_SENTINELfakesecretvalue0000';

type Bucket = { id: string; name: string };

/** A client factory whose storage answers listBuckets as told, recording calls. */
function fakeFactory(
  answer: { data: Bucket[] | null; error: { message: string } | null } | 'throw'
) {
  const calls: Array<{ url: string; key: string; options: unknown }> = [];
  const factory = ((url: string, key: string, options: unknown) => {
    calls.push({ url, key, options });
    return {
      storage: {
        listBuckets: async () => {
          if (answer === 'throw') {
            throw new Error(`fetch failed for ${url} with ${key}`);
          }
          return answer;
        },
      },
    };
  }) as unknown as Parameters<typeof runBrandVideoPreflight>[1];
  return { factory, calls };
}

const bucketsOk = {
  data: [{ id: 'brand-video', name: 'brand-video' }],
  error: null,
};

describe('resolveBucket / resolveBrandVideoConfig', () => {
  it('defaults the bucket to brand-video, the bucket that exists', () => {
    expect(DEFAULT_BRAND_VIDEO_BUCKET).toBe('brand-video');
    expect(resolveBucket({})).toBe('brand-video');
    expect(resolveBucket({ BRAND_VIDEO_BUCKET: '  ' })).toBe('brand-video');
    expect(resolveBucket({ BRAND_VIDEO_BUCKET: 'other' })).toBe('other');
  });

  it('accepts either URL variable', () => {
    expect(
      resolveBrandVideoConfig({
        SUPABASE_URL: urlFor(REF_A),
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_A,
      })
    ).toEqual({ url: urlFor(REF_A), key: SERVICE_A, bucket: 'brand-video' });
  });

  it('refuses two URL variables that point at different projects', () => {
    expect(() =>
      resolveBrandVideoConfig({
        NEXT_PUBLIC_SUPABASE_URL: urlFor(REF_A),
        SUPABASE_URL: urlFor(REF_B),
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_A,
      })
    ).toThrow(BrandVideoConfigError);
  });

  it('refuses a missing key or URL, naming variables and never values', () => {
    let message = '';
    try {
      resolveBrandVideoConfig({ SUPABASE_URL: urlFor(REF_A) });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(message).not.toContain(REF_A);
    expect(() =>
      resolveBrandVideoConfig({ SUPABASE_SERVICE_ROLE_KEY: SERVICE_A })
    ).toThrow(BrandVideoConfigError);
  });
});

describe('projectRefFromUrl and classifyKey', () => {
  it('reads the reference from a hosted project URL only', () => {
    expect(projectRefFromUrl(urlFor(REF_A))).toBe(REF_A);
    expect(projectRefFromUrl(`${urlFor(REF_A)}/`)).toBe(REF_A);
    expect(projectRefFromUrl(`http://${REF_A}.supabase.co`)).toBeNull();
    expect(projectRefFromUrl('https://db.example.com')).toBeNull();
    expect(projectRefFromUrl('not a url')).toBeNull();
  });

  it('classifies legacy JWT keys by role and reference', () => {
    expect(classifyKey(SERVICE_A)).toEqual({
      kind: 'service_role',
      ref: REF_A,
    });
    expect(classifyKey(ANON_A)).toEqual({ kind: 'anon', ref: REF_A });
  });

  it('classifies new-format keys by prefix', () => {
    expect(classifyKey(SECRET)).toEqual({ kind: 'secret', ref: null });
    expect(classifyKey('sb_publishable_fake')).toEqual({
      kind: 'publishable',
      ref: null,
    });
    expect(classifyKey(undefined).kind).toBe('unknown');
    expect(classifyKey('a.b.c').kind).toBe('unknown');
  });
});

describe('runBrandVideoPreflight', () => {
  it('answers yes three times for a matching service-role key and an existing bucket', async () => {
    const { factory, calls } = fakeFactory(bucketsOk);
    const r = await runBrandVideoPreflight(
      { SUPABASE_URL: urlFor(REF_A), SUPABASE_SERVICE_ROLE_KEY: SERVICE_A },
      factory
    );
    expect(r).toEqual({
      sameProject: true,
      privilegedKey: true,
      bucketExists: true,
    });
    expect(brandVideoPreflightPassed(r)).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it('accepts an sb_secret_ key on the live probe alone', async () => {
    const { factory } = fakeFactory(bucketsOk);
    const r = await runBrandVideoPreflight(
      {
        NEXT_PUBLIC_SUPABASE_URL: urlFor(REF_A),
        SUPABASE_SERVICE_ROLE_KEY: SECRET,
      },
      factory
    );
    expect(brandVideoPreflightPassed(r)).toBe(true);
  });

  it('says no to same project when the key belongs to another project, without calling out', async () => {
    // The suspected August fault: URL for one project, key for another.
    const { factory, calls } = fakeFactory(bucketsOk);
    const r = await runBrandVideoPreflight(
      { SUPABASE_URL: urlFor(REF_A), SUPABASE_SERVICE_ROLE_KEY: SERVICE_B },
      factory
    );
    expect(r.sameProject).toBe(false);
    expect(r.privilegedKey).toBe(true);
    expect(brandVideoPreflightPassed(r)).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('says no to same project when the two URL variables disagree', async () => {
    const { factory } = fakeFactory(bucketsOk);
    const r = await runBrandVideoPreflight(
      {
        NEXT_PUBLIC_SUPABASE_URL: urlFor(REF_B),
        SUPABASE_URL: urlFor(REF_A),
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_A,
      },
      factory
    );
    expect(r.sameProject).toBe(false);
    expect(brandVideoPreflightPassed(r)).toBe(false);
  });

  it('says no to the key when it is an anon key', async () => {
    const { factory } = fakeFactory(bucketsOk);
    const r = await runBrandVideoPreflight(
      { SUPABASE_URL: urlFor(REF_A), SUPABASE_SERVICE_ROLE_KEY: ANON_A },
      factory
    );
    expect(r.privilegedKey).toBe(false);
    expect(brandVideoPreflightPassed(r)).toBe(false);
  });

  it('says no to same project when the project refuses the key (Invalid API key)', async () => {
    const { factory } = fakeFactory({
      data: null,
      error: { message: 'Invalid API key' },
    });
    const r = await runBrandVideoPreflight(
      { SUPABASE_URL: urlFor(REF_A), SUPABASE_SERVICE_ROLE_KEY: SECRET },
      factory
    );
    expect(r).toEqual({
      sameProject: false,
      privilegedKey: true,
      bucketExists: false,
    });
  });

  it('says no to the bucket when the old plural default is configured', async () => {
    const { factory } = fakeFactory(bucketsOk);
    const r = await runBrandVideoPreflight(
      {
        SUPABASE_URL: urlFor(REF_A),
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_A,
        BRAND_VIDEO_BUCKET: 'brand-videos',
      },
      factory
    );
    expect(r).toEqual({
      sameProject: true,
      privilegedKey: true,
      bucketExists: false,
    });
  });

  it('answers no, and does not throw, when the probe throws', async () => {
    const { factory } = fakeFactory('throw');
    const r = await runBrandVideoPreflight(
      { SUPABASE_URL: urlFor(REF_A), SUPABASE_SERVICE_ROLE_KEY: SERVICE_A },
      factory
    );
    expect(brandVideoPreflightPassed(r)).toBe(false);
  });

  it('answers no with nothing configured', async () => {
    const { factory, calls } = fakeFactory(bucketsOk);
    const r = await runBrandVideoPreflight({}, factory);
    expect(r).toEqual({
      sameProject: false,
      privilegedKey: false,
      bucketExists: false,
    });
    expect(calls).toHaveLength(0);
  });
});

describe('preflight and render step share one configuration rule', () => {
  // A preflight that passes a configuration the render step then refuses
  // would let the scheduled run fail after reporting three yes answers.
  const variants: Array<[string, Record<string, string>]> = [
    ['one plain URL', { SUPABASE_URL: urlFor(REF_A) }],
    ['trailing slash', { SUPABASE_URL: `${urlFor(REF_A)}/` }],
    [
      'both URLs, same project',
      {
        NEXT_PUBLIC_SUPABASE_URL: urlFor(REF_A),
        SUPABASE_URL: `${urlFor(REF_A)}/`,
      },
    ],
    [
      'same project, upper-case host',
      {
        NEXT_PUBLIC_SUPABASE_URL: urlFor(REF_A)
          .toUpperCase()
          .replace('HTTPS', 'https'),
        SUPABASE_URL: urlFor(REF_A),
      },
    ],
    [
      'same project, one URL with a path',
      {
        NEXT_PUBLIC_SUPABASE_URL: urlFor(REF_A),
        SUPABASE_URL: `${urlFor(REF_A)}/rest`,
      },
    ],
    ['URL with a port', { SUPABASE_URL: `${urlFor(REF_A)}:8443` }],
    ['URL with a query', { SUPABASE_URL: `${urlFor(REF_A)}?x=1` }],
    [
      'two projects',
      { NEXT_PUBLIC_SUPABASE_URL: urlFor(REF_A), SUPABASE_URL: urlFor(REF_B) },
    ],
  ];

  it.each(variants)(
    '%s: preflight passes exactly when the config resolves',
    async (_name, urls) => {
      const env = { ...urls, SUPABASE_SERVICE_ROLE_KEY: SECRET };
      let resolves = true;
      try {
        resolveBrandVideoConfig(env);
      } catch {
        resolves = false;
      }
      const { factory } = fakeFactory(bucketsOk);
      const passed = brandVideoPreflightPassed(
        await runBrandVideoPreflight(env, factory)
      );
      expect(passed).toBe(resolves);
    }
  );

  it('refuses a URL with a path, which the old preflight passed', async () => {
    const env = {
      NEXT_PUBLIC_SUPABASE_URL: urlFor(REF_A),
      SUPABASE_URL: `${urlFor(REF_A)}/rest`,
      SUPABASE_SERVICE_ROLE_KEY: SECRET,
    };
    const { factory } = fakeFactory(bucketsOk);
    const r = await runBrandVideoPreflight(env, factory);
    expect(r.sameProject).toBe(false);
    expect(() => resolveBrandVideoConfig(env)).toThrow(BrandVideoConfigError);
  });

  it('hands the client the canonical project address', () => {
    expect(
      resolveBrandVideoConfig({
        SUPABASE_URL: `${urlFor(REF_A)}/`,
        SUPABASE_SERVICE_ROLE_KEY: SECRET,
      }).url
    ).toBe(urlFor(REF_A));
  });
});

describe('no value ever reaches output', () => {
  const sentinels = [
    REF_A,
    REF_B,
    urlFor(REF_A),
    SERVICE_A,
    SECRET,
    'sentinelsignaturezzzz',
  ];

  it('prints only fixed text and yes or no', () => {
    for (const r of [
      { sameProject: true, privilegedKey: true, bucketExists: true },
      { sameProject: false, privilegedKey: false, bucketExists: false },
    ]) {
      const lines = formatBrandVideoPreflight(r);
      expect(lines).toHaveLength(3);
      for (const line of lines) {
        expect(line).toMatch(/^Brand Video preflight: [^:]+: (yes|no)$/);
        for (const s of sentinels) expect(line).not.toContain(s);
      }
    }
  });

  it('redacts configured URL, reference and key from relayed error text', () => {
    const env = {
      SUPABASE_URL: urlFor(REF_A),
      SUPABASE_SERVICE_ROLE_KEY: SECRET,
    };
    const out = redactBrandVideoSecrets(
      `fetch failed for ${urlFor(REF_A)}/rest/v1 host ${REF_A} key ${SECRET}`,
      env
    );
    for (const s of [REF_A, urlFor(REF_A), SECRET])
      expect(out).not.toContain(s);
    expect(out).toContain('[redacted]');
  });

  it('redacts the bucket name as a whole name, not inside a longer word', () => {
    const env = { BRAND_VIDEO_BUCKET: 'brand-video' };
    expect(redactBrandVideoSecrets('Bucket brand-video not found', env)).toBe(
      'Bucket [redacted] not found'
    );
    expect(redactBrandVideoSecrets("bucket 'brand-video'.", env)).toBe(
      "bucket '[redacted]'."
    );
    expect(
      redactBrandVideoSecrets('brand-video-worker: preflight failed', env)
    ).toBe('brand-video-worker: preflight failed');
    // The default bucket is redacted too when the variable is unset.
    expect(redactBrandVideoSecrets('no brand-video here', {})).toBe(
      'no [redacted] here'
    );
  });

  it('routes every log line, error line and stored job error through redaction', () => {
    // Row fields and provider errors are text the worker did not write. A
    // sentinel placed in each must not reach stdout, stderr or the column.
    const env = {
      SUPABASE_URL: urlFor(REF_A),
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_A,
      BRAND_VIDEO_BUCKET: 'brand-video',
    };
    const stdout: string[] = [];
    const stderr: string[] = [];
    const logger = createBrandVideoLogger(
      env,
      l => stdout.push(l),
      l => stderr.push(l),
      () => new Date('2026-11-22T01:02:03Z')
    );
    const rowBrand = `${urlFor(REF_A)} ${SERVICE_A}`;
    logger.log(`Job job-1: ${rowBrand} / ${REF_A}`);
    logger.error(
      `Storage upload failed: Bucket brand-video not found ${SERVICE_A}`
    );
    const column = logger.forColumn(
      `provider said ${SERVICE_A} ${'x'.repeat(600)}`
    );

    expect(stdout[0]).toMatch(/^\[01:02:03\] Job job-1: /);
    for (const text of [...stdout, ...stderr, column]) {
      for (const s of [...sentinels, 'brand-video ']) {
        expect(text).not.toContain(s);
      }
    }
    expect(column.length).toBeLessThanOrEqual(500);
  });
});

describe('values that were never configured are withheld too', () => {
  // Review round on 0997c21f9: the redactor removed only configured values, so
  // an unrelated URL or reference in row or provider text reached the log.
  const env = {
    SUPABASE_URL: urlFor(REF_A),
    SUPABASE_SERVICE_ROLE_KEY: SECRET,
  };
  const OTHER_URL = 'https://private.example/path?q=1';
  const OTHER_REF = 'abcdabcdabcdabcdabcd';
  const OTHER_HOST = `${REF_B}.supabase.co`;
  const OTHER_JWT = fakeJwt({ ref: REF_B, role: 'service_role' });
  const OTHER_SECRET = 'sb_secret_otherFAKEvalue1234';
  const OTHER_PUBLISHABLE = 'sb_publishable_otherFAKEvalue1234';
  const unconfigured = [
    OTHER_URL,
    OTHER_REF,
    OTHER_HOST,
    OTHER_JWT,
    OTHER_SECRET,
    OTHER_PUBLISHABLE,
    REF_B,
  ];
  const text = `provider sent ${OTHER_URL} and project ${OTHER_REF} on ${OTHER_HOST} with ${OTHER_JWT}, ${OTHER_SECRET}, ${OTHER_PUBLISHABLE}`;

  it('redacts them in the log, the error stream and the job error column', () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const logger = createBrandVideoLogger(
      env,
      l => stdout.push(l),
      l => stderr.push(l)
    );
    logger.log(text);
    logger.error(text);
    const column = logger.forColumn(text);
    for (const out of [stdout[0], stderr[0], column]) {
      for (const v of unconfigured) expect(out).not.toContain(v);
      expect(out).toContain('provider sent [redacted]');
    }
  });

  it('keeps ordinary words, ids and counts readable', () => {
    expect(
      redactBrandVideoSecrets(
        'Job 00000000-0000-4000-8000-000000000001: 12 beats, voiceover done',
        env
      )
    ).toBe(
      'Job 00000000-0000-4000-8000-000000000001: 12 beats, voiceover done'
    );
  });
});

describe('publicJobId and publicErrorSummary (what the public log may show)', () => {
  it('shows a job id only when it is a UUID', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    expect(publicJobId(id)).toBe(id);
    expect(publicJobId(urlFor(REF_A))).toBe('(id withheld)');
    expect(publicJobId(42)).toBe('(id withheld)');
  });

  it('shows a code from the closed set and never the message', () => {
    const sensitive = `${urlFor(REF_A)} ${SECRET} abcdabcdabcdabcdabcd`;
    const cases: Array<[unknown, string]> = [
      [
        new BrandVideoQueueError('QUEUE_READ_FAILED', sensitive, 'PGRST301'),
        'QUEUE_READ_FAILED PGRST301',
      ],
      [
        new BrandVideoQueueError('QUEUE_CLAIM_FAILED', sensitive, '40P01'),
        'QUEUE_CLAIM_FAILED 40P01',
      ],
      [
        new BrandVideoQueueError('STATUS_WRITE_FAILED', sensitive),
        'STATUS_WRITE_FAILED',
      ],
      // A database code of any other shape is dropped, not shown.
      [
        new BrandVideoQueueError('QUEUE_READ_FAILED', sensitive, sensitive),
        'QUEUE_READ_FAILED',
      ],
      [new BrandVideoConfigError(sensitive), 'CONFIG_INVALID'],
      [new Error(sensitive), 'UNEXPECTED'],
      [sensitive, 'UNEXPECTED'],
    ];
    for (const [err, want] of cases) {
      const got = publicErrorSummary(err);
      expect(got).toBe(want);
      expect(BRAND_VIDEO_PUBLIC_ERROR_CODES).toContain(got.split(' ')[0]);
    }
    expect(publicErrorSummary(new Error(sensitive), 'RENDER_FAILED')).toBe(
      'RENDER_FAILED'
    );
  });
});

describe('createBrandVideoClient', () => {
  it('builds the client without session persistence or token refresh', () => {
    const { factory, calls } = fakeFactory(bucketsOk);
    createBrandVideoClient(
      { url: urlFor(REF_A), key: SERVICE_A, bucket: 'brand-video' },
      factory
    );
    expect(calls[0]).toEqual({
      url: urlFor(REF_A),
      key: SERVICE_A,
      options: { auth: { persistSession: false, autoRefreshToken: false } },
    });
  });
});
