/**
 * The pre-send delivery check. The first case is the CCW week-1 file as Toby
 * received it (09/11/2026): sound present and levelled, but 96 kHz, which
 * Windows plays as silence. Every other case is one way a client could get a
 * video that does not play properly.
 */
import {
  type DeliveryMeasures,
  SHORT_FORM_DELIVERY,
  evaluateDelivery,
  moovBeforeMdat,
  speechMatchRatio,
  speechStream,
} from '@/lib/video/delivery-readiness';
import { ccwVoiceover } from '../../../scripts/check-video-delivery';

const good: DeliveryMeasures = {
  file: 'ok.mp4',
  bytes: 7_000_000,
  sha256: 'x',
  formatNames: 'mov,mp4,m4a,3gp,3g2,mj2',
  faststart: true,
  videoStreams: [
    {
      codec: 'h264',
      pixFmt: 'yuv420p',
      width: 1080,
      height: 1920,
      duration: 26.4,
    },
  ],
  audioStreams: [
    {
      codec: 'aac',
      profile: 'LC',
      sampleRate: 48000,
      channels: 2,
      duration: 26.4,
    },
  ],
  integratedLufs: -16.1,
  maxVolumeDb: -1.4,
  meanVolumeDb: -20.4,
  longestSilenceSeconds: 1.1,
};

const check = (patch: Partial<DeliveryMeasures>) =>
  evaluateDelivery({ ...good, ...patch }, SHORT_FORM_DELIVERY);
const audio = (patch: Partial<DeliveryMeasures['audioStreams'][0]>) =>
  check({ audioStreams: [{ ...good.audioStreams[0], ...patch }] });

describe('delivery readiness', () => {
  it('passes a correct short-form file', () => {
    expect(check({})).toMatchObject({ ready: true, failures: [] });
  });

  it('refuses 96 kHz sound, which Windows plays as silence (the file Toby got)', () => {
    const r = audio({ sampleRate: 96000 });
    expect(r.ready).toBe(false);
    expect(r.failures.join()).toMatch(/96000 Hz/);
  });

  it('accepts 44.1 kHz as well as 48 kHz', () => {
    expect(audio({ sampleRate: 44100 }).ready).toBe(true);
  });

  it('refuses a video with no sound track', () => {
    expect(
      check({ audioStreams: [], integratedLufs: null, meanVolumeDb: null })
        .failures
    ).toContain('0 audio streams, expected 1');
  });

  it('refuses a silent sound track', () => {
    expect(
      check({ meanVolumeDb: -91, integratedLufs: -70 }).failures.join()
    ).toMatch(/silent/);
  });

  it('refuses sound that stops before the picture does', () => {
    expect(audio({ duration: 20 }).failures.join()).toMatch(
      /sound ends at 20.00 s/
    );
  });

  it('refuses a long gap of silence', () => {
    expect(check({ longestSilenceSeconds: 6 }).failures.join()).toMatch(
      /6.0 s of silence/
    );
  });

  it('refuses sound off the loudness target', () => {
    expect(check({ integratedLufs: -23 }).ready).toBe(false);
  });

  it('refuses mono, non-AAC and HE-AAC sound', () => {
    expect(audio({ channels: 1 }).ready).toBe(false);
    expect(audio({ codec: 'opus' }).ready).toBe(false);
    expect(audio({ profile: 'HE-AAC' }).ready).toBe(false);
  });

  it('refuses full-range colour, the wrong frame size and a non-h264 picture', () => {
    const v = good.videoStreams[0];
    expect(check({ videoStreams: [{ ...v, pixFmt: 'yuvj420p' }] }).ready).toBe(
      false
    );
    expect(
      check({ videoStreams: [{ ...v, width: 720, height: 1280 }] }).ready
    ).toBe(false);
    expect(check({ videoStreams: [{ ...v, codec: 'hevc' }] }).ready).toBe(
      false
    );
  });

  it('refuses a file that cannot start playing before it has downloaded', () => {
    expect(check({ faststart: false }).ready).toBe(false);
  });

  it('refuses a file over the size cap', () => {
    expect(
      evaluateDelivery(good, { ...SHORT_FORM_DELIVERY, maxBytes: 7_000_000 })
        .ready
    ).toBe(false);
  });

  it('refuses unmeasured loudness or silence rather than passing it', () => {
    expect(check({ integratedLufs: null }).ready).toBe(false);
    expect(check({ longestSilenceSeconds: null }).ready).toBe(false);
  });
});

