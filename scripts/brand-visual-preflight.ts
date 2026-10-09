#!/usr/bin/env npx tsx
/** Read-only CLI: emits evidence to stdout; makes no provider or production calls. */
import {
  brandVisualPreflightExitCode,
  runBrandVisualPreflight,
} from '../lib/brand/visual-preflight';
const report = runBrandVisualPreflight(process.cwd());
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exitCode = brandVisualPreflightExitCode(report);
