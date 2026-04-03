import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { BRAND } from '../lib/colors';

interface DecisionCardProps {
  content: string;
}

/**
 * Full-screen "THE DECISION" card with dramatic reveal animation.
 * Used for `decision` scene type before the decision body.
 */
export const DecisionCard: React.FC<DecisionCardProps> = ({ content }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scaleIn = spring({ frame, fps, config: { damping: 12, mass: 0.8 } });
  const textOpacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const lineWidth = spring({
    frame: frame - 15,
    fps,
    config: { damping: 15 },
  });

  const glowIntensity = interpolate(
    Math.sin(frame * 0.1),
    [-1, 1],
    [0.4, 1],
  );

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
      {/* Red glow */}
      <div
        style={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${BRAND.decision}${Math.round(glowIntensity * 25).toString(16).padStart(2, '0')} 0%, transparent 60%)`,
        }}
      />

      {/* THE DECISION text */}
      <div
        style={{
          transform: `scale(${interpolate(scaleIn, [0, 1], [0.5, 1])})`,
          opacity: interpolate(scaleIn, [0, 1], [0, 1]),
          fontSize: 72,
          fontWeight: 900,
          color: BRAND.decision,
          letterSpacing: 8,
          textTransform: 'uppercase',
          textShadow: `0 0 40px ${BRAND.decision}60`,
        }}
      >
        The Decision
      </div>

      {/* Divider */}
      <div
        style={{
          width: interpolate(lineWidth, [0, 1], [0, 200]),
          height: 3,
          backgroundColor: BRAND.decision,
          marginTop: 30,
          marginBottom: 30,
          borderRadius: 2,
          boxShadow: `0 0 20px ${BRAND.decision}80`,
        }}
      />

      {/* Decision summary text */}
      <div
        style={{
          opacity: textOpacity,
          fontSize: 24,
          fontWeight: 400,
          color: BRAND.textMuted,
          textAlign: 'center',
          maxWidth: 700,
          lineHeight: 1.6,
        }}
      >
        {content}
      </div>
    </AbsoluteFill>
  );
};
