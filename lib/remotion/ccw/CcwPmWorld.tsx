/**
 * SYN-1404 ccw-w1-d1-pm, concept A "Quiet on paper": the world, built on
 * owned job photos (wet tiles, work boots, extractor; carpet extraction; the
 * van). Each scene image is a tight crop of the photo, resized with lanczos +
 * unsharp (no AI), prepared into the render work folder by
 * scripts/render-ccw-shortform.ts.
 *
 * Type lies flat on the floor plane and the camera pushes low over it; at the
 * turn a water ripple breaks the letters and the spoken line "Quiet does not
 * mean dry." is the kinetic type. The source sits on the floor as a printed
 * slip. With no floor lines it is a plain 2.5D push over the photo. Text boxes
 * carry className="ccw-text" for the safe-zone mask check.
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
import { CCW, TEXT_MASK_CSS } from './brand';

const FONT =
  '"Helvetica Neue", "Arial Black", Arial, system-ui, -apple-system, sans-serif';

export type CcwPmWorldProps = {
  /** Prepared scene image under the public dir (1188x2112). */
  scene: string;
  floorLines?: string[];
  /** Floor type size in px. */
  floorSize?: number;
  kinetic?: string[];
  sourceSlip?: string;
  /** 0 to 1: how far the turn ripple has gone at the end of the clip. */
  rippleTo?: number;
  /** Fraction of the clip at which the ripple starts. */
  rippleFrom?: number;
  /** Hook: floor type slams onto the floor in 0.3 s with a camera jolt and splash ripple. */
  slam?: boolean;
  /**
   * A product cut-out (white keyed out by the render script) set on the
   * floor, with a contact shadow that follows its outline.
   */
  product?: { src: string; x: number; y: number; w: number };
  /** Render text boxes white on black for the safe-zone check. */
  textMask?: boolean;
  /** Owned product cut-outs standing on the floor (prepared PNGs). */
  place?: {
    src: string;
    x: number;
    y: number;
    w: number;
    flip?: boolean;
    at?: number;
    clipBottom?: number;
    silhouette?: boolean;
  }[];
};

