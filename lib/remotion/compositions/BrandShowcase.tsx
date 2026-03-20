'use client';

/**
 * Brand Showcase Composition
 *
 * A landscape (16:9) brand introduction video for YouTube.
 * Features:
 * - Logo reveal with brand colour backdrop
 * - Tagline entrance with spring animation
 * - 3 value proposition cards with staggered slide-in
 * - Call-to-action with website URL
 * - End card with all brand details
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
import type { BrandShowcaseProps } from '../types';

// ── Logo Reveal Scene ────────────────────────────────────────────────────────

function LogoReveal({
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

  const scale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: brandColour,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{ transform: `scale(${scale})`, opacity, textAlign: 'center' }}
      >
        {logoUrl && (
          <img
            src={logoUrl}
            alt=""
            style={{
              width: 180,
              height: 180,
              objectFit: 'contain',
              marginBottom: 30,
            }}
          />
        )}
        <h1
          style={{
            color: '#FFFFFF',
            fontSize: 72,
            fontWeight: 800,
            margin: 0,
            textShadow: '0 4px 30px rgba(0,0,0,0.3)',
            letterSpacing: -1,
          }}
        >
          {brandName}
        </h1>
      </div>
    </AbsoluteFill>
  );
}

// ── Tagline Scene ────────────────────────────────────────────────────────────

function TaglineScene({
  tagline,
  industry,
  brandColour,
}: {
  tagline: string;
  industry?: string;
  brandColour: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 120 },
  });

  const subtitleOpacity = interpolate(frame, [15, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0F172A',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 80,
      }}
    >
      <div style={{ textAlign: 'center', transform: `scale(${titleSpring})` }}>
        <h2
          style={{
            color: '#FFFFFF',
            fontSize: 56,
            fontWeight: 700,
            lineHeight: 1.3,
            margin: 0,
            maxWidth: 1200,
          }}
        >
          {tagline}
        </h2>
        {industry && (
          <p
            style={{
              color: brandColour,
              fontSize: 28,
              fontWeight: 500,
              marginTop: 24,
              opacity: subtitleOpacity,
              textTransform: 'uppercase',
              letterSpacing: 4,
            }}
          >
            {industry}
          </p>
        )}
      </div>

      {/* Brand accent line */}
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

// ── Value Prop Scene ─────────────────────────────────────────────────────────

function ValuePropScene({
  valueProps,
  brandColour,
}: {
  valueProps: string[];
  brandColour: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#1E293B',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 80,
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 40,
          justifyContent: 'center',
          alignItems: 'stretch',
          width: '100%',
          maxWidth: 1600,
        }}
      >
        {valueProps.slice(0, 3).map((prop, i) => {
          const delay = i * 8;
          const propSpring = spring({
            frame: Math.max(0, frame - delay),
            fps,
            config: { damping: 14, stiffness: 100 },
          });

          const slideX = interpolate(propSpring, [0, 1], [60, 0]);

          return (
            <div
              key={i}
              style={{
                flex: 1,
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: 16,
                padding: '48px 36px',
                textAlign: 'center',
                opacity: propSpring,
                transform: `translateY(${slideX}px)`,
                borderTop: `4px solid ${brandColour}`,
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  backgroundColor: brandColour,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontSize: 24,
                  fontWeight: 700,
                  color: '#FFFFFF',
                  margin: '0 auto 24px',
                }}
              >
                {i + 1}
              </div>
              <p
                style={{
                  color: '#FFFFFF',
                  fontSize: 28,
                  fontWeight: 600,
                  lineHeight: 1.4,
                  margin: 0,
                }}
              >
                {prop}
              </p>
            </div>
          );
        })}
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

// ── CTA Scene ────────────────────────────────────────────────────────────────

function CTAScene({
  brandName,
  websiteUrl,
  brandColour,
  logoUrl,
}: {
  brandName: string;
  websiteUrl?: string;
  brandColour: string;
  logoUrl?: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 80 },
  });

  const buttonOpacity = interpolate(frame, [20, 35], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: brandColour,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div style={{ textAlign: 'center', transform: `scale(${scale})` }}>
        {logoUrl && (
          <img
            src={logoUrl}
            alt=""
            style={{
              width: 120,
              height: 120,
              objectFit: 'contain',
              marginBottom: 24,
            }}
          />
        )}
        <h2
          style={{
            color: '#FFFFFF',
            fontSize: 52,
            fontWeight: 800,
            margin: 0,
          }}
        >
          {brandName}
        </h2>
        {websiteUrl && (
          <div
            style={{
              marginTop: 32,
              opacity: buttonOpacity,
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: 50,
              padding: '16px 48px',
              display: 'inline-block',
            }}
          >
            <p
              style={{
                color: '#FFFFFF',
                fontSize: 28,
                fontWeight: 600,
                margin: 0,
              }}
            >
              {websiteUrl}
            </p>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
}

// ── Main Composition ─────────────────────────────────────────────────────────

export function BrandShowcase({
  title,
  scenes: _scenes,
  brandColour = '#f59e0b',
  logoUrl,
  tagline,
  valueProps,
  websiteUrl,
  industry,
  audioConfig,
}: BrandShowcaseProps) {
  // Scene timing (30fps): total ~45s = 1350 frames
  const logoFrames = 150; // 5s
  const taglineFrames = 270; // 9s
  const valueFrames = 450; // 15s
  const ctaFrames = 480; // 16s (fills remainder)

  return (
    <AbsoluteFill style={{ backgroundColor: '#0F172A' }}>
      {/* Background music — looped, subtle volume */}
      {audioConfig?.musicStaticFile && (
        <Audio
          src={staticFile(audioConfig.musicStaticFile)}
          volume={audioConfig.musicVolume ?? 0.12}
          loop
        />
      )}

      {/* ElevenLabs voiceover — plays from start, aligned to scene flow */}
      {audioConfig?.voiceoverStaticFile && (
        <Audio src={staticFile(audioConfig.voiceoverStaticFile)} />
      )}

      {/* Scene 1: Logo reveal */}
      <Sequence from={0} durationInFrames={logoFrames}>
        <LogoReveal
          brandName={title}
          brandColour={brandColour}
          logoUrl={logoUrl}
        />
      </Sequence>

      {/* Scene 2: Tagline */}
      <Sequence from={logoFrames} durationInFrames={taglineFrames}>
        <TaglineScene
          tagline={tagline}
          industry={industry}
          brandColour={brandColour}
        />
      </Sequence>

      {/* Scene 3: Value propositions */}
      <Sequence
        from={logoFrames + taglineFrames}
        durationInFrames={valueFrames}
      >
        <ValuePropScene valueProps={valueProps} brandColour={brandColour} />
      </Sequence>

      {/* Scene 4: CTA + end card */}
      <Sequence
        from={logoFrames + taglineFrames + valueFrames}
        durationInFrames={ctaFrames}
      >
        <CTAScene
          brandName={title}
          websiteUrl={websiteUrl}
          brandColour={brandColour}
          logoUrl={logoUrl}
        />
      </Sequence>
    </AbsoluteFill>
  );
}