describe('moovBeforeMdat', () => {
  const box = (type: string, size = 16) => {
    const b = Buffer.alloc(size);
    b.writeUInt32BE(size, 0);
    b.write(type, 4, 'latin1');
    return b;
  };

  it('is true when moov comes first', () => {
    expect(
      moovBeforeMdat(Buffer.concat([box('ftyp'), box('moov'), box('mdat')]))
    ).toBe(true);
  });

  it('is false when mdat comes first', () => {
    expect(
      moovBeforeMdat(Buffer.concat([box('ftyp'), box('mdat'), box('moov')]))
    ).toBe(false);
  });
});

describe('spoken words', () => {
  const spec = { ...SHORT_FORM_DELIVERY, minSpeechMatch: 0.9 };

  it('fails a client send whose spoken words were not checked', () => {
    const r = evaluateDelivery({ ...good, speechMatch: null }, spec);
    expect(r.failures).toContain(
      'spoken words were not checked against the script'
    );
  });

  it('fails a transcript below the match bar and passes one above it', () => {
    expect(evaluateDelivery({ ...good, speechMatch: 0.6 }, spec).ready).toBe(
      false
    );
    expect(evaluateDelivery({ ...good, speechMatch: 0.95 }, spec).ready).toBe(
      true
    );
  });

  // Real whisper transcripts of two correct CCW voiceovers (09/11/2026) that
  // word-by-word matching failed at 84% and 89.7%.
  const d5pmScript =
    'Keep the inlet grille clear. Check the filter at every equipment swap. Call CCW on one eight hundred, six eight six, eight six nine.';
  const d5pmHeard =
    'Keep the inlet grill clear. Check the filter at every equipment swap. Call CCW on 1-800-686-869.';
  const d2pmScript =
    'The XPOWER PL-700A stands twenty-one centimetres high. It fits under toe-kicks, beds and furniture. The Dri-Eaz Velo is half the height of a snail-shell dryer.';
  const d2pmHeard =
    'The X Power PL700A stands 21 centimeters high. It fits under toe kicks, beds, and furniture. The dry ease Velo is half the height of a snail shell dryer.';

  it('matches a correct voiceover despite digits, hyphens and US spelling', () => {
    expect(speechMatchRatio(d5pmHeard, d5pmScript)).toBe(1);
    expect(speechMatchRatio(d2pmHeard, d2pmScript)).toBeGreaterThanOrEqual(
      0.95
    );
  });

  it('turns spoken numbers into digits the way a transcript writes them', () => {
    expect(speechStream('one eight hundred, six eight six')).toBe('1800686');
    expect(speechStream('twenty-one centimetres')).toBe('21centimetres');
    expect(speechStream('99%')).toBe('99percent');
  });

  it('fails the wrong voiceover and a voiceover that stops early', () => {
    expect(speechMatchRatio(d2pmHeard, d5pmScript)).toBeLessThan(0.6);
    expect(
      speechMatchRatio('Keep the inlet grill clear.', d5pmScript)
    ).toBeLessThan(0.9);
    expect(speechMatchRatio('', d5pmScript)).toBe(0);
  });

  it('reads the CCW voiceover lines, without their timing notes', () => {
    const md =
      '# x\n## Voiceover\n1. (0-3 s) Cyclone season is open.\n2. (3-6 s) Check your kit.\n## Shot list\n1. ignored';
    expect(ccwVoiceover(md)).toBe('Cyclone season is open. Check your kit.');
  });
});
