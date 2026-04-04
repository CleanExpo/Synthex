/**
 * Countdown CTA Composition
 *
 * A landscape (16:9) call-to-action video with urgency.
 * Features:
 * - Animated headline entrance
 * - Pulsing CTA button
 * - URL displayed prominently
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
} from 'remotion';
import type { CountdownCTAProps } from '../types';

// ── Countdown CTA Composition ─────────────────────────────────────────────────

export function CountdownCTA({
  headline,
  cta,
  url,
  brandColour = '#f59e0b',
}: CountdownCTAProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Headline springs in from top
  const headlineSpring = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 80 },
    durationInFrames: 35,
  });
  const headlineY = interpolate(headlineSpring, [0, 1], [-80, 0]);

  // CTA button springs in after headline
  const ctaSpring = spring({
    frame: Math.max(0, frame - 40),
    fps,
    config: { damping: 16, stiffness: 90 },
    durationInFrames: 30,
  });
  const ctaScale = interpolate(ctaSpring, [0, 1], [0.5, 1]);

  // Pulse animation for CTA (cycles every 45 frames)
  const pulseProgress = (frame % 45) / 45;
  const pulseScale =
    1 +
    interpolate(pulseProgress, [0, 0.5, 1], [0, 0.04, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

  // URL fades in last
  const urlOpacity = interpolate(frame, [80, 110], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Fade out near end
  const fadeOut = interpolate(frame, [420, 450], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Background gradient shifts over time (subtle)
  const bgGradientAngle = interpolate(frame, [0, 450], [135, 225], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0F172A',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        gap: 40,
        opacity: fadeOut,
      }}
    >
      {/* Animated background gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(${bgGradientAngle}deg, #0F172A 0%, #0F172A 60%, ${brandColour}22 100%)`,
        }}
      />

      {/* Headline */}
      <div
        style={{
          transform: `translateY(${headlineY}px)`,
          textAlign: 'center',
          maxWidth: 1100,
          zIndex: 1,
        }}
      >
        <h1
          style={{
            color: '#FFFFFF',
            fontSize: 64,
            fontWeight: 900,
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          {headline}
        </h1>
      </div>

      {/* CTA Button */}
      <div
        style={{
          transform: `scale(${ctaScale * pulseScale})`,
          zIndex: 1,
        }}
      >
        <div
          style={{
            backgroundColor: brandColour,
            borderRadius: 16,
            padding: '20px 60px',
            boxShadow: `0 0 40px ${brandColour}60`,
          }}
        >
          <span
            style={{
              color: '#FFFFFF',
              fontSize: 36,
              fontWeight: 800,
              letterSpacing: 1,
            }}
          >
            {cta}
          </span>
        </div>
      </div>

      {/* URL */}
      {url && (
        <div
          style={{
            opacity: urlOpacity,
            zIndex: 1,
          }}
        >
          <span
            style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: 28,
              fontWeight: 500,
              letterSpacing: 1,
            }}
          >
            {url}
          </span>
        </div>
      )}

      {/* Bottom accent */}
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
