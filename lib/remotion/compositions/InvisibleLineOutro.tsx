'use client';

/**
 * InvisibleLineOutro Composition
 *
 * Act VI / Outro for "The Invisible Line" — a 90-second cinematic restoration-
 * industry anthem for RestoreAssist / NRPG / DisasterRecovery.com.au.
 *
 * Visual design: deep charcoal background, three typographic brand lockups that
 * illuminate with a cold-blue glow bloom, kinetic VO typography, and a thin
 * "invisible line" accent drawn under the centre lockup.
 *
 * 16:9 · 1920×1080 · 30fps · 180 frames (~6 seconds)
 *
 * NOTE: logo SVGs and VO mp3 are placeholder-ready.
 * Real assets drop in via the `voiceoverSrc` prop + replacing the typographic
 * lockups with <img> elements once SVGs are available.
 */

import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
  Audio,
  staticFile,
} from 'remotion';
import type { InvisibleLineOutroProps } from '../types';

// ── Colour constants ──────────────────────────────────────────────────────────

const CHARCOAL = '#16181B';
const OFF_WHITE = '#F5F5F2';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Clamp interpolate shorthand. */
function fadeIn(frame: number, start: number, end: number): number {
  return interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

// ── Centre hero lockup ────────────────────────────────────────────────────────

function CentreLockup({
  headline,
  accentColour,
}: {
  headline: string;
  accentColour: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Illuminate: fade + scale from 0.92 with glow bloom, frames 0-25
  const opacity = fadeIn(frame, 0, 25);
  const scaleSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120 },
  });
  const scale = interpolate(scaleSpring, [0, 1], [0.92, 1]);

  // Glow bloom: grows to peak at ~frame 25, then softly settles
  const bloomRadius = interpolate(frame, [0, 15, 35, 60], [0, 48, 22, 18], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Gentle breathing glow from frame 60 onward (subtle sinusoidal via frame)
  // We can't use Math.sin in Remotion types so we approximate with interpolate
  // cycling every 60 frames.
  const breathCycle = frame > 60 ? ((frame - 60) % 60) / 60 : 0;
  const breathGlow = interpolate(breathCycle, [0, 0.5, 1], [18, 26, 18]);
  const finalGlow = frame > 60 ? breathGlow : bloomRadius;

  return (
    <div
      style={{
        opacity,
        transform: `scale(${scale})`,
        textAlign: 'center',
      }}
    >
      {/* Typographic lockup — replace inner content with <img> when SVG is ready */}
      <div
        style={{
          fontSize: 52,
          fontWeight: 800,
          letterSpacing: '-0.5px',
          color: OFF_WHITE,
          textShadow: `0 0 ${finalGlow}px ${accentColour}, 0 0 ${finalGlow * 2}px ${accentColour}44`,
          lineHeight: 1.1,
        }}
      >
        {headline}
      </div>
      {/* Placeholder note: swap the div above for:
          <img src={staticFile('logos/disaster-recovery.svg')} alt="DisasterRecovery.com.au" style={{ height: 60 }} />
      */}
    </div>
  );
}

// ── Side lockup (left / right) ────────────────────────────────────────────────

function SideLockup({
  mark,
  sub,
  accentColour,
  startFrame,
}: {
  mark: string;
  sub: string;
  accentColour: string;
  startFrame: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = Math.max(0, frame - startFrame);

  const opacity = fadeIn(frame, startFrame, startFrame + 25);
  const scaleSpring = spring({
    frame: localFrame,
    fps,
    config: { damping: 14, stiffness: 120 },
  });
  const scale = interpolate(scaleSpring, [0, 1], [0.92, 1]);

  const bloomRadius = interpolate(
    localFrame,
    [0, 15, 35, 55],
    [0, 36, 14, 10],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <div
      style={{
        opacity,
        transform: `scale(${scale})`,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 34,
          fontWeight: 700,
          letterSpacing: '1px',
          color: OFF_WHITE,
          textShadow: `0 0 ${bloomRadius}px ${accentColour}`,
          textTransform: 'uppercase',
        }}
      >
        {mark}
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 300,
          letterSpacing: '3px',
          color: accentColour,
          textTransform: 'uppercase',
          marginTop: 6,
        }}
      >
        {sub}
      </div>
      {/* Placeholder note: swap the divs above for:
          <img src={staticFile('logos/nrpg.svg')} ... />
      */}
    </div>
  );
}

// ── The Invisible Line accent ─────────────────────────────────────────────────

