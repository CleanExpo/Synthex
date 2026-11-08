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
 *   3. renders 1080x1920 at 30 fps, then levels the mix to -16 LUFS,
 *   4. renders a text mask (text boxes white on black) and fails if any
 *      text crosses the Reels safe zone (safeZoneCheck below).
 *   --check-only re-runs step 4 on the current layout without step 3.
 * Output: <dir>/out/<video>.mp4. Local preview only; nothing is published.
 */

import { execFileSync, spawnSync } from 'node:child_process';
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

/**
 * Meta's Reels safe zone on 1080x1920 (SYN-1404 review, 08/11/2026): keep
 * text out of the top 14 %, the bottom 35 %, 6 % each side, and the
 * right-hand button column. Regions are x, y, width, height at full size.
 */
export const CCW_UNSAFE_REGIONS = [
  { name: 'top 14%', x: 0, y: 0, w: 1080, h: 269 },
  { name: 'bottom 35%', x: 0, y: 1248, w: 1080, h: 672 },
  { name: 'left 6%', x: 0, y: 0, w: 65, h: 1920 },
  { name: 'right 6%', x: 1015, y: 0, w: 65, h: 1920 },
  { name: 'button column', x: 853, y: 1152, w: 227, h: 96 },
];

/** Render the text mask and scan it 10 times a second; throws on a breach. */
function safeZoneCheck(
  root: string,
  work: string,
  video: string,
  props: object,
  pub: string
) {
  const maskProps = path.join(work, `${video}-mask-props.json`);
  fs.writeFileSync(maskProps, JSON.stringify({ ...props, textMask: true }));
  const mask = path.join(work, 'out', `${video}-textmask.mp4`);
  execFileSync(
    'npx',
    [
      'remotion',
      'render',
      'lib/remotion/ccw/index.tsx',
      'CcwShortform',
      mask,
      `--props=${maskProps}`,
      `--public-dir=${pub}`,
      '--codec=h264',
      '--muted',
      '--scale=0.5',
      '--log=error',
    ],
    { cwd: root, stdio: 'inherit' }
  );
  const breaches: string[] = [];
  for (const r of CCW_UNSAFE_REGIONS) {
    const crop = `crop=${r.w / 2}:${r.h / 2}:${r.x / 2}:${r.y / 2}`;
    const res = spawnSync(
      'ffmpeg',
      [
        '-i',
        mask,
        '-vf',
        `fps=10,${crop},signalstats,metadata=print:key=lavfi.signalstats.YMAX`,
        '-f',
        'null',
        '-',
      ],
      { encoding: 'utf8' }
    );
    let at = 0;
    const hits: number[] = [];
    for (const line of res.stderr.split('\n')) {
      const tm = /pts_time:([\d.]+)/.exec(line);
      if (tm) at = Number(tm[1]);
      const ym = /YMAX=(\d+)/.exec(line);
      // Text boxes are white (235 in video range); 120 allows for fades.
      if (ym && Number(ym[1]) > 120) hits.push(at);
    }
    if (hits.length) {
      breaches.push(
        `${r.name}: text at ${hits.length} sampled frames, first ${hits[0].toFixed(1)} s, last ${hits[hits.length - 1].toFixed(1)} s`
      );
    }
  }
  fs.writeFileSync(
    path.join(work, `${video}-safezone.json`),
    JSON.stringify({ ok: breaches.length === 0, breaches, mask }, null, 2)
  );
  if (breaches.length) {
    throw new Error(
      `SAFE ZONE FAIL for ${video}:\n  ${breaches.join('\n  ')}\n  mask: ${mask}`
    );
  }
  console.log(`safe zone PASS for ${video} (mask ${mask})`);
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
  if (process.argv.includes('--check-only')) {
    safeZoneCheck(root, work, video, props, pub);
    return;
  }
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
  safeZoneCheck(root, work, video, props, pub);
}

main();
