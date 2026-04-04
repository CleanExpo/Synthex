/**
 * How To Video Composition
 *
 * A landscape (16:9) step-by-step guide video.
 * Features:
 * - Title card entrance
 * - Numbered steps revealed sequentially with Unicode circle numbers
 * - Optional detail text per step
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
import type { HowToVideoProps } from '../types';

// Unicode circled numbers ①②③④⑤ for visual step icons
const CIRCLE_NUMBERS = ['①', '②', '③', '④', '⑤'];

// ── Step Component ────────────────────────────────────────────────────────────

function StepItem({
  index,
  step,
  detail,
  brandColour,
  frame,
  fps,
  revealFrame,
}: {
  index: number;
  step: string;
  detail?: string;
  brandColour: string;
  frame: number;
  fps: number;
  revealFrame: number;
}) {
  const progress = spring({
    frame: Math.max(0, frame - revealFrame),
    fps,
    config: { damping: 20, stiffness: 70, mass: 0.9 },
    durationInFrames: 35,
  });

  const translateY = interpolate(progress, [0, 1], [50, 0]);
  const opacity = interpolate(progress, [0, 0.3], [0, 1]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 24,
        transform: `translateY(${translateY}px)`,
        opacity,
        marginBottom: 24,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 12,
        padding: '16px 24px',
        borderLeft: `4px solid ${brandColour}`,
      }}
    >
      {/* Circle number icon */}
      <span
        style={{
          color: brandColour,
          fontSize: 36,
          lineHeight: 1,
          flexShrink: 0,
          paddingTop: 2,
        }}
      >
        {CIRCLE_NUMBERS[index] ?? `${index + 1}.`}
      </span>

      {/* Step content */}
      <div>
        <p
          style={{
            color: '#FFFFFF',
            fontSize: 26,
            fontWeight: 600,
            lineHeight: 1.4,
            margin: 0,
          }}
        >
          {step}
        </p>
        {detail && (
          <p
            style={{
              color: 'rgba(255,255,255,0.55)',
              fontSize: 20,
              lineHeight: 1.5,
              margin: '6px 0 0',
            }}
          >
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}

// ── How To Video Composition ──────────────────────────────────────────────────

export function HowToVideo({
  title,
  steps,
  brandColour = '#f59e0b',
}: HowToVideoProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const displaySteps = steps.slice(0, 5);

  const TITLE_DURATION = 60;
  const STEP_INTERVAL = 200;

  // Title entrance scale spring
  const titleScale = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 100 },
    durationInFrames: 30,
  });

  // Fade out near end
  const fadeOut = interpolate(frame, [1160, 1200], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0F172A', opacity: fadeOut }}>
      {/* Title card */}
      <Sequence from={0} durationInFrames={TITLE_DURATION}>
        <AbsoluteFill
          style={{
            backgroundColor: brandColour,
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <span
            style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 4,
              textTransform: 'uppercase',
            }}
          >
            How To
          </span>
          <h1
            style={{
              color: '#FFFFFF',
              fontSize: 60,
              fontWeight: 800,
              textAlign: 'center',
              maxWidth: 1000,
              margin: 0,
              transform: `scale(${titleScale})`,
            }}
          >
            {title}
          </h1>
        </AbsoluteFill>
      </Sequence>

      {/* Steps content */}
      <Sequence from={TITLE_DURATION} durationInFrames={1200 - TITLE_DURATION}>
        <AbsoluteFill
          style={{
            backgroundColor: '#0F172A',
            justifyContent: 'center',
            padding: '40px 100px',
            flexDirection: 'column',
          }}
        >
          {/* Guide label */}
          <div style={{ marginBottom: 28 }}>
            <span
              style={{
                color: brandColour,
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: 3,
                textTransform: 'uppercase',
              }}
            >
              Step-by-Step Guide
            </span>
          </div>

          {/* Steps */}
          {displaySteps.map((s, i) => (
            <StepItem
              key={i}
              index={i}
              step={s.step}
              detail={s.detail}
              brandColour={brandColour}
              frame={frame - TITLE_DURATION}
              fps={fps}
              revealFrame={i * STEP_INTERVAL}
            />
          ))}

          {/* Watermark */}
          <div
            style={{
              position: 'absolute',
              bottom: 40,
              right: 80,
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
        </AbsoluteFill>
      </Sequence>

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