function InvisibleLineAccent({ accentColour }: { accentColour: string }) {
  const frame = useCurrentFrame();

  // Line draws from left to right between frames 30-65
  const widthPct = interpolate(frame, [30, 65], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const opacity = interpolate(frame, [28, 32], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: 480,
        height: 1,
        backgroundColor: 'transparent',
        position: 'relative',
        opacity,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: '100%',
          width: `${widthPct}%`,
          backgroundColor: accentColour,
          boxShadow: `0 0 8px ${accentColour}`,
        }}
      />
    </div>
  );
}

// ── Kinetic VO typography ─────────────────────────────────────────────────────

function VOLine({
  text,
  startFrame,
  endFrame,
  fontSize = 32,
}: {
  text: string;
  startFrame: number;
  endFrame: number;
  fontSize?: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = Math.max(0, frame - startFrame);

  const slideSpring = spring({
    frame: localFrame,
    fps,
    config: { damping: 16, stiffness: 200 },
  });
  const translateY = interpolate(slideSpring, [0, 1], [24, 0]);

  const opacity = interpolate(frame, [startFrame, startFrame + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Fade out near end
  const fadeOut =
    endFrame > 0
      ? interpolate(frame, [endFrame - 8, endFrame], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 1;

  return (
    <div
      style={{
        opacity: opacity * fadeOut,
        transform: `translateY(${translateY}px)`,
        fontSize,
        fontWeight: 700,
        color: OFF_WHITE,
        textAlign: 'center',
        letterSpacing: '-0.3px',
        lineHeight: 1.3,
        maxWidth: 900,
      }}
    >
      {text}
    </div>
  );
}

// ── Vignette background ───────────────────────────────────────────────────────

function VignetteBackground() {
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, #1e2126 0%, ${CHARCOAL} 72%)`,
      }}
    />
  );
}

// ── Main composition ──────────────────────────────────────────────────────────

export function InvisibleLineOutro({
  headline = 'DisasterRecovery.com.au',
  leftMark = 'NRPG',
  leftSub = 'THE STANDARD',
  rightMark = 'ReStoreAssist',
  rightSub = 'THE PROOF',
  ctaLine1 = 'Demand the science.',
  ctaLine2 = 'Find your professional today at DisasterRecovery.com.au',
  accentColour = '#2E9BD6',
  voiceoverSrc,
}: InvisibleLineOutroProps) {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: CHARCOAL,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Radial vignette background */}
      <VignetteBackground />

      {/* Optional VO audio — only rendered when src is provided */}
      {voiceoverSrc && <Audio src={staticFile(voiceoverSrc)} />}

      {/* ── VO kinetic typography layer ──────────────────────────────────── */}
      {/* Line 1: "Demand the science." frames 50-80 */}
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'flex-start',
          paddingTop: 180,
        }}
      >
        <Sequence from={50} durationInFrames={130}>
          <AbsoluteFill
            style={{
              justifyContent: 'center',
              alignItems: 'flex-start',
              paddingTop: 180,
            }}
          >
            <VOLine text={ctaLine1} startFrame={0} endFrame={0} fontSize={38} />
          </AbsoluteFill>
        </Sequence>
      </AbsoluteFill>

      {/* Line 2: "Find your professional…" frames 80-180 */}
      <Sequence from={80} durationInFrames={100}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'flex-start',
            paddingTop: 252,
          }}
        >
          <VOLine text={ctaLine2} startFrame={0} endFrame={0} fontSize={24} />
        </AbsoluteFill>
      </Sequence>

      {/* ── Logo lockup layer ─────────────────────────────────────────────── */}

      {/* Centre hero lockup — illuminates frames 0-25 */}
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <CentreLockup headline={headline} accentColour={accentColour} />

        {/* The Invisible Line accent — draws frames 30-65 */}
        <InvisibleLineAccent accentColour={accentColour} />
      </AbsoluteFill>

      {/* Left lockup (NRPG) — illuminates frames 20-45 */}
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          paddingRight: '58%',
        }}
      >
        <SideLockup
          mark={leftMark}
          sub={leftSub}
          accentColour={accentColour}
          startFrame={20}
        />
      </AbsoluteFill>

      {/* Right lockup (ReStoreAssist) — illuminates frames 20-45 */}
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          paddingLeft: '58%',
        }}
      >
        <SideLockup
          mark={rightMark}
          sub={rightSub}
          accentColour={accentColour}
          startFrame={20}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
