'use client';

/**
 * Brand Square Composition
 *
 * A square (1:1) brand video for LinkedIn and Facebook feeds.
 * Features:
 * - Problem statement opener (identifies pain point)
 * - Solution reveal with brand positioning
 * - Brand introduction with logo
 * - CTA with professional tone
 *
 * Used exclusively in the God Mode Remotion Studio.
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
import type { BrandSquareProps } from '../types';

// ── Problem Scene ────────────────────────────────────────────────────────────

function ProblemScene({ problem }: { problem: string }) {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const slideUp = interpolate(frame, [0, 20], [30, 0], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0F172A',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 60,
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${slideUp}px)`,
          textAlign: 'center',
        }}
      >
        <p
          style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: 24,
            fontWeight: 500,
            margin: '0 0 20px 0',
            textTransform: 'uppercase',
            letterSpacing: 3,
          }}
        >
          The Challenge
        </p>
        <h2
          style={{
            color: '#FFFFFF',
            fontSize: 44,
            fontWeight: 700,
            lineHeight: 1.3,
            margin: 0,
            maxWidth: 900,
          }}
        >
          {problem}
        </h2>
      </div>
    </AbsoluteFill>
  );
}

// ── Solution Scene ───────────────────────────────────────────────────────────

function SolutionScene({
  solution,
  brandColour,
}: {
  solution: string;
  brandColour: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const revealSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 100 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#1E293B',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 60,
      }}
    >
      <div
        style={{
          transform: `scale(${revealSpring})`,
          textAlign: 'center',
        }}
      >
        <p
          style={{
            color: brandColour,
            fontSize: 24,
            fontWeight: 600,
            margin: '0 0 20px 0',
            textTransform: 'uppercase',
            letterSpacing: 3,
          }}
        >
          The Solution
        </p>
        <h2
          style={{
            color: '#FFFFFF',
            fontSize: 40,
            fontWeight: 700,
            lineHeight: 1.3,
            margin: 0,
            maxWidth: 900,
          }}
        >
          {solution}
        </h2>
      </div>

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

// ── Brand Intro Scene ────────────────────────────────────────────────────────

function BrandIntro({
  brandName,
  brandColour,
  logoUrl,
}: {
  brandName: string;
  brandColour: string;
  logoUrl?: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const nameOpacity = interpolate(frame, [12, 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: brandColour,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 60,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        {logoUrl && (
          <img
            src={logoUrl}
            alt=""
            style={{
              width: 140,
              height: 140,
              objectFit: 'contain',
              transform: `scale(${logoSpring})`,
              marginBottom: 24,
            }}
          />
        )}
        <h2
          style={{
            color: '#FFFFFF',
            fontSize: 48,
            fontWeight: 800,
            margin: 0,
            opacity: nameOpacity,
          }}
        >
          {brandName}
        </h2>
      </div>
    </AbsoluteFill>
  );
}

// ── CTA Scene ────────────────────────────────────────────────────────────────

function SquareCTA({
  ctaText,
  brandColour,
}: {
  ctaText: string;
  brandColour: string;
}) {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0F172A',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 60,
      }}
    >
      <div style={{ textAlign: 'center', opacity }}>
        <div
          style={{
            backgroundColor: brandColour,
            borderRadius: 16,
            padding: '28px 48px',
            display: 'inline-block',
          }}
        >
          <p
            style={{
              color: '#FFFFFF',
              fontSize: 36,
              fontWeight: 700,
              margin: 0,
            }}
          >
            {ctaText}
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Main Composition ─────────────────────────────────────────────────────────

export function BrandSquare({
  title,
  scenes: _scenes,
  brandColour = '#f59e0b',
  logoUrl,
  problem,
  solution,
  ctaText = 'Learn More',
  audioConfig,
}: BrandSquareProps) {
  // Scene timing (30fps): total ~20s = 600 frames
  const problemFrames = 150; // 5s
  const solutionFrames = 165; // 5.5s
  const brandFrames = 150; // 5s
  const ctaFrames = 135; // 4.5s

  return (
    <AbsoluteFill style={{ backgroundColor: '#0F172A' }}>
      {/* Background music */}
      {audioConfig?.musicStaticFile && (
        <Audio
          src={staticFile(audioConfig.musicStaticFile)}
          volume={audioConfig.musicVolume ?? 0.12}
          loop
        />
      )}

      {/* ElevenLabs voiceover */}
      {audioConfig?.voiceoverStaticFile && (
        <Audio src={staticFile(audioConfig.voiceoverStaticFile)} />
      )}

      {/* Scene 1: Problem statement */}
      <Sequence from={0} durationInFrames={problemFrames}>
        <ProblemScene problem={problem} />
      </Sequence>

      {/* Scene 2: Solution */}
      <Sequence from={problemFrames} durationInFrames={solutionFrames}>
        <SolutionScene solution={solution} brandColour={brandColour} />
      </Sequence>

      {/* Scene 3: Brand intro */}
      <Sequence
        from={problemFrames + solutionFrames}
        durationInFrames={brandFrames}
      >
        <BrandIntro
          brandName={title}
          brandColour={brandColour}
          logoUrl={logoUrl}
        />
      </Sequence>

      {/* Scene 4: CTA */}
      <Sequence
        from={problemFrames + solutionFrames + brandFrames}
        durationInFrames={ctaFrames}
      >
        <SquareCTA ctaText={ctaText} brandColour={brandColour} />
      </Sequence>
    </AbsoluteFill>
  );
}
