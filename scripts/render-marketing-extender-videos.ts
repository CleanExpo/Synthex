#!/usr/bin/env npx tsx

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'public', 'videos');
const entryPoint = path.join(root, 'lib', 'remotion', 'index.tsx');

const videos = [
  ['MarketingExtenderIntro', 'marketing-extender-intro.mp4'],
  ['MarketingExtenderContext', 'marketing-extender-context.mp4'],
  ['MarketingExtenderExpand', 'marketing-extender-expand.mp4'],
  ['MarketingExtenderDecision', 'marketing-extender-decision.mp4'],
  ['MarketingExtenderHandoff', 'marketing-extender-handoff.mp4'],
] as const;

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const serveUrl = await bundle({
    entryPoint,
    publicDir: path.join(root, 'public'),
    webpackOverride: config => config,
  });

  for (const [id, filename] of videos) {
    const composition = await selectComposition({ serveUrl, id });
    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      crf: 24,
      outputLocation: path.join(outputDir, filename),
      onProgress: ({ progress }) => {
        process.stdout.write(`\r${id}: ${Math.round(progress * 100)}%`);
      },
    });
    process.stdout.write(`\nRendered ${filename}\n`);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
