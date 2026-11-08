/**
 * SYN-1404 ccw-w1-d1-pm, concept A "Quiet on paper": the world, built on the
 * owned job photo carpet-cleaning-extraction-01 (wet tiles, work boots).
 *
 * Hero frame = the turn: "QUIET ON PAPER" stands on the wet tiles with its
 * reflection in the water, the camera low and pushing in. Type is real DOM
 * text in 3D space (perspective), never a flat card. Every text box carries
 * className="ccw-text" so the render safe-zone check can mask it.
 */

import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { CCW } from './CcwShortform';

const FONT =
  '"Helvetica Neue", "Arial Black", Arial, system-ui, -apple-system, sans-serif';

export type CcwPmWorldProps = {
  /** Photo path under public/ (owned reference library). */
  scene: string;
  lines: string[];
  sourceTag: string;
  caption: string;
};

export const CcwPmWorld: React.FC<CcwPmWorldProps> = ({
  scene,
  lines,
  sourceTag,
  caption,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = durationInFrames > 1 ? frame / (durationInFrames - 1) : 0;
  // Slow low push-in: the photo moves more than the type (2.5D parallax).
  const push = interpolate(p, [0, 1], [1, 1.08]);
  const drift = interpolate(p, [0, 1], [0, -30]);

  return (
    <AbsoluteFill style={{ background: '#d9dcdc', overflow: 'hidden' }}>
      {/* Back plate: the real wet-tile room, cropped tall around the boots. */}
      <Img
        src={staticFile(scene)}
        style={{
          position: 'absolute',
          height: 1960,
          left: -1700 + drift,
          top: -40,
          transform: `scale(${push})`,
          transformOrigin: '70% 75%',
          filter: 'brightness(1.06) saturate(0.95)',
        }}
      />
      {/* Cool light falling across the wet floor, warmer up high. */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(255,250,240,0.18) 0%, rgba(255,255,255,0) 40%, rgba(120,170,210,0.16) 100%)',
        }}
      />

      {/* Type standing on the tiles, in perspective, with reflection. */}
      <div
        style={{
          position: 'absolute',
          left: 84,
          right: 84,
          top: 900,
          perspective: 1400,
          perspectiveOrigin: '30% 100%',
        }}
      >
        <div
          style={{
            transform: `rotateY(${interpolate(p, [0, 1], [16, 10])}deg) translateZ(${interpolate(p, [0, 1], [0, 60])}px)`,
            transformOrigin: 'left bottom',
          }}
        >
          {lines.map((l, i) => (
            <div
              key={l}
              className="ccw-text"
              style={{
                fontFamily: FONT,
                fontWeight: 900,
                fontSize: 176,
                lineHeight: 0.9,
                letterSpacing: -6,
                color: i === lines.length - 1 ? CCW.orange : CCW.paper,
                textShadow:
                  '0 2px 0 rgba(0,0,0,0.08), 0 30px 40px rgba(20,40,60,0.35)',
                width: 'max-content',
              }}
            >
              {l}
            </div>
          ))}
          {/* Reflection in the wet tiles (decorative, not counted as text). */}
          <div
            aria-hidden
            style={{
              // Flip in place, then squash toward the text's baseline.
              transform: 'translateY(-22%) scaleY(-0.55)',
              transformOrigin: 'center',
              opacity: 0.5,
              filter: 'blur(2px)',
              marginTop: 6,
              maskImage:
                'linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,1) 100%)',
              WebkitMaskImage:
                'linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,1) 100%)',
            }}
          >
            {/* The flip reverses the order, so the last line sits nearest the text. */}
            {lines.map((l, i) => (
              <div
                key={l}
                style={{
                  fontFamily: FONT,
                  fontWeight: 900,
                  fontSize: 176,
                  lineHeight: 0.9,
                  letterSpacing: -6,
                  color: i === lines.length - 1 ? CCW.orange : CCW.paper,
                  width: 'max-content',
                }}
              >
                {l}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Source tag, in the scene's top-left, small. */}
      <div
        className="ccw-text"
        style={{
          position: 'absolute',
          left: 84,
          top: 300,
          fontFamily: FONT,
          fontWeight: 600,
          fontSize: 30,
          color: CCW.ink,
          background: 'rgba(255,255,255,0.82)',
          padding: '8px 14px',
          borderRadius: 6,
        }}
      >
        {sourceTag}
      </div>

      {/* Caption: Margot's words, above the bottom UI zone. */}
      <div
        style={{
          position: 'absolute',
          left: 84,
          right: 84,
          top: 372,
          textAlign: 'left',
        }}
      >
        <span
          className="ccw-text"
          style={{
            fontFamily: FONT,
            fontWeight: 800,
            fontSize: 54,
            color: CCW.paper,
            background: 'rgba(35,31,32,0.78)',
            padding: '10px 22px',
            borderRadius: 12,
          }}
        >
          {caption}
        </span>
      </div>
    </AbsoluteFill>
  );
};
