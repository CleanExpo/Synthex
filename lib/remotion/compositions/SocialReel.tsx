'use client';

/**
 * Social Reel Composition
 *
 * A branded social media reel (9:16 portrait by default).
 * Features:
 * - Scene-based with text overlay and colour transitions
 * - Animated title entrance
 * - Optional progress bar
 * - Brand colour accent
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
} from 'remotion';
import type { SocialReelProps, SceneProps } from '../types';

// ── Scene Component ──────────────────────────────────────────────────────────

function Scene({
  scene,
  brandColour,
}: {
  scene: SceneProps;
  brandColour: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade in over 10 frames
  const opacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Scale entrance with spring
  const scale = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 120 },
  });

  const bg = scene.backgroundColour || brandColour;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bg,
        opacity,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 60,
      }}
    >
      {scene.imageUrl && (
        <img
          src={scene.imageUrl}
          alt=""
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.3,
          }}
        />
      )}

      <div
        style={{
          transform: `scale(${scale})`,
          textAlign: 'center',
          zIndex: 1,
        }}
      >
        <h2
          style={{
            color: '#FFFFFF',
            fontSize: 56,
            fontWeight: 700,
            lineHeight: 1.2,
            textShadow: '0 4px 20px rgba(0,0,0,0.5)',
            margin: 0,
          }}
        >
          {scene.text}
        </h2>

        {scene.subtitle && (
          <p
            style={{
              color: 'rgba(255,255,255,0.8)',
              fontSize: 28,
              marginTop: 20,
              fontWeight: 400,
            }}
          >
            {scene.subtitle}
          </p>
        )}
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
          transition: 'width 0.1s linear',
        }}
      />
    </div>
  );
}

// ── Main Composition ─────────────────────────────────────────────────────────

export function SocialReel({
  title,
  scenes,
  brandColour = '#06B6D4', // cyan-500
  showProgress = true,
}: SocialReelProps) {
  let frameOffset = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>
      {/* Title card — first 30 frames */}
      <Sequence from={0} durationInFrames={30}>
        <Scene
          scene={{ text: title, duration: 30, backgroundColour: brandColour }}
          brandColour={brandColour}
        />
      </Sequence>

      {/* Content scenes */}
      {scenes.map((scene, i) => {
        const from = 30 + frameOffset;
        frameOffset += scene.duration;
        return (
          <Sequence key={i} from={from} durationInFrames={scene.duration}>
            <Scene scene={scene} brandColour={brandColour} />
          </Sequence>
        );
      })}

      {/* Progress bar overlay */}
      {showProgress && <ProgressBar brandColour={brandColour} />}
    </AbsoluteFill>
  );
}
