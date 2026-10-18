/**
 * @jest-environment node
 *
 * scripts/api/gen-openapi.mjs — the generated machine contract (spec M3, P3).
 * Runs the real CLI against a fixture app/api tree (--root) so path mapping,
 * security inference, schema probing and the --check counts are exercised
 * end to end, including the exit codes CI relies on.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const SCRIPT = path.join(__dirname, '../../../scripts/api/gen-openapi.mjs');
const SPEC = 'docs/api/openapi.generated.json';

const ROUTES: Record<string, string> = {
  'app/api/items/route.ts': `
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

const CreateItemSchema = z.object({
  name: z.string().min(1),
  tags: z.array(z.string()).optional().default([]),
});

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  return NextResponse.json({ userId });
}

async function handlePost(request: NextRequest) {
  const body = await request.json();
  const parsed = CreateItemSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'bad' }, { status: 400 });
  return NextResponse.json(parsed.data, { status: 201 });
}
export const POST = handlePost;
`,
  'app/api/items/[id]/route.ts': `
export async function DELETE() {
  // process.env.CRON_SECRET is mentioned only in this comment
  return new Response(null, { status: 204 });
}
`,
  'app/api/files/[...slug]/route.ts': `
export async function GET(request: Request) {
  if (request.headers.get('authorization') !== \`Bearer \${process.env.CRON_SECRET}\`) {
    return new Response('no', { status: 401 });
  }
  return new Response('ok');
}
`,
  'app/api/(marketing)/opt/[[...rest]]/route.ts': `
export async function GET(request: Request) {
  const key = request.headers.get('x-api-key');
  return new Response(key ? 'ok' : 'no');
}
`,
  'app/api/gated/route.ts': `
import { NextRequest, NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/middleware/require-api-key';
export async function POST(request: NextRequest) {
  return requireApiKey(request, async () => NextResponse.json({ ok: true }));
}
`,
  'app/api/local-schema/route.ts': `
import { z } from 'zod';
export async function PUT(request: Request) {
  const inner = z.object({ a: z.string() });
  inner.parse(await request.json());
  return new Response('ok');
}
`,
  'app/api/broken/route.ts': `
import { z } from 'zod';
import './explode';
const BodySchema = z.object({ a: z.string() });
export async function PATCH(request: Request) {
  BodySchema.parse(await request.json());
  return new Response('ok');
}
`,
  'app/api/alias/route.ts': `export { GET } from '@/app/api/items/route';\n`,
};

function makeFixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-openapi-test-'));
  for (const [rel, source] of Object.entries(ROUTES)) {
    fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), source);
  }
  fs.writeFileSync(
    path.join(root, 'app/api/broken/explode.ts'),
    "throw new Error('fixture import failure');\n"
  );
  fs.mkdirSync(path.join(root, 'scripts/api'), { recursive: true });
  fs.writeFileSync(path.join(root, 'scripts/api/exempt-routes.json'), '[]\n');
  return root;
}

function run(root: string, ...args: string[]) {
  const result = spawnSync('node', [SCRIPT, '--root', root, ...args], {
    encoding: 'utf8',
    timeout: 120_000,
  });
  return {
    status: result.status,
    out: `${result.stdout}${result.stderr}`,
  };
}

type Op = Record<string, any>;
const readSpec = (root: string) =>
  JSON.parse(fs.readFileSync(path.join(root, SPEC), 'utf8'));
const schemes = (op: Op) =>
  op.security.map((r: Record<string, unknown>) => Object.keys(r)[0]);

describe('gen-openapi', () => {
  let root: string;
  let spec: Record<string, any>;

  beforeAll(() => {
    root = makeFixture();
    const gen = run(root);
    expect(gen.out).toContain('wrote docs/api/openapi.generated.json');
    expect(gen.status).toBe(0);
    spec = readSpec(root);
  }, 120_000);

  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  describe('path mapping', () => {
    it('maps dynamic, catch-all, optional catch-all and route groups', () => {
      expect(Object.keys(spec.paths)).toEqual([
        '/api/alias',
        '/api/broken',
        '/api/files/{slug}',
        '/api/gated',
        '/api/items',
        '/api/items/{id}',
        '/api/local-schema',
        '/api/opt/{rest}',
      ]);
    });

    it('records path parameters, operationId, tags and route file', () => {
      const op = spec.paths['/api/items/{id}'].delete;
      expect(op.operationId).toBe('delete_items_by_id');
      expect(op.tags).toEqual(['items']);
      expect(op.parameters).toEqual([
        { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
      ]);
      expect(spec.paths['/api/items/{id}']['x-synthex-route-file']).toBe(
        'app/api/items/[id]/route.ts'
      );
      expect(spec.paths['/api/files/{slug}'].get.parameters[0].name).toBe(
        'slug'
      );
      expect(spec.paths['/api/opt/{rest}'].get.operationId).toBe(
        'get_opt_by_rest'
      );
    });

    it('emits only exported HTTP methods, following re-exports', () => {
      expect(Object.keys(spec.paths['/api/items']).sort()).toEqual([
        'get',
        'post',
        'x-synthex-route-file',
      ]);
      expect(spec.paths['/api/alias'].get['x-synthex-handler']).toBe(
        'app/api/items/route.ts'
      );
      expect(schemes(spec.paths['/api/alias'].get)).toEqual([
        'bearerAuth',
        'cookieAuth',
      ]);
    });
  });

  describe('security inference', () => {
    it('jwt helper -> bearer or auth-token cookie', () => {
      expect(schemes(spec.paths['/api/items'].get)).toEqual([
        'bearerAuth',
        'cookieAuth',
      ]);
    });
    it('CRON_SECRET in code -> cron bearer', () => {
      expect(schemes(spec.paths['/api/files/{slug}'].get)).toEqual([
        'cronSecret',
      ]);
    });
    it('x-api-key header -> apiKeyAuth', () => {
      expect(schemes(spec.paths['/api/opt/{rest}'].get)).toEqual([
        'apiKeyAuth',
      ]);
    });
    it('requireApiKey -> cookie only', () => {
      expect(schemes(spec.paths['/api/gated'].post)).toEqual(['cookieAuth']);
    });
    it('a guard named only in a comment is not a guard', () => {
      const op = spec.paths['/api/items/{id}'].delete;
      expect(op.security).toEqual([]);
      expect(op['x-synthex-auth']).toEqual(['none-detected']);
      expect(op.responses['401']).toBeUndefined();
    });
  });

  describe('schemas', () => {
    it('converts a module-level Zod body schema (input side)', () => {
      const op = spec.paths['/api/items'].post;
      expect(op['x-synthex-schema']).toBe('resolved');
      const schema = op.requestBody.content['application/json'].schema;
      expect(schema.required).toEqual(['name']);
      expect(schema.properties.name).toEqual({ minLength: 1, type: 'string' });
      expect(Object.keys(op.responses).sort()).toEqual([
        '201',
        '400',
        '401',
        '500',
      ]);
      expect(op.responses['400'].content['application/json'].schema).toEqual({
        $ref: '#/components/schemas/Error',
      });
    });
    it('records unresolved with a reason instead of inventing a schema', () => {
      const local = spec.paths['/api/local-schema'].put;
      expect(local['x-synthex-schema']).toBe('unresolved');
      expect(local['x-synthex-schema-reason']).toMatch(/not a module-level/);
      expect(local.requestBody).toBeUndefined();
      const broken = spec.paths['/api/broken'].patch;
      expect(broken['x-synthex-schema']).toBe('unresolved');
      expect(broken['x-synthex-schema-reason']).toContain(
        'route import failed: fixture import failure'
      );
      expect(broken.requestBody).toBeUndefined();
    });
    it('output is deterministic', () => {
      const before = fs.readFileSync(path.join(root, SPEC), 'utf8');
      expect(run(root).status).toBe(0);
      expect(fs.readFileSync(path.join(root, SPEC), 'utf8')).toBe(before);
      expect(before).not.toMatch(/gen-openapi-test-|\.cache\/gen-openapi/);
    }, 120_000);
  });

  describe('--check counts', () => {
    const planted = 'app/api/planted/route.ts';
    afterEach(() => {
      fs.rmSync(path.join(root, 'app/api/planted'), {
        recursive: true,
        force: true,
      });
    });

    it('passes on a fresh contract and prints both counts', () => {
      const r = run(root, '--check');
      expect(r.out).toContain('route.ts files: 8; exempt entries: 0');
      expect(r.out).toContain('committed spec paths: 8');
      expect(r.status).toBe(0);
    }, 120_000);

    it('fails when a route has no spec entry', () => {
      fs.mkdirSync(path.join(root, 'app/api/planted'), { recursive: true });
      fs.writeFileSync(
        path.join(root, planted),
        'export function GET() { return new Response(); }\n'
      );
      const r = run(root, '--check');
      expect(r.out).toContain('expected paths: 9');
      expect(r.out).toContain('FAIL (b)');
      expect(r.status).toBe(1);
    }, 120_000);

    it('an exempt entry removes the route from both sides', () => {
      fs.mkdirSync(path.join(root, 'app/api/planted'), { recursive: true });
      fs.writeFileSync(
        path.join(root, planted),
        'export function GET() { return new Response(); }\n'
      );
      const exempt = path.join(root, 'exempt.json');
      fs.writeFileSync(
        exempt,
        JSON.stringify([{ file: planted, reason: 'fixture' }])
      );
      const r = run(root, '--check', '--exempt', exempt);
      expect(r.out).toContain('route.ts files: 9; exempt entries: 1');
      expect(r.status).toBe(0);
    }, 120_000);

    it('fails when a spec entry is deleted', () => {
      const file = path.join(root, SPEC);
      const original = fs.readFileSync(file, 'utf8');
      const edited = JSON.parse(original);
      delete edited.paths['/api/gated'];
      fs.writeFileSync(file, JSON.stringify(edited));
      try {
        const r = run(root, '--check');
        expect(r.out).toContain('committed spec paths: 7');
        expect(r.out).toContain('FAIL (a)');
        expect(r.out).toContain('FAIL (b)');
        expect(r.status).toBe(1);
      } finally {
        fs.writeFileSync(file, original);
      }
    }, 120_000);

    it('exits 2 when an input cannot be read', () => {
      const r = run(root, '--check', '--exempt', path.join(root, 'missing'));
      expect(r.out).toContain('cannot read inputs');
      expect(r.status).toBe(2);
    }, 120_000);
  });

  it('--control catches both plants', () => {
    const r = run(root, '--control');
    expect(r.out).toContain('CAUGHT/OK: planted route without a spec entry');
    expect(r.out).toContain('CAUGHT/OK: deleted spec entry');
    expect(r.status).toBe(0);
  }, 120_000);
});