export const CcwPmWorld: React.FC<CcwPmWorldProps> = ({
  scene,
  floorLines = [],
  floorSize = 188,
  kinetic = [],
  sourceSlip,
  rippleTo = 0,
  rippleFrom = 0.35,
  slam,
  product,
  textMask,
  place = [],
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const p = durationInFrames > 1 ? frame / (durationInFrames - 1) : 0;
  const ease = (x: number) => 1 - Math.pow(1 - x, 3);
  // Camera: slow low push forward over the floor (photo moves most).
  const push = interpolate(ease(p), [0, 1], [1.0, 1.1]);
  // Floor type slides toward the lens as the camera passes over it.
  const floorY = interpolate(ease(p), [0, 1], [0, 70]);
  const t0 = frame / fps;
  // Slam: type drops from above the lens and hits the floor at 0.3 s.
  const hit = slam
    ? interpolate(t0, [0, 0.3], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;
  const sinceHit = Math.max(0, t0 - 0.3);
  const jolt = slam && t0 >= 0.3 ? Math.exp(-sinceHit * 9) : 0;
  const shakeY = jolt * 18 * Math.sin(sinceHit * 60);
  const splash = slam ? jolt * 0.5 : 0;
  const ripple =
    splash > 0.01
      ? splash
      : rippleTo > 0
        ? interpolate(p, [rippleFrom, 1], [0, rippleTo], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
        : 0;
  const t = frame / fps;
  // Floor type settles onto the floor in the first 0.4 s (or slams in).
  const land = slam
    ? 1
    : interpolate(t, [0, 0.4], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
  const dropY = slam ? (1 - hit * hit) * -160 : 0;
  const dropScale = 1;

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

      {/* The real room. */}
      <Img
        src={staticFile(scene)}
        style={{
          position: 'absolute',
          width: 1188,
          height: 2112,
          left: -54,
          top: -96,
          transform: `translateY(${shakeY}px) scale(${push})`,
          transformOrigin: '50% 62%',
        }}
      />

      {/* Owned products standing on the floor. The layer shares the photo's
          push and shake (same origin on screen), so the units stay planted.
          A unit is flat on the carpet with its contact shadow from its first
          visible frame: no fade and no drop (orchestrator rule 6c). `at`
          only delays when it cuts in. */}
      {place.length ? (
        <AbsoluteFill
          style={{
            transform: `translateY(${shakeY}px) scale(${push})`,
            transformOrigin: '540px 1213.44px',
          }}
        >
          {place.map((u, i) => {
            if (t < (u.at ?? 0)) return null;
            // Optional crop of the cut-out's bottom (a dangling cord).
            const clip = (u.clipBottom ?? 0) * u.w;
            const box = {
              position: 'absolute' as const,
              left: u.x - u.w / 2,
              top: u.y - u.w + clip,
              width: u.w,
              height: u.w,
              objectFit: 'contain' as const,
              objectPosition: '50% 100%',
              clipPath: clip ? `inset(0 0 ${clip}px 0)` : undefined,
            };
            return (
              <React.Fragment key={`${u.src}-${i}`}>
                {/* Optional silhouette shadow: the unit's own outline, dark,
                    blurred and nudged down, so an angled unit is dark along
                    its whole bottom edge, not only under its centre. */}
                {u.silhouette ? (
                  <Img
                    src={staticFile(u.src)}
                    style={{
                      ...box,
                      filter: `brightness(0) blur(${Math.round(u.w * 0.012)}px)`,
                      opacity: 0.75,
                      transform: `translateY(${u.w * 0.022}px) scaleX(${u.flip ? -1 : 1})`,
                    }}
                  />
                ) : null}
                {/* Soft ambient shadow, wider than the unit. */}
                <div
                  style={{
                    position: 'absolute',
                    left: u.x - u.w * 0.6,
                    top: u.y - u.w * 0.08,
                    width: u.w * 1.2,
                    height: u.w * 0.16,
                    borderRadius: '50%',
                    background:
                      'radial-gradient(closest-side, rgba(20,16,12,0.55), rgba(20,16,12,0))',
                  }}
                />
                {/* Tight, dark contact shadow right under the base. */}
                <div
                  style={{
                    position: 'absolute',
                    left: u.x - u.w * 0.44,
                    top: u.y - u.w * 0.035,
                    width: u.w * 0.88,
                    height: u.w * 0.06,
                    borderRadius: '50%',
                    background:
                      'radial-gradient(closest-side, rgba(12,10,8,0.95), rgba(12,10,8,0.6) 60%, rgba(12,10,8,0))',
                  }}
                />
                <Img
                  src={staticFile(u.src)}
                  style={{
                    ...box,
                    filter: 'saturate(0.92) brightness(0.96) sepia(0.06)',
                    transform: `scaleX(${u.flip ? -1 : 1})`,
                  }}
                />
              </React.Fragment>
            );
          })}
        </AbsoluteFill>
      ) : null}

      {product ? (
        <div
          style={{
            position: 'absolute',
            left: product.x,
            top: product.y,
            width: product.w,
            transform: `translateY(${shakeY}px) scale(${push})`,
            transformOrigin: '50% 100%',
          }}
        >
          <Img
            src={staticFile(product.src)}
            style={{
              width: '100%',
              display: 'block',
              filter: 'drop-shadow(0 22px 14px rgba(20,25,30,0.45))',
            }}
          />
        </div>
      ) : null}

      {/* Floor plane: type and the source slip lie flat on the floor. */}
      {floorLines.length ? (
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
              opacity: slam ? Math.min(1, hit * 1.6) : land,
              transform: `translateY(${floorY + (1 - land) * -60 + dropY + shakeY}px) scale(${dropScale}) rotateX(58deg) rotateZ(-5deg)`,
              transformOrigin: '50% 100%',
            }}
          >
            {sourceSlip ? (
              <div
                className="ccw-text"
                style={{
                  marginBottom: 22,
                  marginLeft: 14,
                  width: 'max-content',
                  fontFamily: FONT,
                  fontWeight: 700,
                  fontSize: 38,
                  color: CCW.ink,
                  background: '#fbfaf6',
                  padding: '10px 18px',
                  boxShadow: '0 6px 10px rgba(30,40,50,0.25)',
                  transform: 'rotateZ(2deg)',
                }}
              >
                {sourceSlip}
              </div>
            ) : null}
            <div style={{ filter: ripple > 0 ? 'url(#ccw-ripple)' : 'none' }}>
              {floorLines.map((l, i) => (
                <div
                  key={l}
                  className="ccw-text"
                  style={{
                    fontFamily: FONT,
                    fontWeight: 900,
                    fontSize: floorSize,
                    lineHeight: 0.86,
                    letterSpacing: -7,
                    width: 'max-content',
                    color:
                      i === floorLines.length - 1
                        ? 'rgba(243,114,21,0.92)'
                        : 'rgba(255,255,255,0.94)',
                    textShadow:
                      '0 2px 2px rgba(0,0,0,0.55), 0 8px 18px rgba(0,0,0,0.45)',
                  }}
                >
                  {l}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Kinetic line: Margot's words as the type itself, word by word. */}
      {kinetic.length ? (
        <div style={{ position: 'absolute', left: 84, right: 84, top: 300 }}>
          {kinetic.map((w, i) => {
            const at = 0.05 + i * 0.24;
            const k = interpolate(t, [at, at + 0.22], [0, 1], {
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
      ) : null}
    </AbsoluteFill>
  );
};
