/**
 * Definition Card Composition
 *
 * A landscape (16:9) marketing term definition video.
 * Features:
 * - Large term displayed prominently
 * - Definition revealed below with animation
 * - Optional usage example
 * - Clean, educational aesthetic
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
import type { DefinitionCardProps } from '../types';

// ── Definition Card Composition ───────────────────────────────────────────────

export function DefinitionCard({
  term,
  definition,
  example,
  brandColour = '#f59e0b',
}: DefinitionCardProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Term intro title card duration
  const INTRO_DURATION = 45;

  // Term entrance spring
  const termSpring = spring({
    frame: Math.max(0, frame - INTRO_DURATION),
    fps,
    config: { damping: 20, stiffness: 90, mass: 0.8 },
    durationInFrames: 30,
  });
  const termScale = interpolate(termSpring, [0, 1], [0.8, 1]);
  const termOpacity = interpolate(termSpring, [0, 0.2], [0, 1]);

  // Definition fades in after term
  const definitionOpacity = interpolate(
    frame,
    [INTRO_DURATION + 35, INTRO_DURATION + 60],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  const definitionY = interpolate(
    frame,
    [INTRO_DURATION + 35, INTRO_DURATION + 60],
    [20, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  // Example fades in last
  const exampleOpacity = interpolate(
    frame,
    [INTRO_DURATION + 90, INTRO_DURATION + 120],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  // Underline grows to full width
  const underlineWidth = interpolate(
    frame,
    [INTRO_DURATION + 5, INTRO_DURATION + 35],
    [0, 100],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  // Fade out near end
  const fadeOut = interpolate(frame, [570, 600], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0F172A', opacity: fadeOut }}>
      {/* Intro card — "Define:" label */}
      <Sequence from={0} durationInFrames={INTRO_DURATION}>
        <AbsoluteFill
          style={{
            backgroundColor: '#1E293B',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              color: brandColour,
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: 6,
              textTransform: 'uppercase',
            }}
          >
            Marketing Term
          </span>
        </AbsoluteFill>
      </Sequence>

      {/* Main definition content */}
      <Sequence from={INTRO_DURATION} durationInFrames={600 - INTRO_DURATION}>
        <AbsoluteFill
          style={{
            backgroundColor: '#0F172A',
            justifyContent: 'center',
            padding: '60px 120px',
            flexDirection: 'column',
          }}
        >
          {/* Noun label */}
          <div style={{ marginBottom: 12 }}>
            <span
              style={{
                color: 'rgba(255,255,255,0.4)',
                fontSize: 18,
                fontStyle: 'italic',
                fontWeight: 400,
              }}
            >
              noun
            </span>
          </div>

          {/* Term */}
          <div
            style={{
              transform: `scale(${termScale})`,
              transformOrigin: 'left center',
              opacity: termOpacity,
              marginBottom: 12,
            }}
          >
            <h1
              style={{
                color: '#FFFFFF',
                fontSize: 72,
                fontWeight: 900,
                margin: 0,
                lineHeight: 1.1,
              }}
            >
              {term}
            </h1>
          </div>

          {/* Cyan underline */}
          <div
            style={{
              width: `${underlineWidth}%`,
              height: 4,
              backgroundColor: brandColour,
              borderRadius: 2,
              marginBottom: 36,
            }}
          />

          {/* Definition */}
          <div
            style={{
              transform: `translateY(${definitionY}px)`,
              opacity: definitionOpacity,
              marginBottom: example ? 28 : 0,
            }}
          >
            <p
              style={{
                color: 'rgba(255,255,255,0.85)',
                fontSize: 30,
                lineHeight: 1.6,
                margin: 0,
                maxWidth: 1000,
              }}
            >
              {definition}
            </p>
          </div>

          {/* Example */}
          {example && (
            <div
              style={{
                opacity: exampleOpacity,
                borderLeft: `4px solid ${brandColour}`,
                paddingLeft: 24,
                marginLeft: 4,
              }}
            >
              <span
                style={{
                  color: brandColour,
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  display: 'block',
                  marginBottom: 8,
                }}
              >
                Example
              </span>
              <p
                style={{
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: 24,
                  lineHeight: 1.5,
                  margin: 0,
                  fontStyle: 'italic',
                }}
              >
                {example}
              </p>
            </div>
          )}

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
