/**
 * Motion Studio composition — Claude-Motion-style motion graphics in the
 * brand's house style (lib/motion). One component, three aspect ratios.
 *
 * Built only from props: the brief's own words and numbers, the brand's
 * BrandConfig colour/type/motion tokens. Real photos come in M2 (owned library only).
 * Rules from the Motion research: one hero element per beat at 60–70% of the
 * frame, nothing moves linearly, labels never below the house minimum, every
 * beat enters with the brand's signature move, and the video ends on the CTA.
 */

import { useEffect, useState } from 'react';
import {
  AbsoluteFill,
  Easing,
  Sequence,
  continueRender,
  delayRender,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type { MotionBeat, MotionStudioProps } from '../types';

function bezier(css: string): (t: number) => number {
  const n = css.match(/-?\d*\.?\d+/g)?.map(Number);
  return n && n.length === 4
    ? Easing.bezier(n[0], n[1], n[2], n[3])
    : Easing.out(Easing.cubic);
}

/** The brand's signature entrance, driven by its own easing and duration. */
function useEntrance(start: number, props: MotionStudioProps) {
  const frame = useCurrentFrame();
  const t = interpolate(
    frame,
    [start, start + props.style.baseFrames],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: bezier(props.style.easingIn),
    }
  );
  const sig = props.style.signature;
  const transform =
    sig === 'rise'
      ? `translateY(${(1 - t) * 80}px)`
      : sig === 'sweep'
        ? `translateX(${(1 - t) * -200}px)`
        : sig === 'pulse'
          ? `scale(${0.85 + 0.15 * t})`
          : sig === 'whip'
            ? `translateX(${(1 - t) * 400}px) skewX(${(1 - t) * -12}deg)`
            : 'none';
  const clipPath =
    sig === 'iris' ? `circle(${t * 150}% at 50% 50%)` : undefined;
  // Start at 35% so a beat is never an empty frame while it enters.
  return { opacity: 0.35 + 0.65 * t, transform, clipPath };
}

/** Load the brand's own font files before the first frame renders. */
function useBrandFonts(style: MotionStudioProps['style']) {
  const [handle] = useState(() => delayRender('Loading brand fonts'));
  useEffect(() => {
    const faces = [
      [style.displayFont, style.displayFontSrc, style.displayWeight],
      [style.bodyFont, style.bodyFontSrc, style.bodyWeight],
    ].filter((f): f is [string, string, number | undefined] => Boolean(f[1]));
    Promise.all(
      faces.map(([family, src, weight]) =>
        new FontFace(family, `url(${staticFile(src)})`, {
          weight: String(weight ?? 400),
        })
          .load()
          .then(face => document.fonts.add(face))
      )
    )
      .catch(() => undefined) // a missing file falls back; the critique step catches it
      .finally(() => continueRender(handle));
  }, [handle, style]);
}

