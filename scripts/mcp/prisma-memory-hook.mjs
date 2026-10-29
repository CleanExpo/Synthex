/**
 * Node module customization hook (node:module registerHooks): resolves the '@/lib/prisma'
 * specifier and the file lib/prisma.ts to scripts/mcp/prisma-memory.mjs, so no database is touched.
 * call-tool.mjs installs it only when DATABASE_URL is unset. It uses the synchronous in-thread
 * registerHooks because tsx's tsImport returns an empty namespace once an asynchronous
 * module.register() hook is also present (observed with tsx 4.22 on Node 24).
 */
import { registerHooks } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
const MEMORY = pathToFileURL(
  path.join(ROOT, 'scripts/mcp/prisma-memory.mjs')
).href;
const PRISMA = /^(@\/|(.*\/)?)lib\/prisma(\.ts)?$/;

export function installPrismaMemoryHook() {
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (PRISMA.test(specifier))
        return { url: MEMORY, shortCircuit: true, format: 'module' };
      return nextResolve(specifier, context);
    },
  });
}
