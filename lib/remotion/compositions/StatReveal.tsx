/**
 * Stat Reveal Composition
 *
 * A landscape (16:9) statistic reveal video.
 * Features:
 * - Large animated statistic with spring entrance
 * - Context label below the stat
 * - Dark background with brand colour accents
 *
 * Used in the educational video pipeline (SYN-429).
 */

import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
} from 'remotion';
import type { StatRevealProps } from '../types';

// ── Stat Reveal Composition ───────────────────────────────────────────────────

export function StatReveal({
  stat,
  statLabel,
  context,
  brandColour = '#f59e0b',
}: StatRevealProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spring animation for the stat number entrance
  const statScale = spring({
    frame: Math.max(0, frame - 30),
    fps,
    config: { damping: 18, stiffness: 80, mass: 1 },
    durationInFrames: 40,
  });

  // Label slides up from below
  const labelY = interpolate(frame, [50, 75], [40, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const labelOpacity = interpolate(frame, [50, 75], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Context fades in later
  const contextOpacity = interpolate(frame, [90, 120], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Title card fade-in
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Fade out near end
  const fadeOut = interpolate(frame, [570, 600], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0F172A' }}>
      {/* Intro title card */}
      <Sequence from={0} durationInFrames={30}>
        <AbsoluteFill
          style={{
            backgroundColor: brandColour,
            justifyContent: 'center',
            alignItems: 'center',
            opacity: titleOpacity,
          }}
        >
          <span
            style={{
              color: '#FFFFFF',
              fontSize: 36,
              fontWeight: 700,
              letterSpacing: 4,
              textTransform: 'uppercase',
            }}
          >
            Did You Know?
          </span>
        </AbsoluteFill>
      </Sequence>

      {/* Main stat reveal */}
      <Sequence from={30} durationInFrames={570}>
        <AbsoluteFill
          style={{
            backgroundColor: '#0F172A',
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column',
            gap: 24,
            opacity: fadeOut,
          }}
        >
          {/* Background grid pattern */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `radial-gradient(circle at 50% 50%, ${brandColour}18 0%, transparent 60%)`,
            }}
          />

          {/* Large stat */}
          <div
            style={{
              transform: `scale(${statScale})`,
              textAlign: 'center',
            }}
          >
            <span
              style={{
                color: brandColour,
                fontSize: 180,
                fontWeight: 900,
                lineHeight: 1,
                display: 'block',
              }}
            >
              {stat}
            </span>
          </div>

          {/* Stat label */}
          <div
            style={{
              transform: `translateY(${labelY}px)`,
              opacity: labelOpacity,
              textAlign: 'center',
            }}
          >
            <span
              style={{
                color: '#FFFFFF',
                fontSize: 42,
                fontWeight: 700,
              }}
            >
              {statLabel}
            </span>
          </div>

          {/* Divider */}
          <div
            style={{
              width: 120,
              height: 3,
              backgroundColor: brandColour,
              borderRadius: 2,
              opacity: contextOpacity,
            }}
          />

          {/* Context */}
          <div
            style={{
              opacity: contextOpacity,
              maxWidth: 900,
              textAlign: 'center',
            }}
          >
            <p
              style={{
                color: 'rgba(255,255,255,0.6)',
                fontSize: 24,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              {context}
            </p>
          </div>

          {/* Synthex watermark */}
          <div
            style={{
              position: 'absolute',
              bottom: 40,
              right: 60,
            }}
          >
            <span
              style={{
                color: brandColour,
                fontSize: 18,
                fontWeight: 700,
                opacity: 0.7,
              }}
            >
              synthex.social
            </span>
          </div>

          {/* Bottom accent */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '100%',
              height: 4,
              backgroundColor: brandColour,
            }}
          />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
}
