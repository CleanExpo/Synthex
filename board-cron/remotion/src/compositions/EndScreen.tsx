import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { BRAND } from '../lib/colors';

interface EndScreenProps {
  sessionNumber: number;
  title: string;
}

export const EndScreen: React.FC<EndScreenProps> = ({
  sessionNumber,
  title,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 15 } });
  const textOpacity = interpolate(frame, [30, 50], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const ctaOpacity = interpolate(frame, [60, 80], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.bg,
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Amber glow */}
      <div
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${BRAND.accent}15 0%, transparent 60%)`,
        }}
      />

      {/* Synthex logo text */}
      <div
        style={{
          transform: `scale(${interpolate(logoScale, [0, 1], [0.6, 1])})`,
          opacity: interpolate(logoScale, [0, 1], [0, 1]),
          fontSize: 56,
          fontWeight: 900,
          color: BRAND.accent,
          letterSpacing: 6,
          textTransform: 'uppercase',
          marginBottom: 20,
        }}
      >
        Synthex
      </div>

      {/* Session info */}
      <div
        style={{
          opacity: textOpacity,
          fontSize: 20,
          fontWeight: 500,
          color: BRAND.textMuted,
          textAlign: 'center',
          maxWidth: 600,
          lineHeight: 1.5,
        }}
      >
        Session {sessionNumber} — {title}
      </div>

      {/* CTA */}
      <div
        style={{
          opacity: ctaOpacity,
          marginTop: 50,
          padding: '14px 40px',
          borderRadius: 12,
          border: `2px solid ${BRAND.accent}`,
          fontSize: 18,
          fontWeight: 600,
          color: BRAND.accent,
          letterSpacing: 2,
          textTransform: 'uppercase',
        }}
      >
        synthex.social
      </div>

      {/* Subscribe hint */}
      <div
        style={{
          opacity: ctaOpacity,
          position: 'absolute',
          bottom: 50,
          fontSize: 16,
          color: BRAND.textSubtle,
        }}
      >
        Subscribe for the next session
      </div>
    </AbsoluteFill>
  );
};
