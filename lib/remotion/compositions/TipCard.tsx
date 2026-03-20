/**
 * Tip Card Composition
 *
 * A short portrait (9:16) tip card for social media.
 * Features:
 * - Bold tip number with cyan accent
 * - Tip headline with fade-in animation
 * - One-line explanation below
 * - Dark background with brand colour
 *
 * Used in the educational video pipeline (SYN-429).
 */

import { AbsoluteFill, useCurrentFrame, interpolate, Sequence } from 'remotion';
import type { TipCardProps } from '../types';

// ── Tip Card Composition ──────────────────────────────────────────────────────

export function TipCard({
  tipNumber,
  tip,
  explanation,
  brandColour = '#f59e0b',
}: TipCardProps) {
  const frame = useCurrentFrame();

  // Fade in over first 20 frames
  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Tip number slides in from top
  const numberY = interpolate(frame, [0, 25], [-60, 0], {
    extrapolateRight: 'clamp',
  });

  // Headline fades in slightly after number
  const headlineOpacity = interpolate(frame, [15, 35], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Explanation fades in last
  const explanationOpacity = interpolate(frame, [30, 50], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Fade out near end (last 20 frames of 450)
  const fadeOut = interpolate(frame, [430, 450], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const globalOpacity = Math.min(opacity, fadeOut);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0F172A',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 60,
        opacity: globalOpacity,
      }}
    >
      {/* Background accent circle */}
      <div
        style={{
          position: 'absolute',
          top: -120,
          right: -120,
          width: 400,
          height: 400,
          borderRadius: '50%',
          backgroundColor: brandColour,
          opacity: 0.08,
        }}
      />

      {/* Tip number badge */}
      <Sequence from={0} durationInFrames={450}>
        <div
          style={{
            position: 'absolute',
            top: 100,
            left: 60,
            transform: `translateY(${numberY}px)`,
          }}
        >
          <div
            style={{
              backgroundColor: brandColour,
              borderRadius: 16,
              padding: '12px 24px',
              display: 'inline-block',
            }}
          >
            <span
              style={{
                color: '#FFFFFF',
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: 2,
                textTransform: 'uppercase',
              }}
            >
              Tip #{tipNumber}
            </span>
          </div>
        </div>
      </Sequence>

      {/* Main content area */}
      <div
        style={{
          textAlign: 'left',
          width: '100%',
          marginTop: 60,
        }}
      >
        {/* Tip headline */}
        <h1
          style={{
            color: '#FFFFFF',
            fontSize: 56,
            fontWeight: 800,
            lineHeight: 1.2,
            margin: 0,
            marginBottom: 32,
            opacity: headlineOpacity,
          }}
        >
          {tip}
        </h1>

        {/* Cyan divider */}
        <div
          style={{
            width: 80,
            height: 4,
            backgroundColor: brandColour,
            borderRadius: 2,
            marginBottom: 32,
            opacity: explanationOpacity,
          }}
        />

        {/* Explanation */}
        <p
          style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: 28,
            lineHeight: 1.6,
            margin: 0,
            opacity: explanationOpacity,
          }}
        >
          {explanation}
        </p>
      </div>

      {/* Synthex watermark */}
      <div
        style={{
          position: 'absolute',
          bottom: 60,
          right: 60,
        }}
      >
        <span
          style={{
            color: brandColour,
            fontSize: 20,
            fontWeight: 700,
            opacity: 0.8,
          }}
        >
          synthex.social
        </span>
      </div>

      {/* Bottom accent bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: 6,
          backgroundColor: brandColour,
        }}
      />
    </AbsoluteFill>
  );
}
