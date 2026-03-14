'use client';

/**
 * Explainer Video Composition
 *
 * A landscape (16:9) explainer video with scene transitions.
 * Features:
 * - Multi-scene with fade/slide/zoom transitions
 * - Voiceover caption track
 * - Brand colour accents
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
import type { ExplainerVideoProps, SceneProps } from '../types';

// ── Transition Wrapper ───────────────────────────────────────────────────────

function TransitionWrapper({
  children,
  transition = 'fade',
  durationFrames,
}: {
  children: React.ReactNode;
  transition: 'fade' | 'slide' | 'zoom';
  durationFrames: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterFrames = Math.min(15, durationFrames / 4);
  const exitStart = durationFrames - enterFrames;

  const enterOpacity = interpolate(frame, [0, enterFrames], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const exitOpacity = interpolate(frame, [exitStart, durationFrames], [1, 0], {
    extrapolateLeft: 'clamp',
  });

  const opacity = Math.min(enterOpacity, exitOpacity);

  let transform = '';
  if (transition === 'slide') {
    const slideX = interpolate(frame, [0, enterFrames], [80, 0], {
      extrapolateRight: 'clamp',
    });
    transform = `translateX(${slideX}px)`;
  } else if (transition === 'zoom') {
    const scale = spring({
      frame,
      fps,
      config: { damping: 20, stiffness: 100 },
    });
    transform = `scale(${scale})`;
  }

  return (
    <AbsoluteFill style={{ opacity, transform }}>
      {children}
    </AbsoluteFill>
  );
}

// ── Explainer Scene ──────────────────────────────────────────────────────────

function ExplainerScene({
  scene,
  sceneIndex,
  totalScenes,
  brandColour,
  transition,
}: {
  scene: SceneProps;
  sceneIndex: number;
  totalScenes: number;
  brandColour: string;
  transition: 'fade' | 'slide' | 'zoom';
}) {
  const bg = scene.backgroundColour || (sceneIndex % 2 === 0 ? '#0F172A' : '#1E293B');

  return (
    <TransitionWrapper transition={transition} durationFrames={scene.duration}>
      <AbsoluteFill
        style={{
          backgroundColor: bg,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 80,
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
              opacity: 0.15,
            }}
          />
        )}

        {/* Scene counter */}
        <div
          style={{
            position: 'absolute',
            top: 40,
            left: 60,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            zIndex: 2,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: brandColour,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              fontSize: 14,
              fontWeight: 700,
              color: '#FFFFFF',
            }}
          >
            {sceneIndex + 1}
          </div>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
            of {totalScenes}
          </span>
        </div>

        {/* Content */}
        <div style={{ textAlign: 'center', zIndex: 1, maxWidth: 1200 }}>
          <h2
            style={{
              color: '#FFFFFF',
              fontSize: 48,
              fontWeight: 700,
              lineHeight: 1.3,
              margin: 0,
            }}
          >
            {scene.text}
          </h2>

          {scene.subtitle && (
            <p
              style={{
                color: 'rgba(255,255,255,0.6)',
                fontSize: 24,
                marginTop: 24,
                lineHeight: 1.5,
              }}
            >
              {scene.subtitle}
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
    </TransitionWrapper>
  );
}

// ── Main Composition ─────────────────────────────────────────────────────────

export function ExplainerVideo({
  title,
  scenes,
  brandColour = '#06B6D4',
  transition = 'fade',
  voiceoverScript,
}: ExplainerVideoProps) {
  let frameOffset = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#0F172A' }}>
      {/* Title card */}
      <Sequence from={0} durationInFrames={60}>
        <AbsoluteFill
          style={{
            backgroundColor: brandColour,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <h1
            style={{
              color: '#FFFFFF',
              fontSize: 64,
              fontWeight: 800,
              textAlign: 'center',
              maxWidth: 1000,
            }}
          >
            {title}
          </h1>
        </AbsoluteFill>
      </Sequence>

      {/* Content scenes */}
      {scenes.map((scene, i) => {
        const from = 60 + frameOffset;
        frameOffset += scene.duration;
        return (
          <Sequence key={i} from={from} durationInFrames={scene.duration}>
            <ExplainerScene
              scene={scene}
              sceneIndex={i}
              totalScenes={scenes.length}
              brandColour={brandColour}
              transition={transition}
            />
          </Sequence>
        );
      })}

      {/* Voiceover caption overlay */}
      {voiceoverScript && (
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            left: 60,
            right: 60,
            backgroundColor: 'rgba(0,0,0,0.7)',
            borderRadius: 12,
            padding: '12px 20px',
            zIndex: 10,
          }}
        >
          <p
            style={{
              color: '#FFFFFF',
              fontSize: 18,
              margin: 0,
              textAlign: 'center',
            }}
          >
            {voiceoverScript}
          </p>
        </div>
      )}
    </AbsoluteFill>
  );
}
