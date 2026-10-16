/**
 * Tripwire seed generator (SYN-1226) — every public-copy segment this branch
 * removed or rewrote, derived from Git history.
 *
 *   npm run claims:seeds            # print the set as JSON
 *   npm run claims:seeds -- --write # add new seeds to __tests__/landing/helpers/tripwire-seeds.generated.json
 *
 * --write preserves every committed seed and only adds new ones. The
 * completeness test is a subset check: every regenerated seed must be
 * committed; extra committed seeds are allowed (after a squash merge the
 * history is shorter, so regeneration yields a subset).
 *
 * Deterministic: the result depends only on the Git objects and the working
 * tree, read through the current extraction code.
 *
 * Snapshots: base 83243588, then every commit in 83243588..HEAD, then the
 * working tree, which is "head". A removal and its regenerated seeds can
 * therefore land in one commit.
 *
 * Segments: each snapshot's tripwire inventory is enumerated — public route
 * files and their imports, the API routes they call and those routes'
 * server modules, public/llms.txt, and the published video catalogue — and
 * each file's copy fragments are cut into segments by segmentTexts().
 *
 * Removed: a segment from any snapshot that head no longer carries, by the
 * matching rule below.
 *
 * No filter at all (orchestrator decision): every removed segment is a seed,
 * single words included ("Certified"). Only a segment whose normalised key
 * is empty (a bare URL or punctuation) is skipped — it has nothing to match.
 * Completeness is then true by construction, and public-claims-seeds.test.ts
 * proves every regenerated seed is committed (a subset rule).
 *
 * Matching (helpers/public-claims.ts): a seed under 4 words matches only an
 * exact whole normalised segment; a seed of 4+ words matches as a normalised
 * substring of a copy stream. "Absent at head" is judged by the same rule,
 * so the head tree cannot trip its own seeds.
 */

import { execFileSync } from 'child_process';
import fs from 'fs';
import { syncBuiltinESMExports } from 'module';
import path from 'path';

export const BASE = '83243588f2505c556a215dee6f275dcd10626caa';
const REPO = process.cwd();
const VROOT = '/__synthex_claims_snapshot__';
const OUT = path.join(
  REPO,
  '__tests__/landing/helpers/tripwire-seeds.generated.json'
);

type Entry = { type: 'blob' | 'tree'; oid: string };
type Tree = Map<string, Entry>;

const git = (...args: string[]) =>
  execFileSync('git', args, {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 1 << 30,
  });

const blobs = new Map<string, string>();
const blob = (oid: string) => {
  let text = blobs.get(oid);
  if (text === undefined) {
    text = git('cat-file', '-p', oid);
    blobs.set(oid, text);
  }
  return text;
};

function commitTree(sha: string): Tree {
  const tree: Tree = new Map([['', { type: 'tree', oid: '' }]]);
  for (const line of git('ls-tree', '-r', '-t', '--full-tree', sha).split(
    '\n'
  )) {
    const m = line.match(/^\d+ (blob|tree) ([0-9a-f]+)\t(.+)$/);
    if (m) tree.set(m[3], { type: m[1] as Entry['type'], oid: m[2] });
  }
  return tree;
}

/** The working tree as a snapshot: tracked and untracked, not ignored. */
function workingTree(): Tree {
  const tree: Tree = new Map([['', { type: 'tree', oid: '' }]]);
  for (const file of git('ls-files', '-co', '--exclude-standard', '-z')
    .split('\0')
    .filter(Boolean)) {
    if (!fs.existsSync(path.join(REPO, file))) continue; // deleted, unstaged
    tree.set(file, { type: 'blob', oid: `wt:${file}` });
    for (let d = path.dirname(file); d !== '.'; d = path.dirname(d)) {
      tree.set(d, { type: 'tree', oid: '' });
    }
  }
  return tree;
}

// ── Virtual filesystem: paths under VROOT are served from the snapshot ──────

