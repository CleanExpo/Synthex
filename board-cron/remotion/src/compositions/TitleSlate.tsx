import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { BRAND } from '../lib/colors';

interface TitleSlateProps {
  sessionNumber: number;
  title: string;
  topic: string;
}

export const TitleSlate: React.FC<TitleSlateProps> = ({
  sessionNumber,
  title,
  topic,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [15, 35], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const titleY = spring({ frame: frame - 15, fps, config: { damping: 20 } });

  const subtitleOpacity = interpolate(frame, [45, 65], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const lineScale = spring({ frame: frame - 30, fps, config: { damping: 15 } });

  const sessionBadgeOpacity = interpolate(frame, [5, 20], [0, 1], {
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
      {/* Ambient gradient */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          background: `radial-gradient(ellipse at 50% 40%, ${BRAND.borderGlow} 0%, transparent 60%)`,
        }}
      />

      {/* Session badge */}
      <div
        style={{
          opacity: sessionBadgeOpacity,
          fontSize: 24,
          fontWeight: 600,
          color: BRAND.accent,
          letterSpacing: 6,
          textTransform: 'uppercase',
          marginBottom: 24,
        }}
      >
        Session {sessionNumber}
      </div>

      {/* Main title */}
      <div
        style={{
          opacity: titleOpacity,
          transform: `translateY(${interpolate(titleY, [0, 1], [30, 0])}px)`,
          fontSize: 64,
          fontWeight: 800,
          color: BRAND.text,
          textAlign: 'center',
          maxWidth: 900,
          lineHeight: 1.2,
        }}
      >
        {title}
      </div>

      {/* Divider line */}
      <div
        style={{
          width: interpolate(lineScale, [0, 1], [0, 120]),
          height: 3,
          backgroundColor: BRAND.accent,
          marginTop: 32,
          marginBottom: 32,
          borderRadius: 2,
        }}
      />

      {/* Topic subtitle */}
      <div
        style={{
          opacity: subtitleOpacity,
          fontSize: 28,
          fontWeight: 400,
          color: BRAND.textMuted,
          textAlign: 'center',
          maxWidth: 700,
        }}
      >
        {topic}
      </div>

      {/* Brand mark */}
      <div
        style={{
          position: 'absolute',
          bottom: 60,
          fontSize: 18,
          fontWeight: 700,
          color: BRAND.accent,
          letterSpacing: 4,
          textTransform: 'uppercase',
        }}
      >
        Synthex Board
      </div>
    </AbsoluteFill>
  );
};
