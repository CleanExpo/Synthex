#!/usr/bin/env npx tsx
/**
 * Schematic Explainer Render Proof (SYN-41, first slice)
 *
 * Renders the single `SchematicExplainer` composition to an MP4 using the same
 * @remotion/bundler + @remotion/renderer Node.js API as
 * scripts/render-brand-videos.ts. Proves the blueprint-aesthetic → MP4 path
 * end-to-end through the existing Remotion platform (no new dependency).
 *
 * Usage:
 *   npx tsx scripts/render-schematic-explainer.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import type { RenderMediaOptions } from '@remotion/renderer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const REMOTION_ENTRY = path.join(ROOT_DIR, 'lib', 'remotion', 'index.tsx');
const OUTPUT_DIR = path.join(
  ROOT_DIR,
  'output',
  'videos',
  'schematic-explainer'
);
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'SchematicExplainer.mp4');

function log(message: string): void {
  const timestamp = new Date().toISOString().slice(11, 19);
  process.stdout.write(`[${timestamp}] ${message}\n`);
}

async function main(): Promise<void> {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  log('Bundling Remotion entry point...');
  const bundleLocation = await bundle({
    entryPoint: REMOTION_ENTRY,
    webpackOverride: config => config,
    publicDir: path.join(ROOT_DIR, 'public'),
  });
  log(`Bundle ready: ${bundleLocation}`);

  // defaultProps come from the registered <Composition> (registry.ts).
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'SchematicExplainer',
  });
  log(
    `Composition resolved: ${composition.id} ` +
      `(${composition.width}x${composition.height}, ` +
      `${composition.durationInFrames} frames @ ${composition.fps}fps)`
  );

  log('Rendering SchematicExplainer...');
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: OUTPUT_PATH,
    onProgress: ({ progress }) => {
      const pct = Math.round(progress * 100);
      if (pct % 20 === 0) {
        process.stdout.write(`\r  [SchematicExplainer] ${pct}%   `);
      }
    },
  } as RenderMediaOptions);
  process.stdout.write('\n');

  const sizeMB = (fs.statSync(OUTPUT_PATH).size / 1024 / 1024).toFixed(2);
  log(`Done: ${OUTPUT_PATH} (${sizeMB} MB)`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
