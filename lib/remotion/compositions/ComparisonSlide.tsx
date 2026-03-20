/**
 * Comparison Slide Composition
 *
 * A landscape (16:9) side-by-side comparison video.
 * Features:
 * - Left panel (old way) slides in from the left
 * - Right panel (new way) slides in from the right
 * - Dark background with red/cyan contrast
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
import type { ComparisonSlideProps } from '../types';

// ── Panel Component ───────────────────────────────────────────────────────────

function Panel({
  label,
  content,
  accentColour,
  slideFromLeft,
  frame,
  fps,
}: {
  label: string;
  content: string;
  accentColour: string;
  slideFromLeft: boolean;
  frame: number;
  fps: number;
}) {
  const slideIn = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: { damping: 20, stiffness: 60, mass: 1 },
    durationInFrames: 45,
  });

  const translateX = interpolate(
    slideIn,
    [0, 1],
    [slideFromLeft ? -800 : 800, 0]
  );

  return (
    <div
      style={{
        flex: 1,
        backgroundColor: '#1E293B',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 60,
        transform: `translateX(${translateX}px)`,
        borderTop: `6px solid ${accentColour}`,
        margin: 8,
        borderRadius: 16,
      }}
    >
      {/* Panel label */}
      <div
        style={{
          backgroundColor: accentColour,
          borderRadius: 8,
          padding: '8px 20px',
          marginBottom: 40,
        }}
      >
        <span
          style={{
            color: '#FFFFFF',
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
      </div>

      {/* Panel content */}
      <p
        style={{
          color: '#FFFFFF',
          fontSize: 32,
          fontWeight: 600,
          textAlign: 'center',
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        {content}
      </p>
    </div>
  );
}

// ── Comparison Slide Composition ──────────────────────────────────────────────

export function ComparisonSlide({
  oldWay,
  newWay,
  oldLabel = 'The Old Way',
  newLabel = 'The New Way',
  brandColour = '#f59e0b',
}: ComparisonSlideProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title fade in
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Panels appear after title
  const panelsOpacity = interpolate(frame, [40, 60], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // VS badge pops in after panels
  const vsBadgeScale = spring({
    frame: Math.max(0, frame - 80),
    fps,
    config: { damping: 15, stiffness: 120 },
    durationInFrames: 20,
  });

  // Fade out near end
  const fadeOut = interpolate(frame, [720, 750], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0F172A',
        flexDirection: 'column',
        opacity: fadeOut,
      }}
    >
      {/* Title */}
      <div
        style={{
          textAlign: 'center',
          padding: '40px 60px 20px',
          opacity: titleOpacity,
        }}
      >
        <h1
          style={{
            color: '#FFFFFF',
            fontSize: 42,
            fontWeight: 800,
            margin: 0,
          }}
        >
          There is a Better Way
        </h1>
      </div>

      {/* Panels */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'row',
          padding: '0 40px 40px',
          gap: 0,
          opacity: panelsOpacity,
          position: 'relative',
        }}
      >
        <Panel
          label={oldLabel}
          content={oldWay}
          accentColour="#EF4444"
          slideFromLeft
          frame={frame}
          fps={fps}
        />

        {/* VS badge */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(-50%, -50%) scale(${vsBadgeScale})`,
            zIndex: 10,
            backgroundColor: '#0F172A',
            border: `3px solid ${brandColour}`,
            borderRadius: '50%',
            width: 72,
            height: 72,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              color: brandColour,
              fontSize: 22,
              fontWeight: 900,
            }}
          >
            VS
          </span>
        </div>

        <Panel
          label={newLabel}
          content={newWay}
          accentColour={brandColour}
          slideFromLeft={false}
          frame={frame}
          fps={fps}
        />
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
  );
}
