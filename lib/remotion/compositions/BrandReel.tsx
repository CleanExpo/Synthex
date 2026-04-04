'use client';

/**
 * Brand Reel Composition
 *
 * A portrait (9:16) short-form brand video for YouTube Shorts, X, Instagram, TikTok.
 * Features:
 * - Bold hook text opener (muted-autoplay optimised)
 * - Brand name + logo reveal
 * - Key benefit highlight
 * - CTA with brand colour accent
 * - Progress bar at bottom
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
import type { BrandReelProps } from '../types';

// ── Hook Scene ───────────────────────────────────────────────────────────────

function HookScene({ hookText }: { hookText: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 150 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000000',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 60,
      }}
    >
      <h1
        style={{
          color: '#FFFFFF',
          fontSize: 64,
          fontWeight: 900,
          textAlign: 'center',
          lineHeight: 1.2,
          transform: `scale(${scale})`,
          textShadow: '0 4px 20px rgba(0,0,0,0.8)',
        }}
      >
        {hookText}
      </h1>
    </AbsoluteFill>
  );
}

// ── Brand Reveal Scene ───────────────────────────────────────────────────────

function BrandReveal({
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

  const nameOpacity = interpolate(frame, [10, 25], [0, 1], {
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
              width: 160,
              height: 160,
              objectFit: 'contain',
              transform: `scale(${logoSpring})`,
              marginBottom: 24,
            }}
          />
        )}
        <h2
          style={{
            color: '#FFFFFF',
            fontSize: 56,
            fontWeight: 800,
            margin: 0,
            opacity: nameOpacity,
            textShadow: '0 2px 16px rgba(0,0,0,0.3)',
          }}
        >
          {brandName}
        </h2>
      </div>
    </AbsoluteFill>
  );
}

// ── Benefit Scene ────────────────────────────────────────────────────────────

function BenefitScene({
  benefit,
  brandColour,
}: {
  benefit: string;
  brandColour: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideUp = interpolate(frame, [0, 15], [40, 0], {
    extrapolateRight: 'clamp',
  });

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
      <div
        style={{
          opacity,
          transform: `translateY(${slideUp}px)`,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 8,
            height: 60,
            backgroundColor: brandColour,
            margin: '0 auto 28px',
            borderRadius: 4,
          }}
        />
        <p
          style={{
            color: '#FFFFFF',
            fontSize: 48,
            fontWeight: 700,
            lineHeight: 1.3,
            margin: 0,
            maxWidth: 800,
          }}
        >
          {benefit}
        </p>
      </div>
    </AbsoluteFill>
  );
}

// ── CTA Scene ────────────────────────────────────────────────────────────────

function ReelCTA({
  ctaText,
  brandColour,
}: {
  ctaText: string;
  brandColour: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pulse = spring({
    frame: frame % 30,
    fps,
    config: { damping: 8, stiffness: 200 },
  });

  const scale = interpolate(pulse, [0, 1], [0.95, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000000',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 60,
      }}
    >
      <div
        style={{
          backgroundColor: brandColour,
          borderRadius: 24,
          padding: '32px 56px',
          transform: `scale(${scale})`,
        }}
      >
        <p
          style={{
            color: '#FFFFFF',
            fontSize: 44,
            fontWeight: 800,
            margin: 0,
            textAlign: 'center',
          }}
        >
          {ctaText}
        </p>
      </div>
    </AbsoluteFill>
  );
}

// ── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ brandColour }: { brandColour: string }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const progress = interpolate(frame, [0, durationInFrames], [0, 100], {
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100%',
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.15)',
        zIndex: 10,
      }}
    >
      <div
        style={{
          width: `${progress}%`,
          height: '100%',
          backgroundColor: brandColour,
        }}
      />
    </div>
  );
}

// ── Main Composition ─────────────────────────────────────────────────────────

export function BrandReel({
  title,
  scenes: _scenes,
  brandColour = '#f59e0b',
  logoUrl,
  hookText,
  benefit,
  ctaText = 'Learn More',
  audioConfig,
}: BrandReelProps) {
  // Scene timing (30fps): total ~15s = 450 frames
  const hookFrames = 105; // 3.5s
  const brandFrames = 120; // 4s
  const benefitFrames = 120; // 4s
  const ctaFrames = 105; // 3.5s

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>
      {/* Background music — looped, energetic for short-form */}
      {audioConfig?.musicStaticFile && (
        <Audio
          src={staticFile(audioConfig.musicStaticFile)}
          volume={audioConfig.musicVolume ?? 0.15}
          loop
        />
      )}

      {/* ElevenLabs voiceover */}
      {audioConfig?.voiceoverStaticFile && (
        <Audio src={staticFile(audioConfig.voiceoverStaticFile)} />
      )}

      {/* Scene 1: Hook text */}
      <Sequence from={0} durationInFrames={hookFrames}>
        <HookScene hookText={hookText} />
      </Sequence>

      {/* Scene 2: Brand reveal */}
      <Sequence from={hookFrames} durationInFrames={brandFrames}>
        <BrandReveal
          brandName={title}
          brandColour={brandColour}
          logoUrl={logoUrl}
        />
      </Sequence>

      {/* Scene 3: Key benefit */}
      <Sequence
        from={hookFrames + brandFrames}
        durationInFrames={benefitFrames}
      >
        <BenefitScene benefit={benefit} brandColour={brandColour} />
      </Sequence>

      {/* Scene 4: CTA */}
      <Sequence
        from={hookFrames + brandFrames + benefitFrames}
        durationInFrames={ctaFrames}
      >
        <ReelCTA ctaText={ctaText} brandColour={brandColour} />
      </Sequence>

      {/* Progress bar */}
      <ProgressBar brandColour={brandColour} />
    </AbsoluteFill>
  );
}
