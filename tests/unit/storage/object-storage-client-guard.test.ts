/**
 * Guard: lib/storage/object-storage reads SUPABASE_SERVICE_ROLE_KEY, which
 * bypasses RLS, so it must never reach a browser bundle (DECISIONS.md FD-7).
 *
 * Fails if a client module imports it, directly or through any chain of
 * re-exports (`export ... from`). A client module is a file whose first
 * statement is 'use client', or any file under components/ or hooks/.
 *
 * Grep-based, like tests/unit/ai/no-direct-image-apis.test.ts: it resolves
 * static import/export/require/import() specifiers ('@/' and relative), not
 * specifiers assembled at runtime.
 */

/** @jest-environment node */

import * as fs from 'node:fs';
import * as path from 'node:path';

const TARGET = 'lib/storage/object-storage';
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const SKIP_DIRS = new Set(['node_modules', 'tests', '__tests__', 'scripts']);

const IMPORT_SPECS = [
  /\b(?:import|export)\s[^'"]*?\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*['"]([^'"]+)['"]/g,
  /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
];
const REEXPORT_SPEC =
  /\bexport\s+(?:type\s+)?(?:\*(?:\s+as\s+\w+)?|\{[^}]*\})\s*from\s*['"]([^'"]+)['"]/g;

/** Module id: repo-relative path without extension or trailing /index. */
function moduleId(file: string): string {
  return file.replace(/\.[cm]?[jt]sx?$/, '').replace(/\/index$/, '');
}

function resolve(fromFile: string, spec: string): string | null {
  let target: string;
  if (spec.startsWith('@/')) target = spec.slice(2);
  else if (spec.startsWith('.'))
    target = path.posix.join(path.posix.dirname(fromFile), spec);
  else return null;
  return moduleId(target);
}

function specs(source: string, patterns: RegExp[]): string[] {
  return patterns.flatMap(re =>
    Array.from(source.matchAll(new RegExp(re.source, 'g')), m => m[1])
  );
}

function isClient(file: string, source: string): boolean {
  return (
    file.startsWith('components/') ||
    file.startsWith('hooks/') ||
    /^\s*['"]use client['"]/.test(
      source.replace(/^(?:\s*(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/))*/, '')
    )
  );
}

/** Client files that import TARGET or a module re-exporting it, transitively. */
function findClientImports(files: Map<string, string>): string[] {
  const exposing = new Set([TARGET]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const [file, source] of files) {
      const id = moduleId(file);
      if (exposing.has(id)) continue;
      if (
        specs(source, [REEXPORT_SPEC]).some(s =>
          exposing.has(resolve(file, s) ?? '')
        )
      ) {
        exposing.add(id);
        grew = true;
      }
    }
  }
  const violations: string[] = [];
  for (const [file, source] of files) {
    if (!isClient(file, source)) continue;
    for (const s of specs(source, IMPORT_SPECS)) {
      const id = resolve(file, s);
      if (id && exposing.has(id)) violations.push(`${file} -> ${s}`);
    }
  }
  return violations;
}

function repoSources(): Map<string, string> {
  const root = process.cwd();
  const files = new Map<string, string>();
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(path.join(root, dir), {
      withFileTypes: true,
    })) {
      if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
      const rel = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(rel);
      else if (
        EXTENSIONS.has(path.extname(entry.name)) &&
        !/\.(test|spec)\./.test(entry.name)
      )
        files.set(rel, fs.readFileSync(path.join(root, rel), 'utf8'));
    }
  };
  walk('');
  return files;
}

describe('object-storage stays server-side', () => {
  it('detects direct, re-exported and use-client imports (positive control)', () => {
    const files = new Map<string, string>([
      [
        'components/Avatar.tsx',
        "import { upload } from '@/lib/storage/object-storage';",
      ],
      ['lib/storage/index.ts', "export * from './object-storage';"],
      ['lib/barrel.ts', "export { upload as put } from '@/lib/storage';"],
      ['hooks/use-upload.ts', "import {\n  put,\n} from '../lib/barrel';"],
      [
        'app/settings/Form.tsx',
        "// form\n'use client';\nconst s = await import('@/lib/storage/object-storage.ts');",
      ],
      [
        'app/api/user/avatar/route.ts',
        "import { upload } from '@/lib/storage/object-storage';",
      ],
      [
        'components/Ok.tsx',
        "import { x } from '@/lib/storage/platform-storage';",
      ],
    ]);
    expect(findClientImports(files).sort()).toEqual([
      'app/settings/Form.tsx -> @/lib/storage/object-storage.ts',
      'components/Avatar.tsx -> @/lib/storage/object-storage',
      'hooks/use-upload.ts -> ../lib/barrel',
    ]);
  });

  it('no client module in the repository imports it', () => {
    const files = repoSources();
    expect(files.has('lib/storage/object-storage.ts')).toBe(true);
    expect(findClientImports(files)).toEqual([]);
  });
});