let current: Tree = new Map();
const realFs = {
  existsSync: fs.existsSync,
  statSync: fs.statSync,
  readdirSync: fs.readdirSync,
  readFileSync: fs.readFileSync,
};
const inSnapshot = (p: unknown) =>
  typeof p === 'string' && (p === VROOT || p.startsWith(`${VROOT}/`));
const relOf = (p: string) => path.relative(VROOT, p);
const contentOf = (entry: Entry, rel: string) =>
  entry.oid.startsWith('wt:')
    ? (realFs.readFileSync(path.join(REPO, rel), 'utf8') as string)
    : blob(entry.oid);

function install() {
  Object.assign(fs, {
    existsSync: (p: fs.PathLike) =>
      inSnapshot(p) ? current.has(relOf(p as string)) : realFs.existsSync(p),
    statSync: (p: fs.PathLike, o?: fs.StatSyncOptions) => {
      if (!inSnapshot(p)) return realFs.statSync(p, o);
      const entry = current.get(relOf(p as string));
      if (!entry)
        throw Object.assign(new Error(`ENOENT ${p}`), { code: 'ENOENT' });
      return {
        isFile: () => entry.type === 'blob',
        isDirectory: () => entry.type === 'tree',
      };
    },
    readdirSync: (p: fs.PathLike, o?: unknown) => {
      if (!inSnapshot(p))
        return (realFs.readdirSync as (a: unknown, b?: unknown) => unknown)(
          p,
          o
        );
      const dir = relOf(p as string);
      const prefix = dir ? `${dir}/` : '';
      const names = new Set<string>();
      for (const key of current.keys()) {
        if (key.startsWith(prefix) && key !== dir) {
          const rest = key.slice(prefix.length);
          if (rest && !rest.includes('/')) names.add(rest);
        }
      }
      return [...names].sort();
    },
    readFileSync: (p: fs.PathOrFileDescriptor, o?: unknown) => {
      if (!inSnapshot(p))
        return (realFs.readFileSync as (a: unknown, b?: unknown) => unknown)(
          p,
          o
        );
      const rel = relOf(p as string);
      const entry = current.get(rel);
      if (!entry || entry.type !== 'blob') {
        throw Object.assign(new Error(`ENOENT ${p}`), { code: 'ENOENT' });
      }
      return contentOf(entry, rel);
    },
  });
  syncBuiltinESMExports();
}

// ── Generation ──────────────────────────────────────────────────────────────

const sortSeeds = (list: Seed[], keyOf: (t: string) => string) =>
  [...list].sort(
    (a, b) =>
      keyOf(a.text).localeCompare(keyOf(b.text)) || a.text.localeCompare(b.text)
  );

/** A seed's matching key is never stored: it is seedKeyOf(text), always. */
export interface Seed {
  text: string;
  file: string;
  /** First snapshot (short SHA, or "base") that carries the segment. */
  firstSeen: string;
}

