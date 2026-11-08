/**
 * Delivery readiness: the one check every finished video must pass before it
 * goes to a client, on the exact file that will be sent.
 *
 * Why this exists (09/11/2026): six of ten CCW week-1 videos reached Toby with
 * 96 kHz AAC sound. The track was there and measured -16 LUFS, so every check
 * we had passed ("audio present"), yet Windows plays it silent: the Windows
 * AAC decoder takes 48 kHz at most ("Sampling rates above 48 kHz are not
 * supported", learn.microsoft.com/en-us/windows/win32/medfound/aac-decoder).
 * The video gate checked size and duration only. A check that the sound is
 * present is not a check that the client will hear it, so this one checks the
 * format every common player decodes, that the sound runs the whole length,
 * that it is audible, and that it is levelled.
 *
 * evaluateDelivery is pure (tested without ffmpeg); measureDelivery runs
 * ffprobe and ffmpeg on the file. assertDeliveryReady does both and throws.
 */

import { execFileSync, spawnSync } from 'child_process';
import { createHash } from 'crypto';
import fs from 'fs';

export interface DeliverySpec {
  /** Expected frame size, e.g. 1080x1920 for vertical short-form. */
  width?: number;
  height?: number;
  /** Integrated loudness target and tolerance. */
  targetLufs: number;
  maxOffLu: number;
  /** Highest sample peak allowed, dBFS. */
  maxPeakDb: number;
  /** Longest stretch below -50 dB allowed anywhere, seconds. */
  maxSilenceSeconds: number;
  maxBytes?: number;
  /**
   * Share of the script's words the transcript of the file must match
   * (0..1). Set for every client send; a check that was not run fails.
   */
  minSpeechMatch?: number;
}

/** Short-form social video: vertical HD, -16 LUFS, no dead air over 3 s. */
export const SHORT_FORM_DELIVERY: DeliverySpec = {
  width: 1080,
  height: 1920,
  targetLufs: -16,
  maxOffLu: 1,
  maxPeakDb: -0.5,
  maxSilenceSeconds: 3,
};

/** Sample rates every common player decodes (Windows, iOS, Android, browsers). */
export const PLAYABLE_SAMPLE_RATES = [44100, 48000] as const;

export interface DeliveryMeasures {
  file: string;
  bytes: number;
  sha256: string;
  formatNames: string; // ffprobe format_name, e.g. "mov,mp4,m4a,3gp,3g2,mj2"
  faststart: boolean; // moov box before mdat, so playback starts before download ends
  videoStreams: Array<{
    codec: string;
    pixFmt: string;
    width: number;
    height: number;
    duration: number;
  }>;
  audioStreams: Array<{
    codec: string;
    profile: string;
    sampleRate: number;
    channels: number;
    duration: number;
  }>;
  /** Null when there is no audio to measure. */
  integratedLufs: number | null;
  maxVolumeDb: number | null;
  meanVolumeDb: number | null;
  longestSilenceSeconds: number | null;
  /** Transcript-to-script match (0..1); null when not measured. */
  speechMatch?: number | null;
}

export interface DeliveryResult {
  ready: boolean;
  failures: string[];
  measures: DeliveryMeasures;
}

