/**
 * SYN-1404 ccw-w1-d1-pm, concept A "Quiet on paper": the world, built on the
 * owned job photo carpet-cleaning-extraction-01 (wet tiles, work boots,
 * extractor). The scene image is a tight crop of that photo, resized with
 * lanczos + unsharp (no AI), prepared into the render work folder.
 *
 * Hero frame = the turn: "QUIET ON PAPER" lies flat on the wet tiles, the
 * camera pushes over it and a water ripple breaks the letters; the spoken line
 * "Quiet does not mean dry." is the kinetic type. The source sits on the floor
 * as a printed slip. Text boxes carry className="ccw-text" for the safe-zone
 * mask check.
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
import { CCW, TEXT_MASK_CSS } from './CcwShortform';

const FONT =
  '"Helvetica Neue", "Arial Black", Arial, system-ui, -apple-system, sans-serif';

export type CcwPmWorldProps = {
  /** Prepared scene image under the public dir (1188x2112). */
  scene: string;
  floorLines: string[];
  kinetic: string[];
  sourceSlip: string;
  /** 0 to 1: how far the turn ripple has gone at the end of the clip. */
  rippleTo: number;
  /** Render text boxes white on black for the safe-zone check. */
  textMask?: boolean;
};

export const CcwPmWorld: React.FC<CcwPmWorldProps> = ({
  scene,
  floorLines,
  kinetic,
  sourceSlip,
  rippleTo,
  textMask,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const p = durationInFrames > 1 ? frame / (durationInFrames - 1) : 0;
  const ease = (x: number) => 1 - Math.pow(1 - x, 3);
  // Camera: slow low push forward over the floor (photo moves most).
  const push = interpolate(ease(p), [0, 1], [1.0, 1.1]);
  // Floor type slides toward the lens as the camera passes over it.
  const floorY = interpolate(ease(p), [0, 1], [0, 70]);
  const ripple = interpolate(p, [0.35, 1], [0, rippleTo], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const t = frame / fps;

  return (
    <AbsoluteFill
      className="ccw-root"
      style={{ background: '#cfd4d4', overflow: 'hidden' }}
    >
      {textMask ? <style>{TEXT_MASK_CSS}</style> : null}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <filter id="ccw-ripple" x="-10%" y="-30%" width="120%" height="160%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.005 0.022"
            numOctaves={2}
            seed={3 + Math.floor(t * 4)}
            result="n"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="n"
            scale={ripple * 70}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </svg>

      {/* The real wet-tile room. */}
      <Img
        src={staticFile(scene)}
        style={{
          position: 'absolute',
          width: 1188,
          height: 2112,
          left: -54,
          top: -96,
          transform: `scale(${push})`,
          transformOrigin: '50% 62%',
        }}
      />

      {/* Floor plane: type and the source slip lie flat on the tiles. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 690,
          height: 430,
          perspective: 900,
          perspectiveOrigin: '50% -40%',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 96,
            top: 0,
            transform: `translateY(${floorY}px) rotateX(58deg) rotateZ(-5deg)`,
            transformOrigin: '50% 100%',
          }}
        >
          {/* Printed slip on the floor carrying the source. */}
          <div
            className="ccw-text"
            style={{
              marginBottom: 22,
              marginLeft: 14,
              width: 'max-content',
              fontFamily: FONT,
              fontWeight: 700,
              fontSize: 34,
              color: CCW.ink,
              background: '#fbfaf6',
              padding: '10px 18px',
              boxShadow: '0 6px 10px rgba(30,40,50,0.25)',
              transform: 'rotateZ(2deg)',
            }}
          >
            {sourceSlip}
          </div>
          <div style={{ filter: 'url(#ccw-ripple)' }}>
            {floorLines.map((l, i) => (
              <div
                key={l}
                className="ccw-text"
                style={{
                  fontFamily: FONT,
                  fontWeight: 900,
                  fontSize: 188,
                  lineHeight: 0.86,
                  letterSpacing: -7,
                  width: 'max-content',
                  color:
                    i === floorLines.length - 1
                      ? 'rgba(243,114,21,0.92)'
                      : 'rgba(255,255,255,0.94)',
                  textShadow: '0 0 1px rgba(0,0,0,0.25)',
                }}
              >
                {l}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Kinetic line: Margot's words as the type itself. */}
      <div style={{ position: 'absolute', left: 84, right: 84, top: 300 }}>
        {kinetic.map((w, i) => {
          const at = 0.08 + i * 0.07;
          const k = interpolate(p, [at, at + 0.12], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <span
              key={`${w}-${i}`}
              className="ccw-text"
              style={{
                display: 'inline-block',
                marginRight: 22,
                fontFamily: FONT,
                fontWeight: 900,
                fontSize: 104,
                lineHeight: 1.02,
                letterSpacing: -3,
                color: i === kinetic.length - 1 ? CCW.orange : CCW.paper,
                textShadow: '0 4px 18px rgba(10,20,40,0.45)',
                opacity: k,
                transform: `translateY(${(1 - ease(k)) * 40}px)`,
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
