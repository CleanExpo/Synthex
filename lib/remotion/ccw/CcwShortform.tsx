/**
 * SYN-1404: CCW short-form composition (1080x1920, 30 fps).
 *
 * Code-built motion over CCW's owned product photos: push-ins, line-ups,
 * detail zooms with callouts, type set behind the product, and a CCW end card
 * using the real logo file. Captions follow Margot's voiceover word by word.
 * No generated imagery and no paid render step.
 */

import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type { CcwShot } from './shot-plans';

export const CCW = {
  blue: '#007CC3',
  green: '#39B54A',
  orange: '#F37215',
  ink: '#231F20',
  paper: '#FFFFFF',
  mist: '#EEF6FC',
};

const FONT =
  '"Helvetica Neue", "Arial Black", Arial, system-ui, -apple-system, sans-serif';

export type CcwTimedShot = CcwShot & { from: number; to: number };
export type CcwCaptionWord = { text: string; from: number; to: number };

export type CcwShortformProps = {
  voice: string;
  cta: string;
  url: string;
  logo: string;
  shots: CcwTimedShot[];
  words: CcwCaptionWord[];
};

const ACCENTS = [CCW.blue, CCW.green, CCW.orange];

function useLocal() {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  return { frame, fps, dur: durationInFrames };
}

function enter(frame: number, fps: number, delay = 0) {
  return spring({
    frame: frame - delay,
    fps,
    config: { damping: 18, stiffness: 140 },
  });
}

function Shadow({ width = 760, top = 1240 }: { width?: number; top?: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: (1080 - width) / 2,
        top,
        width,
        height: 70,
        borderRadius: '50%',
        background:
          'radial-gradient(ellipse at center, rgba(35,31,32,0.22) 0%, rgba(35,31,32,0) 70%)',
      }}
    />
  );
}

function Chip({ text, accent }: { text: string; accent: string }) {
  const { frame, fps } = useLocal();
  const s = enter(frame, fps, 4);
  return (
    <div
      style={{
        position: 'absolute',
        left: 72,
        top: 250,
        transform: `translateX(${interpolate(s, [0, 1], [-420, 0])}px)`,
        background: accent,
        color: CCW.paper,
        fontFamily: FONT,
        fontWeight: 800,
        fontSize: 44,
        padding: '18px 30px',
        borderRadius: 14,
        letterSpacing: 0.5,
      }}
    >
      {text}
    </div>
  );
}

function Callouts({ items, accent }: { items: string[]; accent: string }) {
  const { frame, fps } = useLocal();
  return (
    <div
      style={{
        position: 'absolute',
        right: 64,
        top: 360,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        alignItems: 'flex-end',
      }}
    >
      {items.map((t, i) => {
        const s = enter(frame, fps, 10 + i * 9);
        return (
          <div
            key={t}
            style={{
              opacity: s,
              transform: `translateX(${interpolate(s, [0, 1], [160, 0])}px)`,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              background: CCW.paper,
              border: `4px solid ${accent}`,
              borderRadius: 999,
              padding: '12px 26px 12px 16px',
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: 40,
              color: CCW.ink,
              boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
            }}
          >
            <svg width="34" height="34" viewBox="0 0 34 34">
              <circle cx="17" cy="17" r="17" fill={accent} />
              <path
                d="M9 17.5l5.5 5.5L25 12"
                stroke="#fff"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {t}
          </div>
        );
      })}
    </div>
  );
}

/** Photos shot on a grey studio floor sit on a white card instead of cut out. */
function isFramed(src: string) {
  return src.includes('razorback-maxxguard');
}

function cardStyle(src: string): React.CSSProperties {
  return isFramed(src)
    ? {
        objectFit: 'cover',
        borderRadius: 36,
        mixBlendMode: 'normal',
        boxShadow: '0 24px 60px rgba(35,31,32,0.18)',
      }
    : { objectFit: 'contain', mixBlendMode: 'multiply' };
}