export function evaluateDelivery(
  m: DeliveryMeasures,
  spec: DeliverySpec
): DeliveryResult {
  const f: string[] = [];

  if (!m.formatNames.split(',').includes('mp4'))
    f.push(`container is ${m.formatNames}, not mp4`);
  if (!m.faststart) f.push('moov box is after the media data (not faststart)');
  if (spec.maxBytes !== undefined && m.bytes >= spec.maxBytes)
    f.push(`${m.bytes} bytes is over the ${spec.maxBytes} cap`);

  if (m.videoStreams.length !== 1) {
    f.push(`${m.videoStreams.length} video streams, expected 1`);
  }
  const v = m.videoStreams[0];
  if (v) {
    if (v.codec !== 'h264') f.push(`video codec ${v.codec}, expected h264`);
    if (v.pixFmt !== 'yuv420p')
      f.push(`pixel format ${v.pixFmt}, expected yuv420p`);
    if (
      (spec.width !== undefined && v.width !== spec.width) ||
      (spec.height !== undefined && v.height !== spec.height)
    )
      f.push(
        `frame ${v.width}x${v.height}, expected ${spec.width}x${spec.height}`
      );
  }

  if (m.audioStreams.length !== 1) {
    f.push(`${m.audioStreams.length} audio streams, expected 1`);
  }
  const a = m.audioStreams[0];
  if (a) {
    if (a.codec !== 'aac' || a.profile !== 'LC')
      f.push(`audio ${a.codec} ${a.profile}, expected aac LC`);
    if (!(PLAYABLE_SAMPLE_RATES as readonly number[]).includes(a.sampleRate))
      f.push(
        `audio sample rate ${a.sampleRate} Hz; Windows and many players play only 44100 or 48000 Hz, so the client hears nothing`
      );
    if (a.channels !== 2) f.push(`${a.channels} audio channels, expected 2`);
    if (v && a.duration < v.duration - 0.25)
      f.push(
        `sound ends at ${a.duration.toFixed(2)} s, picture runs to ${v.duration.toFixed(2)} s`
      );
  }

  if (a) {
    if (m.integratedLufs === null || !Number.isFinite(m.integratedLufs)) {
      f.push('loudness could not be measured');
    } else if (
      Math.abs(m.integratedLufs - spec.targetLufs) >
      spec.maxOffLu + 1e-9
    ) {
      f.push(
        `loudness ${m.integratedLufs} LUFS, target ${spec.targetLufs} +/- ${spec.maxOffLu}`
      );
    }
    if (m.meanVolumeDb === null || m.meanVolumeDb <= -60)
      f.push(`sound is silent (mean ${m.meanVolumeDb ?? 'unmeasured'} dB)`);
    if (m.maxVolumeDb === null) f.push('peak level could not be measured');
    else if (m.maxVolumeDb > spec.maxPeakDb)
      f.push(`peak ${m.maxVolumeDb} dB above ${spec.maxPeakDb} dB`);
    if (m.longestSilenceSeconds === null)
      f.push('silence could not be measured');
    else if (m.longestSilenceSeconds > spec.maxSilenceSeconds)
      f.push(
        `${m.longestSilenceSeconds.toFixed(1)} s of silence (most allowed ${spec.maxSilenceSeconds} s)`
      );
  }

  if (spec.minSpeechMatch !== undefined) {
    if (m.speechMatch === null || m.speechMatch === undefined)
      f.push('spoken words were not checked against the script');
    else if (m.speechMatch < spec.minSpeechMatch)
      f.push(
        `spoken words match the script at ${Math.round(m.speechMatch * 100)}%, need ${Math.round(spec.minSpeechMatch * 100)}%`
      );
  }

  return { ready: f.length === 0, failures: f, measures: m };
}

/** True when the first top-level moov box comes before the first mdat box. */
export function moovBeforeMdat(buf: Buffer): boolean {
  let off = 0;
  while (off + 8 <= buf.length) {
    let size = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    if (type === 'moov') return true;
    if (type === 'mdat') return false;
    if (size === 1) {
      if (off + 16 > buf.length) return false;
      size = Number(buf.readBigUInt64BE(off + 8));
    }
    if (size < 8) return false;
    off += size;
  }
  return false;
}

function readHead(file: string): Buffer {
  // Boxes before moov in a faststart file are small (ftyp, free).
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(Math.min(fs.statSync(file).size, 1 << 20));
    fs.readSync(fd, buf, 0, buf.length, 0);
    return buf;
  } finally {
    fs.closeSync(fd);
  }
}

export function measureDelivery(file: string): DeliveryMeasures {
  const probe = JSON.parse(
    execFileSync(
      'ffprobe',
      ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file],
      { encoding: 'utf8' }
    )
  ) as {
    streams: Array<Record<string, string | number | undefined>>;
    format: { format_name: string; duration?: string };
  };
  const fmtDur = Number(probe.format.duration ?? NaN);
  const dur = (s: Record<string, string | number | undefined>) =>
    Number(s.duration ?? fmtDur);

  const videoStreams = probe.streams
    .filter(s => s.codec_type === 'video')
    .map(s => ({
      codec: String(s.codec_name),
      pixFmt: String(s.pix_fmt),
      width: Number(s.width),
      height: Number(s.height),
      duration: dur(s),
    }));
  const audioStreams = probe.streams
    .filter(s => s.codec_type === 'audio')
    .map(s => ({
      codec: String(s.codec_name),
      profile: String(s.profile),
      sampleRate: Number(s.sample_rate),
      channels: Number(s.channels),
      duration: dur(s),
    }));

  let integratedLufs: number | null = null;
  let maxVolumeDb: number | null = null;
  let meanVolumeDb: number | null = null;
  let longestSilenceSeconds: number | null = null;
  if (audioStreams.length > 0) {
    const r = spawnSync(
      'ffmpeg',
      [
        '-hide_banner',
        '-nostats',
        '-i',
        file,
        '-map',
        '0:a:0',
        '-af',
        'ebur128=framelog=quiet,volumedetect,silencedetect=noise=-50dB:d=0.5',
        '-f',
        'null',
        '-',
      ],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
    );
    const err = r.stderr ?? '';
    const lufs = [...err.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop();
    integratedLufs = lufs ? Number(lufs[1]) : null;
    const mx = /max_volume: (-?[\d.]+) dB/.exec(err);
    const mean = /mean_volume: (-?[\d.]+) dB/.exec(err);
    maxVolumeDb = mx ? Number(mx[1]) : null;
    meanVolumeDb = mean ? Number(mean[1]) : null;
    // A silence still open at the end has a start and no end: it runs to the end.
    const audioEnd = audioStreams[0].duration;
    let longest = 0;
    let open: number | null = null;
    for (const line of err.split('\n')) {
      const s = /silence_start: (-?[\d.]+)/.exec(line);
      const e = /silence_end: (-?[\d.]+) \| silence_duration: ([\d.]+)/.exec(
        line
      );
      if (s) open = Number(s[1]);
      if (e) {
        longest = Math.max(longest, Number(e[2]));
        open = null;
      }
    }
    if (open !== null && Number.isFinite(audioEnd))
      longest = Math.max(longest, audioEnd - Math.max(open, 0));
    longestSilenceSeconds = r.status === 0 ? longest : null;
  }

  const buf = fs.readFileSync(file);
  return {
    file,
    bytes: buf.length,
    sha256: createHash('sha256').update(buf).digest('hex'),
    formatNames: probe.format.format_name,
    faststart: moovBeforeMdat(readHead(file)),
    videoStreams,
    audioStreams,
    integratedLufs,
    maxVolumeDb,
    meanVolumeDb,
    longestSilenceSeconds,
  };
}

