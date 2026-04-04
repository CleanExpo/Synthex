/**
 * Case Study Video Composition
 *
 * A landscape (16:9) success story video.
 * Features:
 * - Three sequential scenes: Challenge → Solution → Result
 * - Metric highlight in the result scene
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
import type { CaseStudyVideoProps } from '../types';

// Scene durations in frames (at 30fps)
const INTRO_DURATION = 60;
const CHALLENGE_DURATION = 360;
const SOLUTION_DURATION = 360;
const RESULT_DURATION = 420;

// ── Scene Label ───────────────────────────────────────────────────────────────

function SceneLabel({
  label,
  accentColour,
  frame,
  fps,
}: {
  label: string;
  accentColour: string;
  frame: number;
  fps: number;
}) {
  const slide = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 100 },
    durationInFrames: 25,
  });
  const translateX = interpolate(slide, [0, 1], [-200, 0]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 40,
        left: 60,
        transform: `translateX(${translateX}px)`,
      }}
    >
      <div
        style={{
          backgroundColor: accentColour,
          borderRadius: 8,
          padding: '8px 20px',
        }}
      >
        <span
          style={{
            color: '#FFFFFF',
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: 3,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

// ── Story Scene ───────────────────────────────────────────────────────────────

function StoryScene({
  label,
  content,
  accentColour,
  brandColour,
  metric,
  showMetric,
}: {
  label: string;
  content: string;
  accentColour: string;
  brandColour: string;
  metric?: string;
  showMetric?: boolean;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const contentOpacity = interpolate(frame, [20, 45], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const contentY = interpolate(frame, [20, 45], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const metricScale = spring({
    frame: Math.max(0, frame - 60),
    fps,
    config: { damping: 15, stiffness: 90 },
    durationInFrames: 30,
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0F172A',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '100px 120px 80px',
        flexDirection: 'column',
        gap: 32,
      }}
    >
      {/* Left accent bar */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 8,
          backgroundColor: accentColour,
        }}
      />

      <SceneLabel
        label={label}
        accentColour={accentColour}
        frame={frame}
        fps={fps}
      />

      <div
        style={{
          transform: `translateY(${contentY}px)`,
          opacity: contentOpacity,
          textAlign: 'center',
          maxWidth: 1000,
        }}
      >
        <p
          style={{
            color: '#FFFFFF',
            fontSize: 40,
            fontWeight: 600,
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          {content}
        </p>
      </div>

      {/* Optional metric callout */}
      {showMetric && metric && (
        <div
          style={{
            transform: `scale(${metricScale})`,
            backgroundColor: brandColour,
            borderRadius: 16,
            padding: '16px 48px',
          }}
        >
          <span
            style={{
              color: '#FFFFFF',
              fontSize: 48,
              fontWeight: 900,
            }}
          >
            {metric}
          </span>
        </div>
      )}

      {/* Watermark */}
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
  );
}

// ── Case Study Video Composition ──────────────────────────────────────────────

export function CaseStudyVideo({
  title,
  challenge,
  solution,
  result,
  metric,
  brandColour = '#f59e0b',
}: CaseStudyVideoProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Intro title card entrance
  const titleScale = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 100 },
    durationInFrames: 30,
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0F172A' }}>
      {/* Intro title card */}
      <Sequence from={0} durationInFrames={INTRO_DURATION}>
        <AbsoluteFill
          style={{
            backgroundColor: brandColour,
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <span
            style={{
              color: 'rgba(255,255,255,0.75)',
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: 4,
              textTransform: 'uppercase',
            }}
          >
            Case Study
          </span>
          <h1
            style={{
              color: '#FFFFFF',
              fontSize: 56,
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

      {/* Challenge scene */}
      <Sequence from={INTRO_DURATION} durationInFrames={CHALLENGE_DURATION}>
        <StoryScene
          label="The Challenge"
          content={challenge}
          accentColour="#EF4444"
          brandColour={brandColour}
        />
      </Sequence>

      {/* Solution scene */}
      <Sequence
        from={INTRO_DURATION + CHALLENGE_DURATION}
        durationInFrames={SOLUTION_DURATION}
      >
        <StoryScene
          label="The Solution"
          content={solution}
          accentColour="#F59E0B"
          brandColour={brandColour}
        />
      </Sequence>

      {/* Result scene */}
      <Sequence
        from={INTRO_DURATION + CHALLENGE_DURATION + SOLUTION_DURATION}
        durationInFrames={RESULT_DURATION}
      >
        <StoryScene
          label="The Result"
          content={result}
          accentColour={brandColour}
          brandColour={brandColour}
          metric={metric}
          showMetric
        />
      </Sequence>
    </AbsoluteFill>
  );
}