function Product({
  src,
  size = 820,
  top = 380,
  drift = 1,
}: {
  src: string;
  size?: number;
  top?: number;
  drift?: number;
}) {
  const { frame, fps, dur } = useLocal();
  const s = enter(frame, fps);
  const push = interpolate(frame, [0, dur], [1, 1.1], {
    easing: Easing.out(Easing.quad),
  });
  return (
    <>
      {isFramed(src) ? null : (
        <Shadow top={top + size * 0.9} width={size * 0.8} />
      )}
      <Img
        src={staticFile(src)}
        style={{
          position: 'absolute',
          left: (1080 - size) / 2,
          top,
          width: size,
          height: size,
          ...cardStyle(src),
          transform: `translateX(${interpolate(s, [0, 1], [140 * drift, 0])}px) scale(${push * interpolate(s, [0, 1], [0.92, 1])})`,
        }}
      />
    </>
  );
}

function Hook({ shot, accent }: { shot: CcwTimedShot; accent: string }) {
  const { frame, fps } = useLocal();
  const words = (shot.bigText ?? '').split(' ');
  return (
    <AbsoluteFill style={{ background: CCW.paper }}>
      <Product src={shot.images[0]} size={680} top={700} />
      <div
        style={{
          position: 'absolute',
          left: 72,
          right: 72,
          top: 230,
          fontFamily: FONT,
          fontWeight: 900,
          fontSize: 132,
          lineHeight: 1.02,
          color: CCW.ink,
          letterSpacing: -2,
        }}
      >
        {words.map((w, i) => {
          const s = enter(frame, fps, i * 4);
          return (
            <span
              key={`${w}-${i}`}
              style={{
                display: 'inline-block',
                marginRight: 26,
                opacity: s,
                transform: `translateY(${interpolate(s, [0, 1], [60, 0])}px)`,
                color: i === words.length - 1 ? accent : CCW.ink,
              }}
            >
              {w}
            </span>
          );
        })}
        {shot.smallText ? (
          <div
            style={{
              fontSize: 48,
              fontWeight: 700,
              marginTop: 24,
              color: CCW.ink,
              opacity: enter(frame, fps, 14),
            }}
          >
            {shot.smallText}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
}

function TypeBehind({ shot, accent }: { shot: CcwTimedShot; accent: string }) {
  const { frame, fps, dur } = useLocal();
  const s = enter(frame, fps);
  const slide = interpolate(frame, [0, dur], [40, -40]);
  return (
    <AbsoluteFill style={{ background: CCW.mist }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 470,
          textAlign: 'center',
          fontFamily: FONT,
          fontWeight: 900,
          fontSize: Math.min(
            170,
            Math.floor(1700 / Math.max(1, (shot.bigText ?? '').length))
          ),
          letterSpacing: -4,
          color: accent,
          opacity: s,
          transform: `translateX(${slide}px) scale(${interpolate(s, [0, 1], [1.2, 1])})`,
          whiteSpace: 'nowrap',
        }}
      >
        {shot.bigText}
      </div>
      {shot.smallText ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 400,
            textAlign: 'center',
            fontFamily: FONT,
            fontWeight: 800,
            fontSize: 52,
            color: CCW.ink,
            opacity: enter(frame, fps, 6),
          }}
        >
          {shot.smallText}
        </div>
      ) : null}
      <Product src={shot.images[0]} size={660} top={660} drift={-1} />
    </AbsoluteFill>
  );
}

function Lineup({ shot, accent }: { shot: CcwTimedShot; accent: string }) {
  const { frame, fps, dur } = useLocal();
  const pan = interpolate(frame, [0, dur], [30, -30]);
  const slots = [
    { x: 40, top: 520, size: 320 },
    { x: 380, top: 760, size: 320 },
    { x: 720, top: 520, size: 320 },
  ];
  return (
    <AbsoluteFill style={{ background: CCW.paper }}>
      {shot.images.slice(0, 3).map((src, i) => {
        const s = enter(frame, fps, i * 6);
        const p = slots[i];
        return (
          <Img
            key={src}
            src={staticFile(src)}
            style={{
              position: 'absolute',
              left: p.x + pan * (i - 1) * 0.6,
              top: p.top + interpolate(s, [0, 1], [200, 0]),
              width: p.size,
              height: p.size,
              ...cardStyle(src),
              opacity: s,
            }}
          />
        );
      })}
      <Shadow top={1150} width={980} />
      {shot.label ? <Chip text={shot.label} accent={accent} /> : null}
    </AbsoluteFill>
  );
}