const UNITS: Record<string, number> = {
  zero: 0,
  oh: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};
/** Transcripts spell the same words differently from our scripts. */
const SAME_WORD: Record<string, string> = { grill: 'grille', color: 'colour' };

/**
 * What the voiceover says, as one comparable string. A transcript writes
 * "X Power", "21", "centimeters", "1-800-686-869" where the script has
 * "XPOWER", "twenty-one", "centimetres", "one eight hundred, six eight six...".
 * So: lower case, number words to digits, US -ter to AU -tre, then every
 * separator dropped (09/11/2026: word-by-word matching failed two correct
 * CCW voiceovers at 84% and 89.7% on exactly these differences).
 */
export function speechStream(text: string): string {
  const words =
    text
      .toLowerCase()
      .replace(/%/g, ' percent ')
      .match(/[a-z]+|\d+/g) ?? [];
  const out: string[] = [];
  for (let i = 0; i < words.length; ) {
    const w = words[i];
    if (w in UNITS || w in TENS) {
      let n = UNITS[w] ?? TENS[w];
      i += 1;
      if (w in TENS && words[i] in UNITS && UNITS[words[i]] < 10)
        n += UNITS[words[i++]];
      if (words[i] === 'hundred') {
        n *= 100;
        i += 1;
      }
      out.push(String(n));
      continue;
    }
    const au = w.replace(/ter$/, 'tre');
    out.push(SAME_WORD[au] ?? au);
    i += 1;
  }
  return out.join('');
}

/**
 * 2 x longest common subsequence / total length, over speechStream text.
 * Measured on the ten CCW week-1 files: each against its own script 0.98 or
 * more; against any other script 0.47 at most; a voiceover missing its last
 * two sentences 0.88.
 */
export function speechMatchRatio(heard: string, script: string): number {
  const a = speechStream(heard);
  const b = speechStream(script);
  if (a.length + b.length === 0) return 1;
  let prev = new Uint16Array(b.length + 1);
  for (let i = 0; i < a.length; i++) {
    const cur = new Uint16Array(b.length + 1);
    for (let j = 1; j <= b.length; j++)
      cur[j] =
        a[i] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    prev = cur;
  }
  return (2 * prev[b.length]) / (a.length + b.length);
}

/**
 * Transcribe the file's sound with whisper.cpp (whisper-cli) and compare it
 * with the script. Returns null when it cannot run, so the caller fails closed.
 */
export function measureSpeechMatch(
  file: string,
  script: string,
  model: string
): number | null {
  if (!fs.existsSync(model)) return null;
  const wav = `${file}.speech-check.wav`;
  try {
    const conv = spawnSync('ffmpeg', [
      '-loglevel',
      'error',
      '-y',
      '-i',
      file,
      '-ar',
      '16000',
      '-ac',
      '1',
      wav,
    ]);
    if (conv.status !== 0) return null;
    const r = spawnSync(
      'whisper-cli',
      ['-m', model, '-f', wav, '-nt', '-l', 'en'],
      { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
    );
    if (r.status !== 0) return null;
    return speechMatchRatio(r.stdout, script);
  } finally {
    fs.rmSync(wav, { force: true });
  }
}

export class DeliveryNotReadyError extends Error {
  constructor(
    readonly file: string,
    readonly failures: string[]
  ) {
    super(`${file} is not ready to send: ${failures.join('; ')}`);
    this.name = 'DeliveryNotReadyError';
  }
}

/** Measure the exact file that will be sent and throw unless it is ready. */
export function assertDeliveryReady(
  file: string,
  spec: DeliverySpec
): DeliveryResult {
  const result = evaluateDelivery(measureDelivery(file), spec);
  if (!result.ready) throw new DeliveryNotReadyError(file, result.failures);
  return result;
}