function Beat({
  beat,
  props,
  portrait,
}: {
  beat: MotionBeat;
  props: MotionStudioProps;
  portrait: boolean;
}) {
  const { style } = props;
  const hero = portrait ? 132 : 150;
  const label = Math.max(style.minLabelPx, portrait ? 52 : 46);
  const e1 = useEntrance(0, props);
  const e2 = useEntrance(style.fastFrames, props);
  const e3 = useEntrance(style.fastFrames * 2, props);
  const heroStyle = {
    fontFamily: style.displayFont,
    color: style.text,
    fontWeight: style.displayWeight ?? 800,
    lineHeight: 1.05,
    textWrap: 'balance',
  } as React.CSSProperties;
  const labelStyle = {
    fontFamily: style.bodyFont,
    color: style.text,
    opacity: 0.85,
    fontSize: label,
    lineHeight: 1.25,
  };

  switch (beat.kind) {
    case 'headline':
      return (
        <div
          style={{
            ...e1,
            ...heroStyle,
            fontSize: hero * 0.72,
            maxWidth: '86%',
          }}
        >
          {beat.text}
        </div>
      );
    case 'stat':
      return (
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              ...e1,
              ...heroStyle,
              fontSize: hero * 1.6,
              color: style.accent,
            }}
          >
            {beat.value}
          </div>
          <div
            style={{
              ...e2,
              ...labelStyle,
              fontSize: label * 1.3,
              marginTop: 24,
            }}
          >
            {beat.label}
          </div>
          {beat.context && (
            <div style={{ ...e3, ...labelStyle, marginTop: 18 }}>
              {beat.context}
            </div>
          )}
        </div>
      );
    case 'compare':
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: portrait ? 'column' : 'row',
            gap: 48,
            width: '86%',
          }}
        >
          <div
            style={{
              ...e1,
              flex: 1,
              padding: 48,
              borderRadius: 28,
              background: 'rgba(255,255,255,0.06)',
            }}
          >
            <div style={{ ...labelStyle, opacity: 0.6 }}>{beat.oldLabel}</div>
            <div
              style={{
                ...heroStyle,
                fontSize: hero * 0.42,
                opacity: 0.55,
                marginTop: 16,
              }}
            >
              {beat.oldText}
            </div>
          </div>
          <div
            style={{
              ...e2,
              flex: 1,
              padding: 48,
              borderRadius: 28,
              background: style.primary,
              boxShadow: `0 30px 80px ${style.primary}66`,
            }}
          >
            <div style={{ ...labelStyle, opacity: 0.9 }}>{beat.newLabel}</div>
            <div style={{ ...heroStyle, fontSize: hero * 0.42, marginTop: 16 }}>
              {beat.newText}
            </div>
          </div>
        </div>
      );
    case 'item':
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 48,
            maxWidth: '86%',
          }}
        >
          <div
            style={{
              ...e1,
              ...heroStyle,
              fontSize: hero * 1.1,
              color: style.accent,
              minWidth: hero,
            }}
          >
            {beat.index}
          </div>
          <div style={{ ...e2, ...heroStyle, fontSize: hero * 0.5 }}>
            {beat.text}
          </div>
        </div>
      );
    case 'cta':
      return (
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              ...e1,
              ...heroStyle,
              fontSize: hero * 0.6,
              maxWidth: 1400,
            }}
          >
            {beat.text}
          </div>
          <div
            style={{
              ...e2,
              ...labelStyle,
              marginTop: 32,
              color: style.accent,
              opacity: 1,
              fontWeight: 700,
            }}
          >
            {props.brandName}
          </div>
        </div>
      );
  }
}

/** A slow push-in so a held beat never sits dead still. */
function Drift({
  durationInFrames,
  portrait,
  children,
}: {
  durationInFrames: number;
  portrait: boolean;
  children: React.ReactNode;
}) {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.04], {
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        padding: portrait ? 72 : 120,
        transform: `scale(${scale})`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

export function MotionStudio(props: MotionStudioProps) {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const portrait = height > width;
  const { style } = props;
  useBrandFonts(style);
  let start = 0;
  const glow = interpolate(frame, [0, durationInFrames], [0, 1]);

  return (
    <AbsoluteFill style={{ background: style.background }}>
      {!style.chromaKey && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at ${30 + glow * 40}% ${40 + glow * 10}%, ${style.accent}26 0%, ${style.primary}40 35%, transparent 65%)`,
          }}
        />
      )}
      {props.beats.map((beat, i) => {
        const from = start;
        start += beat.durationInFrames;
        return (
          <Sequence
            key={i}
            from={from}
            durationInFrames={beat.durationInFrames}
          >
            <Drift durationInFrames={beat.durationInFrames} portrait={portrait}>
              <Beat beat={beat} props={props} portrait={portrait} />
            </Drift>
          </Sequence>
        );
      })}
      {!style.chromaKey && (
        <AbsoluteFill style={{ justifyContent: 'flex-end' }}>
          <div
            style={{
              height: 8,
              width: `${(frame / durationInFrames) * 100}%`,
              background: style.accent,
            }}
          />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}
