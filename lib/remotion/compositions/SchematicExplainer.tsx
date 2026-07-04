/**
 * Schematic Explainer Composition
 *
 * A landscape (16:9) "how-it-works" diagram rendered in a blueprint aesthetic —
 * deliberately distinct from the dark-orange educational style.
 * Features:
 * - Fine technical blueprint grid background (minor + major lines)
 * - An animated connector that "draws" in via interpolated stroke-dashoffset
 * - 2–4 step callout pins that reveal in sequence with mono/label typography
 * - Fully frame-driven and deterministic (Remotion renders per-frame)
 *
 * Blueprint palette: navy field, technical cyan accent (SYN-41, first slice).
 */

import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import type { SchematicExplainerProps } from '../types';

// Blueprint field colours — fixed background; accent is configurable.
const BLUEPRINT_BG = '#0A2A4A';
const MONO_STACK = "'SFMono-Regular', 'Roboto Mono', 'Courier New', monospace";

// Connector geometry (in composition pixels).
const CONNECTOR_Y = 660;
const CONNECTOR_X_START = 220;
const CONNECTOR_X_END = 1700;

// ── Blueprint Grid ────────────────────────────────────────────────────────────

function BlueprintGrid({ accentColour }: { accentColour: string }) {
  const minor = 48; // fine grid spacing
  const major = 240; // heavier grid spacing
  const width = 1920;
  const height = 1080;

  const lines: React.ReactNode[] = [];
  for (let x = 0; x <= width; x += minor) {
    const isMajor = x % major === 0;
    lines.push(
      <line
        key={`v${x}`}
        x1={x}
        y1={0}
        x2={x}
        y2={height}
        stroke={accentColour}
        strokeWidth={isMajor ? 1 : 0.5}
        opacity={isMajor ? 0.18 : 0.08}
      />
    );
  }
  for (let y = 0; y <= height; y += minor) {
    const isMajor = y % major === 0;
    lines.push(
      <line
        key={`h${y}`}
        x1={0}
        y1={y}
        x2={width}
        y2={y}
        stroke={accentColour}
        strokeWidth={isMajor ? 1 : 0.5}
        opacity={isMajor ? 0.18 : 0.08}
      />
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: 'absolute', inset: 0 }}
    >
      {lines}
      {/* Technical frame border with registration ticks */}
      <rect
        x={48}
        y={48}
        width={width - 96}
        height={height - 96}
        fill="none"
        stroke={accentColour}
        strokeWidth={1.5}
        opacity={0.35}
      />
    </svg>
  );
}

// ── Step Pin ──────────────────────────────────────────────────────────────────

