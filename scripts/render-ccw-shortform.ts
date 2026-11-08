/**
 * SYN-1404: render one CCW short-form video with Remotion at no render cost.
 *
 *   npx tsx scripts/render-ccw-shortform.ts --video ccw-w1-d1-am --work <dir>
 *
 * <dir> must hold <video>-vo.mp3 in <dir>/public and <video>-align.json (the
 * ElevenLabs with-timestamps response: { text, alignment }). The script:
 *   1. times each shot to its trigger words in the voiceover,
 *   2. copies only the owned reference photos and the CCW logo it needs into
 *      <dir>/public (nothing is written into the repo),
 *   3. renders 1080x1920 at 30 fps, then levels the mix to -16 LUFS.
 * Output: <dir>/out/<video>.mp4. Local preview only; nothing is published.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { CCW_SHOT_PLANS } from '../lib/remotion/ccw/shot-plans';
import {
  timeShots,
  wordsFromAlignment,
  type CcwAlignment,
} from '../lib/remotion/ccw/timing';

function arg(name: string): string {
  const i = process.argv.indexOf(name);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (!v) throw new Error(`missing ${name}`);
  return v;
}

function main() {
  const video = arg('--video');
  const work = path.resolve(arg('--work'));
  const plan = CCW_SHOT_PLANS.find(p => p.videoId === video);
  if (!plan) throw new Error(`no shot plan for ${video}`);
  // Run from the repository root.
  const root = process.cwd();
  const pub = path.join(work, 'public');
  const { text, alignment } = JSON.parse(
    fs.readFileSync(path.join(work, `${video}-align.json`), 'utf8')
  ) as { text: string; alignment: CcwAlignment };

  const shots = timeShots(text, alignment, plan.shots);
  const files = new Set(shots.flatMap(s => s.images));
  for (const rel of files) {
    const src = path.join(root, 'public/reference-library', rel);
    if (!fs.existsSync(src)) throw new Error(`missing owned photo ${rel}`);
    fs.mkdirSync(path.dirname(path.join(pub, rel)), { recursive: true });
    fs.copyFileSync(src, path.join(pub, rel));
  }
  fs.mkdirSync(path.join(pub, 'logos/ccw'), { recursive: true });
  fs.copyFileSync(
    path.join(root, 'public/logos/ccw/primary.svg'),
    path.join(pub, 'logos/ccw/primary.svg')
  );

  const props = {
    voice: `${video}-vo.mp3`,
    cta: plan.cta,
    url: plan.url,
    logo: 'logos/ccw/primary.svg',
    shots,
    words: wordsFromAlignment(text, alignment),
  };
  const propsFile = path.join(work, `${video}-props.json`);
  fs.writeFileSync(propsFile, JSON.stringify(props, null, 2));
  for (const s of shots) {
    console.log(
      `${s.from.toFixed(2)}s to ${s.to.toFixed(2)}s  ${s.kind}  "${s.trigger}"`
    );
  }

  const out = path.join(work, 'out');
  fs.mkdirSync(out, { recursive: true });
  const raw = path.join(out, `${video}-raw.mp4`);
  execFileSync(
    'npx',
    [
      'remotion',
      'render',
      'lib/remotion/ccw/index.tsx',
      'CcwShortform',
      raw,
      `--props=${propsFile}`,
      `--public-dir=${pub}`,
      '--codec=h264',
      '--log=error',
    ],
    { cwd: root, stdio: 'inherit' }
  );
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-loglevel',
      'error',
      '-i',
      raw,
      '-c:v',
      'copy',
      '-af',
      'loudnorm=I=-16:TP=-1.5:LRA=11',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      path.join(out, `${video}.mp4`),
    ],
    { stdio: 'inherit' }
  );
  console.log(`rendered ${path.join(out, `${video}.mp4`)}`);
}

main();