function Detail({ shot, accent }: { shot: CcwTimedShot; accent: string }) {
  const { frame, dur } = useLocal();
  const f = shot.focus ?? { x: 0.5, y: 0.5, zoom: 1.8 };
  const z = interpolate(
    frame,
    [0, dur * 0.6, dur],
    [1.05, f.zoom, f.zoom * 1.04],
    {
      easing: Easing.inOut(Easing.cubic),
      extrapolateRight: 'clamp',
    }
  );
  const size = 1000;
  const top = 380;
  const ring = interpolate(frame, [dur * 0.45, dur * 0.65], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{ background: CCW.paper, overflow: 'hidden' }}>
      <Img
        src={staticFile(shot.images[0])}
        style={{
          position: 'absolute',
          left: (1080 - size) / 2,
          top,
          width: size,
          height: size,
          objectFit: 'contain',
          mixBlendMode: 'multiply',
          transformOrigin: `${f.x * 100}% ${f.y * 100}%`,
          transform: `scale(${z})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: (1080 - size) / 2 + f.x * size - 150,
          top: top + f.y * size - 150,
          width: 300,
          height: 300,
          borderRadius: '50%',
          border: `8px solid ${accent}`,
          opacity: ring,
          transform: `scale(${interpolate(ring, [0, 1], [1.6, 1])})`,
        }}
      />
      {shot.bigText ? (
        <div
          style={{
            position: 'absolute',
            left: 72,
            right: 72,
            top: 230,
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 110,
            letterSpacing: -2,
            color: accent,
          }}
        >
          <span
            style={{
              background: 'rgba(255,255,255,0.95)',
              padding: '8px 24px',
              borderRadius: 18,
              boxShadow: '0 12px 36px rgba(0,0,0,0.10)',
            }}
          >
            {shot.bigText}
          </span>
        </div>
      ) : null}
      {shot.label ? <Chip text={shot.label} accent={accent} /> : null}
      {shot.callouts ? (
        <Callouts items={shot.callouts} accent={accent} />
      ) : null}
    </AbsoluteFill>
  );
}

function Hero({ shot, accent }: { shot: CcwTimedShot; accent: string }) {
  return (
    <AbsoluteFill style={{ background: CCW.paper }}>
      <div
        style={{
          position: 'absolute',
          left: -200,
          top: 1180,
          width: 1480,
          height: 900,
          background: CCW.mist,
          transform: 'rotate(-6deg)',
        }}
      />
      <Product src={shot.images[0]} size={820} top={390} />
      {shot.label ? <Chip text={shot.label} accent={accent} /> : null}
      {shot.callouts ? (
        <Callouts items={shot.callouts} accent={accent} />
      ) : null}
    </AbsoluteFill>
  );
}

function Fullbleed({ shot, accent }: { shot: CcwTimedShot; accent: string }) {
  const { frame, fps, dur } = useLocal();
  const z = interpolate(frame, [0, dur], [1.08, 1.2]);
  const x = interpolate(frame, [0, dur], [0, -60]);
  return (
    <AbsoluteFill style={{ background: CCW.ink, overflow: 'hidden' }}>
      <Img
        src={staticFile(shot.images[0])}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `translateX(${x}px) scale(${z})`,
        }}
      />
      {shot.smallText ? (
        <div
          style={{
            position: 'absolute',
            left: 72,
            top: 250,
            background: accent,
            color: CCW.paper,
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 64,
            padding: '20px 32px',
            borderRadius: 16,
            opacity: enter(frame, fps, 4),
          }}
        >
          {shot.smallText}
        </div>
      ) : null}
    </AbsoluteFill>
  );
}

function EndCard({
  shot,
  logo,
  cta,
  url,
}: {
  shot: CcwTimedShot;
  logo: string;
  cta: string;
  url: string;
}) {
  const { frame, fps } = useLocal();
  const s = enter(frame, fps);
  return (
    <AbsoluteFill style={{ background: CCW.paper }}>
      <Img
        src={staticFile(logo)}
        style={{
          position: 'absolute',
          left: 190,
          top: 240,
          width: 700,
          height: 360,
          objectFit: 'contain',
          opacity: s,
          transform: `scale(${interpolate(s, [0, 1], [0.85, 1])})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 640,
          display: 'flex',
          justifyContent: 'center',
          gap: 10,
        }}
      >
        {shot.images.slice(0, 3).map((src, i) => {
          const e = enter(frame, fps, 6 + i * 5);
          const float = Math.sin((frame + i * 20) / 22) * 12;
          return (
            <Img
              key={src}
              src={staticFile(src)}
              style={{
                width: 310,
                height: 310,
                ...cardStyle(src),
                opacity: e,
                transform: `translateY(${interpolate(e, [0, 1], [80, 0]) + float}px)`,
              }}
            />
          );
        })}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 72,
          right: 72,
          top: 1040,
          textAlign: 'center',
          fontFamily: FONT,
        }}
      >
        <div
          style={{
            display: 'inline-block',
            background: CCW.blue,
            color: CCW.paper,
            fontWeight: 900,
            fontSize: 70,
            padding: '24px 44px',
            borderRadius: 18,
            opacity: enter(frame, fps, 12),
          }}
        >
          {cta}
        </div>
        <div
          style={{
            marginTop: 26,
            fontWeight: 800,
            fontSize: 52,
            color: CCW.ink,
            opacity: enter(frame, fps, 18),
          }}
        >
          {url}
        </div>
      </div>
    </AbsoluteFill>
  );
}

