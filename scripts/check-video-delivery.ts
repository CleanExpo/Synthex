/**
 * Run before any video goes to a client: checks the exact files that will be
 * sent (lib/video/delivery-readiness.ts) and exits 1 unless every one is
 * ready. Nothing is optional: a check that cannot run is a failure.
 *
 *   npx tsx scripts/check-video-delivery.ts --files <id-to-path.json> --expect <id-to-script.json>
 *   npx tsx scripts/check-video-delivery.ts --files <id-to-path.json> --ccw-scripts
 *
 * --expect maps each id to the words the voiceover must say.
 * --ccw-scripts reads them from docs/campaigns/ccw-2026-11-video/scripts/<id>.md.
 * WHISPER_MODEL names the whisper.cpp model (default: the Mini's small.en).
 *
 * Prints one line per file with its sha256, so the copy uploaded can be
 * matched to the copy checked.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  SHORT_FORM_DELIVERY,
  evaluateDelivery,
  measureDelivery,
  measureSpeechMatch,
} from '../lib/video/delivery-readiness';

export const DEFAULT_WHISPER_MODEL =
  '/Volumes/Mini Mini 2T Storage/hot/models/whisper/ggml-small.en.bin';
export const MIN_SPEECH_MATCH = 0.9;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** The numbered voiceover lines of a CCW script, as qa-ccw-shortform.py reads them. */
export function ccwVoiceover(markdown: string): string {
  const vo = markdown.split('## Voiceover')[1]?.split('## Shot list')[0] ?? '';
  return vo
    .split('\n')
    .filter(l => /^\d+\./.test(l))
    .map(l => l.replace(/^\d+\.\s*\([^)]*\)\s*/, '').trim())
    .join(' ');
}

function main() {
  const filesArg = arg('--files');
  if (!filesArg) {
    console.error(
      'usage: check-video-delivery.ts --files <map.json> (--expect <map.json> | --ccw-scripts)'
    );
    process.exit(2);
  }
  const files = JSON.parse(fs.readFileSync(filesArg, 'utf8')) as Record<
    string,
    string
  >;
  const expectArg = arg('--expect');
  const expected: Record<string, string> = expectArg
    ? JSON.parse(fs.readFileSync(expectArg, 'utf8'))
    : {};
  if (process.argv.includes('--ccw-scripts')) {
    const dir = path.resolve('docs/campaigns/ccw-2026-11-video/scripts');
    for (const id of Object.keys(files)) {
      const md = path.join(dir, `${id}.md`);
      if (fs.existsSync(md))
        expected[id] = ccwVoiceover(fs.readFileSync(md, 'utf8'));
    }
  }
  const model = process.env.WHISPER_MODEL || DEFAULT_WHISPER_MODEL;
  const spec = { ...SHORT_FORM_DELIVERY, minSpeechMatch: MIN_SPEECH_MATCH };

  let failed = 0;
  for (const [id, file] of Object.entries(files)) {
    const measures = measureDelivery(file);
    measures.speechMatch = expected[id]
      ? measureSpeechMatch(file, expected[id], model)
      : null;
    const r = evaluateDelivery(measures, spec);
    const a = measures.audioStreams[0];
    console.log(
      `${r.ready ? 'READY    ' : 'NOT READY'} ${id}  ${file}\n` +
        `  sha256 ${measures.sha256}  ${measures.bytes} bytes  ` +
        `audio ${a ? `${a.codec} ${a.profile} ${a.sampleRate} Hz ${a.channels} ch` : 'none'}  ` +
        `${measures.integratedLufs} LUFS  longest silence ${measures.longestSilenceSeconds?.toFixed(1)} s  ` +
        `speech ${measures.speechMatch == null ? 'not checked' : `${Math.round(measures.speechMatch * 100)}%`}`
    );
    if (!expected[id]) console.log('  - no script given for this video');
    for (const f of r.failures) console.log(`  - ${f}`);
    if (!r.ready) failed += 1;
  }
  const total = Object.keys(files).length;
  console.log(`${total - failed} of ${total} ready to send`);
  process.exitCode = failed > 0 ? 1 : 0;
}

if (process.argv[1]?.endsWith('check-video-delivery.ts')) main();