function StepPin({
  index,
  x,
  label,
  detail,
  accentColour,
  frame,
  fps,
  revealFrame,
}: {
  index: number;
  x: number;
  label: string;
  detail?: string;
  accentColour: string;
  frame: number;
  fps: number;
  revealFrame: number;
}) {
  const progress = spring({
    frame: Math.max(0, frame - revealFrame),
    fps,
    config: { damping: 20, stiffness: 90, mass: 0.8 },
    durationInFrames: 24,
  });

  const opacity = interpolate(progress, [0, 0.4], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const leaderHeight = interpolate(progress, [0, 1], [0, 150]);
  const cardY = CONNECTOR_Y - 150 - 128; // card sits above the leader

  return (
    <div style={{ opacity }}>
      {/* Node on the connector */}
      <div
        style={{
          position: 'absolute',
          left: x - 12,
          top: CONNECTOR_Y - 12,
          width: 24,
          height: 24,
          borderRadius: '50%',
          backgroundColor: BLUEPRINT_BG,
          border: `3px solid ${accentColour}`,
        }}
      />

      {/* Vertical leader line drawing up to the callout card */}
      <div
        style={{
          position: 'absolute',
          left: x - 1,
          top: CONNECTOR_Y - leaderHeight,
          width: 2,
          height: leaderHeight,
          backgroundColor: accentColour,
          opacity: 0.7,
        }}
      />

      {/* Callout card */}
      <div
        style={{
          position: 'absolute',
          left: x - 150,
          top: cardY,
          width: 300,
          padding: '16px 18px',
          backgroundColor: 'rgba(10, 42, 74, 0.85)',
          border: `1.5px solid ${accentColour}`,
          borderRadius: 6,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontFamily: MONO_STACK,
              color: accentColour,
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: 1,
            }}
          >
            {String(index + 1).padStart(2, '0')}
          </span>
          <span
            style={{
              fontFamily: MONO_STACK,
              color: '#FFFFFF',
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            {label}
          </span>
        </div>
        {detail && (
          <p
            style={{
              fontFamily: MONO_STACK,
              color: 'rgba(210, 232, 255, 0.75)',
              fontSize: 15,
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Schematic Explainer Composition ───────────────────────────────────────────

export function SchematicExplainer({
  title,
  steps,
  accentColour = '#38BDF8',
}: SchematicExplainerProps) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const displaySteps = steps.slice(0, 4);

  // Header fades in.
  const headerOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Connector draws in via normalised stroke-dashoffset (pathLength = 1).
  const drawProgress = interpolate(frame, [30, 130], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const dashOffset = 1 - drawProgress;

  // Arrowhead appears once the line has finished drawing.
  const arrowOpacity = interpolate(frame, [120, 135], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Fade out near the end.
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 30, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Step x-positions distributed along the connector.
  const span = CONNECTOR_X_END - 60 - CONNECTOR_X_START;
  const stepX = (i: number) =>
    displaySteps.length === 1
      ? (CONNECTOR_X_START + CONNECTOR_X_END) / 2
      : CONNECTOR_X_START + (span / (displaySteps.length - 1)) * i;

  const STEP_INTERVAL = 40;
  const FIRST_STEP_FRAME = 70;

  return (
    <AbsoluteFill style={{ backgroundColor: BLUEPRINT_BG, opacity: fadeOut }}>
      <BlueprintGrid accentColour={accentColour} />

      {/* Header */}
      <div
        style={{
          position: 'absolute',
          top: 96,
          left: 120,
          opacity: headerOpacity,
        }}
      >
        <span
          style={{
            fontFamily: MONO_STACK,
            color: accentColour,
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: 6,
            textTransform: 'uppercase',
          }}
        >
          Schematic · How It Works
        </span>
        <h1
          style={{
            fontFamily: MONO_STACK,
            color: '#FFFFFF',
            fontSize: 56,
            fontWeight: 800,
            letterSpacing: 1,
            margin: '12px 0 0',
            maxWidth: 1200,
          }}
        >
          {title}
        </h1>
      </div>

      {/* Animated connector that draws in */}
      <svg
        width={1920}
        height={1080}
        viewBox="0 0 1920 1080"
        style={{ position: 'absolute', inset: 0 }}
      >
        <line
          x1={CONNECTOR_X_START}
          y1={CONNECTOR_Y}
          x2={CONNECTOR_X_END - 20}
          y2={CONNECTOR_Y}
          stroke={accentColour}
          strokeWidth={4}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={dashOffset}
        />
        {/* Arrowhead at the end of the connector */}
        <polygon
          points={`${CONNECTOR_X_END - 24},${CONNECTOR_Y - 14} ${CONNECTOR_X_END},${CONNECTOR_Y} ${CONNECTOR_X_END - 24},${CONNECTOR_Y + 14}`}
          fill={accentColour}
          opacity={arrowOpacity}
        />
      </svg>

      {/* Step pins reveal in sequence */}
      {displaySteps.map((s, i) => (
        <StepPin
          key={i}
          index={i}
          x={stepX(i)}
          label={s.label}
          detail={s.detail}
          accentColour={accentColour}
          frame={frame}
          fps={fps}
          revealFrame={FIRST_STEP_FRAME + i * STEP_INTERVAL}
        />
      ))}

      {/* Watermark */}
      <span
        style={{
          position: 'absolute',
          bottom: 72,
          right: 120,
          fontFamily: MONO_STACK,
          color: accentColour,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: 2,
          opacity: 0.8,
        }}
      >
        synthex.social
      </span>

      {/* Bottom accent bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: 4,
          backgroundColor: accentColour,
        }}
      />
    </AbsoluteFill>
  );
}
