/**
 * Quote Card Composition
 *
 * A square (1:1) quote display video.
 * Features:
 * - Large centred quote text with opening/closing marks
 * - Attribution below
 * - Minimal, elegant design with brand colour accents
 *
 * Used in the educational video pipeline (SYN-429).
 */

import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import type { QuoteCardProps } from '../types';

// ── Quote Card Composition ────────────────────────────────────────────────────

export function QuoteCard({
  quote,
  attribution,
  brandColour = '#f59e0b',
}: QuoteCardProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Opening quote mark appears first
  const quoteMarkScale = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 80 },
    durationInFrames: 25,
  });

  // Quote text fades in
  const quoteOpacity = interpolate(frame, [20, 50], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const quoteY = interpolate(frame, [20, 50], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Attribution slides up from bottom
  const attributionOpacity = interpolate(frame, [70, 100], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const attributionY = interpolate(frame, [70, 100], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Divider line grows from left
  const dividerWidth = interpolate(frame, [60, 90], [0, 80], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Fade out near end
  const fadeOut = interpolate(frame, [570, 600], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0F172A',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 80,
        flexDirection: 'column',
        opacity: fadeOut,
      }}
    >
      {/* Subtle radial glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(circle at 50% 40%, ${brandColour}15 0%, transparent 65%)`,
        }}
      />

      {/* Opening quote mark */}
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 80,
          transform: `scale(${quoteMarkScale})`,
          transformOrigin: 'top left',
        }}
      >
        <span
          style={{
            color: brandColour,
            fontSize: 120,
            fontWeight: 900,
            lineHeight: 1,
            opacity: 0.4,
          }}
        >
          &ldquo;
        </span>
      </div>

      {/* Quote text */}
      <div
        style={{
          textAlign: 'center',
          transform: `translateY(${quoteY}px)`,
          opacity: quoteOpacity,
          zIndex: 1,
          maxWidth: '100%',
        }}
      >
        <p
          style={{
            color: '#FFFFFF',
            fontSize: 38,
            fontWeight: 600,
            lineHeight: 1.5,
            margin: 0,
            fontStyle: 'italic',
          }}
        >
          {quote}
        </p>
      </div>

      {/* Divider */}
      <div
        style={{
          width: dividerWidth,
          height: 3,
          backgroundColor: brandColour,
          borderRadius: 2,
          marginTop: 36,
          marginBottom: 24,
          zIndex: 1,
        }}
      />

      {/* Attribution */}
      {attribution && (
        <div
          style={{
            transform: `translateY(${attributionY}px)`,
            opacity: attributionOpacity,
            zIndex: 1,
            textAlign: 'center',
          }}
        >
          <span
            style={{
              color: brandColour,
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            — {attribution}
          </span>
        </div>
      )}

      {/* Synthex watermark */}
      <div
        style={{
          position: 'absolute',
          bottom: 48,
          right: 60,
        }}
      >
        <span
          style={{
            color: 'rgba(255,255,255,0.4)',
            fontSize: 18,
            fontWeight: 600,
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
          height: 5,
          backgroundColor: brandColour,
        }}
      />
    </AbsoluteFill>
  );
}