function Captions({ words }: { words: CcwCaptionWord[] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  // Group words into caption lines of up to ~26 characters.
  const lines: CcwCaptionWord[][] = [];
  let cur: CcwCaptionWord[] = [];
  for (const w of words) {
    const len = cur.reduce((n, x) => n + x.text.length + 1, 0);
    if (
      cur.length &&
      (len + w.text.length > 26 || /[.?!]$/.test(cur[cur.length - 1].text))
    ) {
      lines.push(cur);
      cur = [];
    }
    cur.push(w);
  }
  if (cur.length) lines.push(cur);
  const line = lines.find(
    (l, i) =>
      t >= l[0].from - 0.05 &&
      t <
        (lines[i + 1] ? lines[i + 1][0].from - 0.05 : l[l.length - 1].to + 0.6)
  );
  if (!line) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 60,
        right: 60,
        top: 1420,
        textAlign: 'center',
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: 62,
        lineHeight: 1.2,
      }}
    >
      <span
        style={{
          background: 'rgba(255,255,255,0.94)',
          boxDecorationBreak: 'clone',
          WebkitBoxDecorationBreak: 'clone',
          padding: '10px 22px',
          borderRadius: 14,
          boxShadow: '0 8px 30px rgba(0,0,0,0.10)',
        }}
      >
        {line.map((w, i) => (
          <span
            key={`${w.from}-${i}`}
            style={{ color: t >= w.from ? CCW.blue : CCW.ink }}
          >
            {w.text}
            {i < line.length - 1 ? ' ' : ''}
          </span>
        ))}
      </span>
    </div>
  );
}

function ShotView({
  shot,
  index,
  props,
}: {
  shot: CcwTimedShot;
  index: number;
  props: CcwShortformProps;
}) {
  const accent = ACCENTS[index % ACCENTS.length];
  switch (shot.kind) {
    case 'hook':
      return <Hook shot={shot} accent={accent} />;
    case 'type':
      return <TypeBehind shot={shot} accent={accent} />;
    case 'lineup':
      return <Lineup shot={shot} accent={accent} />;
    case 'detail':
      return <Detail shot={shot} accent={accent} />;
    case 'fullbleed':
      return <Fullbleed shot={shot} accent={accent} />;
    case 'end':
      return (
        <EndCard
          shot={shot}
          logo={props.logo}
          cta={props.cta}
          url={props.url}
        />
      );
    default:
      return <Hero shot={shot} accent={accent} />;
  }
}

export const CcwShortform: React.FC<CcwShortformProps> = props => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: CCW.paper }}>
      {props.shots.map((shot, i) => {
        const from = Math.round(shot.from * fps);
        const to = Math.round(shot.to * fps);
        return (
          <Sequence
            key={`${shot.trigger}-${i}`}
            from={from}
            durationInFrames={Math.max(1, to - from)}
          >
            <ShotView shot={shot} index={i} props={props} />
          </Sequence>
        );
      })}
      <Captions words={props.words} />
      <Audio src={staticFile(props.voice)} />
    </AbsoluteFill>
  );
};
