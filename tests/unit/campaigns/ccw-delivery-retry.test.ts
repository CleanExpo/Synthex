/**
 * CCW delivery copy: the first rate aims above the size cap; a copy that
 * comes out at or over the cap is retried once at 0.97. The retry is judged
 * on the same bar (SYN-1404, orchestrator 08/11/2026).
 */
import {
  CCW_DELIVERY,
  CCW_DELIVERY_AIMS,
  runDeliveryAttempts,
} from '../../../scripts/render-ccw-shortform';

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
});
