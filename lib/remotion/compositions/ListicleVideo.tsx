/**
 * Listicle Video Composition
 *
 * A landscape (16:9) numbered list reveal video.
 * Features:
 * - Title card entrance
 * - Up to 5 list items revealed with staggered animation
 * - Each item slides in from the right with a delay
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
import type { ListicleVideoProps } from '../types';

// ── List Item Component ───────────────────────────────────────────────────────

function ListItem({
  index,
  text,
  brandColour,
  frame,
  fps,
  revealFrame,
}: {
  index: number;
  text: string;
  brandColour: string;
  frame: number;
  fps: number;
  revealFrame: number;
}) {
  const slideIn = spring({
    frame: Math.max(0, frame - revealFrame),
    fps,
    config: { damping: 22, stiffness: 80, mass: 0.8 },
    durationInFrames: 30,
  });

  const translateX = interpolate(slideIn, [0, 1], [120, 0]);
  const opacity = interpolate(slideIn, [0, 0.2], [0, 1]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 28,
        transform: `translateX(${translateX}px)`,
        opacity,
        marginBottom: 28,
      }}
    >
      {/* Number badge */}
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          backgroundColor: brandColour,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            color: '#FFFFFF',
            fontSize: 24,
            fontWeight: 800,
          }}
        >
          {index + 1}
        </span>
      </div>

      {/* Item text */}
      <p
        style={{
          color: '#FFFFFF',
          fontSize: 30,
          fontWeight: 500,
          lineHeight: 1.4,
          margin: 0,
          paddingTop: 10,
        }}
      >
        {text}
      </p>
    </div>
  );
}

// ── Listicle Video Composition ────────────────────────────────────────────────

export function ListicleVideo({
  title,
  items,
  brandColour = '#f59e0b',
}: ListicleVideoProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Clamp to max 5 items
  const displayItems = items.slice(0, 5);

  // Title card duration: 60 frames
  const TITLE_DURATION = 60;
  // Each item revealed every 120 frames after title
  const ITEM_INTERVAL = 140;

  // Title fade in
  const titleScale = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 100 },
    durationInFrames: 30,
  });

  // Fade out near end
  const fadeOut = interpolate(frame, [860, 900], [1, 0], {
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
          }}
        >
          <h1
            style={{
              color: '#FFFFFF',
              fontSize: 64,
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

      {/* List content */}
      <Sequence from={TITLE_DURATION} durationInFrames={900 - TITLE_DURATION}>
        <AbsoluteFill
          style={{
            backgroundColor: '#0F172A',
            justifyContent: 'center',
            padding: '60px 120px',
          }}
        >
          {/* Section heading */}
          <div style={{ marginBottom: 40 }}>
            <span
              style={{
                color: brandColour,
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: 3,
                textTransform: 'uppercase',
              }}
            >
              Key Takeaways
            </span>
          </div>

          {/* List items */}
          {displayItems.map((item, i) => (
            <ListItem
              key={i}
              index={i}
              text={item}
              brandColour={brandColour}
              frame={frame - TITLE_DURATION}
              fps={fps}
              revealFrame={i * ITEM_INTERVAL}
            />
          ))}

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
