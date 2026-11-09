/**
 * CCW delivery copy: the first rate aims above the size cap; a copy that
 * comes out at or over the cap is retried once at 0.97. The retry is judged
 * on the same bar (SYN-1404, orchestrator 08/11/2026).
 */
import {
  CCW_DELIVERY,
  CCW_DELIVERY_AIMS,
  deliveryVideoKbps,
  masterLoudnessOk,
  refuseLockedRender,
  runDeliveryAttempts,
  safeZoneHits,
} from '../../../scripts/render-ccw-shortform';
import { ccwVideoSlots } from '../../../lib/marketing-agency/ccw-video-campaign-2026-11';

const CAP = CCW_DELIVERY.maxBytes;

function fake(results: Record<number, { bytes: number; ssim: number }>) {
  const calls: number[] = [];
  const encode = (aim: number) => {
    calls.push(aim);
    const r = results[aim];
    return {
      ...r,
      ok: r.bytes < CAP && r.ssim >= CCW_DELIVERY.minSsim,
    };
  };
  return { encode, calls };
}

describe('CCW delivery attempts', () => {
  it('keeps the cap at 7,300,000 bytes and the SSIM bar at 0.99', () => {
    expect(CAP).toBe(7_300_000);
    expect(CCW_DELIVERY.minSsim).toBe(0.99);
    expect(CCW_DELIVERY_AIMS).toEqual([1.01, 0.97]);
  });

  it('stops at the first aim when it passes', () => {
    const { encode, calls } = fake({ 1.01: { bytes: 7_200_000, ssim: 0.991 } });
    const { report, attempts } = runDeliveryAttempts(encode);
    expect(calls).toEqual([1.01]);
    expect(report.ok).toBe(true);
    expect(attempts).toHaveLength(1);
  });

  it('retries once at 0.97 when the first copy is over the cap', () => {
    const { encode, calls } = fake({
      1.01: { bytes: 7_350_000, ssim: 0.992 },
      0.97: { bytes: 7_050_000, ssim: 0.9905 },
    });
    const { report, attempts } = runDeliveryAttempts(encode);
    expect(calls).toEqual([1.01, 0.97]);
    expect(report.ok).toBe(true);
    expect(attempts.map(a => a.aim)).toEqual([1.01, 0.97]);
  });

  it('retries at exactly the cap (the size check is strict less-than)', () => {
    const { encode, calls } = fake({
      1.01: { bytes: CAP, ssim: 0.992 },
      0.97: { bytes: 7_050_000, ssim: 0.9905 },
    });
    runDeliveryAttempts(encode);
    expect(calls).toEqual([1.01, 0.97]);
  });

  it('still fails the retry when it misses SSIM: a retry, not a lower bar', () => {
    const { encode } = fake({
      1.01: { bytes: 7_350_000, ssim: 0.992 },
      0.97: { bytes: 7_050_000, ssim: 0.9895 },
    });
    const { report } = runDeliveryAttempts(encode);
    expect(report.ok).toBe(false);
  });

  it('does not retry a copy under the cap that misses SSIM', () => {
    const { encode, calls } = fake({
      1.01: { bytes: 7_200_000, ssim: 0.9895 },
      0.97: { bytes: 7_000_000, ssim: 0.9899 },
    });
    const { report } = runDeliveryAttempts(encode);
    expect(calls).toEqual([1.01]);
    expect(report.ok).toBe(false);
  });

  // ccw-w1-d4-am, 08/11/2026: a fixed 1950 kbps floor made every master over
  // about 28.1 s unable to fit the cap, and made the 0.97 retry a no-op (both
  // attempts gave 7,530,818 bytes). The cap must govern the rate.
  it.each([20, 24.2, 28.96, 30, 35])(
    'a %s s master aims inside the cap, and the retry aims lower',
    seconds => {
      const first = deliveryVideoKbps(seconds, CCW_DELIVERY_AIMS[0]);
      const retry = deliveryVideoKbps(seconds, CCW_DELIVERY_AIMS[1]);
      expect(retry).toBeLessThan(first);
      const retryBytes =
        ((retry + CCW_DELIVERY.audioKbps) * 1000 * seconds) / 8;
      expect(retryBytes).toBeLessThan(CAP);
    }
  );

  // ccw-w1-d5-pm, 08/11/2026: the master came out at -16.6 LUFS and nothing
  // stopped it, because only copy-vs-master loudness was checked.
  it.each([
    [-16, true],
    [-16.3, true],
    [-15.7, true],
    [-16.4, false],
    [-16.6, false],
    [-15.5, false],
  ])('a master at %s LUFS passes the -16 +/- 0.3 bar: %s', (lufs, ok) => {
    expect(masterLoudnessOk(lufs)).toBe(ok);
  });
});

describe('CCW safe-zone scan', () => {
  const frame = (t: number, y: number) =>
    `frame:0 pts_time:${t}\nlavfi.signalstats.YMAX=${y}`;

  it('reports the times text appears in the region', () => {
    const stderr = [frame(0, 16), frame(0.1, 235), frame(0.2, 16)].join('\n');
    expect(safeZoneHits('top', { status: 0, stderr })).toEqual([0.1]);
  });

  it('a clear region returns no hits', () => {
    expect(safeZoneHits('top', { status: 0, stderr: frame(0, 16) })).toEqual(
      []
    );
  });

  it.each([
    ['ffmpeg failed', { status: 1, stderr: frame(0, 16) }],
    ['ffmpeg never started', { status: null, stderr: null }],
    ['nothing was measured', { status: 0, stderr: 'no frames here' }],
  ])('throws rather than reading clear when %s', (_why, res) => {
    expect(() => safeZoneHits('top', res)).toThrow(/SAFE ZONE SCAN FAILED/);
  });
});

describe('locked CCW renders', () => {
  it('refuses a fresh render of a slot Phill approved', () => {
    const locked = ccwVideoSlots.find(s => s.approvedRender);
    expect(locked).toBeDefined();
    expect(() => refuseLockedRender(locked!.id, ccwVideoSlots)).toThrow(
      /is locked/
    );
  });

  it('allows a slot with no approved render', () => {
    const open = ccwVideoSlots.find(s => !s.approvedRender);
    expect(() => refuseLockedRender(open!.id, ccwVideoSlots)).not.toThrow();
  });
});