async function generate(): Promise<{ snapshots: string[]; seeds: Seed[] }> {
  process.env.CLAIMS_ROOT = VROOT;
  install();
  const h = await import('../__tests__/landing/helpers/public-claims');

  const fragmentsByBlob = new Map<string, string[]>();
  // Every fragment, wiring-looking or not: no filter but the 2-word floor.
  const fragments = (entry: Entry, rel: string) => {
    const cacheKey = `${entry.oid}:${rel}`;
    let list = fragmentsByBlob.get(cacheKey);
    if (!list) {
      list = h
        .extractCopyFragments(contentOf(entry, rel), path.join(VROOT, rel), {
          keepWiring: true,
        })
        .map(f => f.text);
      fragmentsByBlob.set(cacheKey, list);
    }
    return list;
  };
  const inventory = () =>
    [
      ...new Set([
        ...h.publicSourceInventory({ followRouteImports: true }),
        ...h.PUBLISHED_OFF_SITE.map(f => path.join(VROOT, f)),
      ]),
    ]
      .map(f => relOf(f))
      .filter(rel => current.get(rel)?.type === 'blob')
      .sort();

  // Pass 1: every claim-bearing segment of every snapshot.
  const commits = [
    BASE,
    ...git('rev-list', '--reverse', `${BASE}..HEAD`)
      .split('\n')
      .filter(Boolean),
  ];
  const candidates = new Map<string, Seed>();
  const everInScope = new Set<string>();
  for (const sha of commits) {
    current = commitTree(sha);
    for (const rel of inventory()) {
      everInScope.add(rel);
      for (const text of h.segmentTexts(fragments(current.get(rel)!, rel))) {
        const key = h.seedKeyOf(text);
        if (!key || candidates.has(key)) continue; // nothing left to match
        candidates.set(key, {
          text,
          file: rel,
          firstSeen: sha === BASE ? 'base' : sha.slice(0, 8),
        });
      }
    }
  }

  // Pass 2: head's copy stream over its own inventory AND every file that was
  // ever in scope, so copy that only left the scope (a page gated off) is not
  // mistaken for copy that was removed.
  current = workingTree();
  const headFiles = [...new Set([...inventory(), ...everInScope])]
    .filter(rel => current.get(rel)?.type === 'blob')
    .sort();
  // Absent at head, judged as the matcher judges presence: a short seed
  // (under SHORT_SEED_WORDS words) by exact whole segment, a longer one
  // anywhere in a file's copy stream.
  const headSegments = new Set<string>();
  const headStreams: string[] = [];
  for (const rel of headFiles) {
    const list = fragments(current.get(rel)!, rel);
    for (const text of h.segmentTexts(list))
      headSegments.add(h.seedKeyOf(text));
    headStreams.push(h.streamKeyOf(list));
  }
  const seeds = [...candidates.values()].filter(seed =>
    h.seedWords(seed.text) < h.SHORT_SEED_WORDS
      ? !headSegments.has(h.seedKeyOf(seed.text))
      : !headStreams.some(stream => stream.includes(h.seedKeyOf(seed.text)))
  );
  return {
    snapshots: commits.map(c => c.slice(0, 8)),
    seeds: sortSeeds(seeds, h.seedKeyOf),
  };
}

const { snapshots, seeds } = await generate();
/** A seed retired on purpose, with the reason a reviewer can read. */
export interface RetiredSeed {
  text: string;
  reason: string;
}

const render = (list: Seed[], retired: RetiredSeed[] = []) =>
  `${JSON.stringify(
    {
      generator: 'scripts/claims-seeds.ts',
      base: BASE.slice(0, 8),
      count: list.length,
      seeds: list,
      retired,
    },
    null,
    2
  )}\n`;
if (process.argv.includes('--write')) {
  // Merge, never drop: committed seeds are kept (a squash merge removes the
  // snapshots that produced some of them) and only new ones are added. A
  // retired seed stays retired and is not re-added.
  const file = realFs.existsSync(OUT)
    ? JSON.parse(realFs.readFileSync(OUT, 'utf8') as string)
    : { seeds: [], retired: [] };
  const committed: Seed[] = file.seeds;
  const retired: RetiredSeed[] = file.retired ?? [];
  const keyOf = (await import('../__tests__/landing/helpers/public-claims'))
    .seedKeyOf;
  const retiredKeys = new Set(retired.map(r => keyOf(r.text)));
  // Stored keys from older files are dropped: the key is derived from text.
  const byKey = new Map(
    committed.map(({ text, file, firstSeen }) => [
      keyOf(text),
      { text, file, firstSeen },
    ])
  );
  let added = 0;
  for (const seed of seeds) {
    const key = keyOf(seed.text);
    if (!byKey.has(key) && !retiredKeys.has(key)) {
      byKey.set(key, seed);
      added++;
    }
  }
  const merged = sortSeeds([...byKey.values()], keyOf);
  fs.writeFileSync(OUT, render(merged, retired));
  process.stderr.write(
    `kept ${committed.length}, added ${added}: ${merged.length} seeds, ${retired.length} retired (${seeds.length} regenerated from ${snapshots.length} snapshots)\n`
  );
} else {
  process.stdout.write(render(seeds));
}
