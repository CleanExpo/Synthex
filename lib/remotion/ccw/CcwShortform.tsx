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
import { CCW, TEXT_MASK_CSS } from './brand';
import { CcwPmWorld } from './CcwPmWorld';

export { CCW, TEXT_MASK_CSS };

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
  /** QA only: render text boxes white on black (safe-zone check). */
  textMask?: boolean;
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
      className="ccw-text"
      style={{
        position: 'absolute',
        left: 84,
        top: 300,
        opacity: s,
        transform: `translateX(${interpolate(s, [0, 1], [-16, 0])}px)`,
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
        right: 84,
        top: 400,
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
            className="ccw-text"
            style={{
              opacity: s,
              transform: `translateX(${interpolate(s, [0, 1], [16, 0])}px)`,
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

/**
 * A real camera-style move on every product: a 3D turn (perspective rotateY),
 * a hard push-in and a sideways drift, with a backdrop disc travelling the
 * opposite way so the product separates from the background (parallax).
 */
function Product({
  src,
  size = 980,
  top = 300,
  drift = 1,
  backdrop = CCW.mist,
}: {
  src: string;
  size?: number;
  top?: number;
  drift?: number;
  backdrop?: string | null;
}) {
  // A framed photo fills its whole square, so it would run off the frame
  // under the push-in; keep it smaller and centred on the same point.
  if (isFramed(src)) {
    top += size * 0.14;
    size *= 0.72;
  }
  const { frame, fps, dur } = useLocal();
  const s = enter(frame, fps);
  const t = interpolate(frame, [0, dur], [0, 1], {
    easing: Easing.inOut(Easing.sin),
  });
  const push = interpolate(t, [0, 1], [1, 1.24]);
  const turn = interpolate(t, [0, 1], [-14 * drift, 9 * drift]);
  const slide = interpolate(t, [0, 1], [50 * drift, -50 * drift]);
  const disc = interpolate(t, [0, 1], [-140 * drift, 140 * drift]);
  const discSize = size * 1.05;
  return (
    <>
      {backdrop ? (
        <div
          style={{
            position: 'absolute',
            left: (1080 - discSize) / 2 + disc,
            top: top + (size - discSize) / 2,
            width: discSize,
            height: discSize,
            borderRadius: '50%',
            background: backdrop,
            opacity: s,
            transform: `scale(${interpolate(s, [0, 1], [0.6, 1])})`,
          }}
        />
      ) : null}
      {isFramed(src) ? null : (
        <Shadow top={top + size * 0.9} width={size * 0.8} />
      )}
      {/* perspective() lives in the img's own transform: a wrapper would
          isolate the multiply blend and show the photo's white background. */}
      <Img
        src={staticFile(src)}
        style={{
          position: 'absolute',
          left: (1080 - size) / 2,
          top,
          width: size,
          height: size,
          ...cardStyle(src),
          transform: `perspective(1800px) translateX(${interpolate(s, [0, 1], [220 * drift, 0]) + slide}px) rotateY(${turn}deg) scale(${push * interpolate(s, [0, 1], [0.86, 1])})`,
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
      <Product src={shot.images[0]} size={940} top={760} />
      <div
        className="ccw-text"
        style={{
          position: 'absolute',
          left: 84,
          right: 84,
          top: 320,
          fontFamily: FONT,
          fontWeight: 900,
          fontSize: 128,
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
  const slide = interpolate(frame, [0, dur], [20, -20]);
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
            150,
            Math.floor(1400 / Math.max(1, (shot.bigText ?? '').length))
          ),
          letterSpacing: -4,
          color: accent,
          opacity: s,
          transform: `translateX(${slide}px) scale(${interpolate(s, [0, 1], [1.08, 1])})`,
          whiteSpace: 'nowrap',
        }}
      >
        <span className="ccw-text">{shot.bigText}</span>
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
          <span className="ccw-text">{shot.smallText}</span>
        </div>
      ) : null}
      <Product
        src={shot.images[0]}
        size={980}
        top={680}
        drift={-1}
        backdrop={null}
      />
    </AbsoluteFill>
  );
}

const LINEUP_SLOTS: Record<number, { x: number; top: number; size: number }[]> =
  {
    2: [
      { x: -60, top: 420, size: 760 },
      { x: 380, top: 860, size: 760 },
    ],
    3: [
      { x: 10, top: 420, size: 560 },
      { x: 510, top: 480, size: 560 },
      { x: 260, top: 960, size: 600 },
    ],
  };

function Lineup({ shot, accent }: { shot: CcwTimedShot; accent: string }) {
  const { frame, fps, dur } = useLocal();
  const t = interpolate(frame, [0, dur], [0, 1], {
    easing: Easing.inOut(Easing.sin),
  });
  const imgs = shot.images.slice(0, 3);
  const slots = LINEUP_SLOTS[imgs.length] ?? LINEUP_SLOTS[3];
  const speeds = [-90, 70, -40];
  return (
    <AbsoluteFill style={{ background: CCW.paper, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: interpolate(t, [0, 1], [-300, 100]),
          top: 560,
          width: 1300,
          height: 620,
          background: CCW.mist,
          transform: 'rotate(-8deg)',
        }}
      />
      {imgs.map((src, i) => {
        const s = enter(frame, fps, i * 5);
        const p = slots[i];
        const turn = interpolate(t, [0, 1], [i % 2 ? 12 : -12, i % 2 ? -6 : 6]);
        return (
          <Img
            key={src}
            src={staticFile(src)}
            style={{
              position: 'absolute',
              left: p.x,
              top: p.top,
              width: p.size,
              height: p.size,
              ...cardStyle(src),
              opacity: s,
              transform: `perspective(1600px) translateX(${speeds[i] * t}px) translateY(${interpolate(s, [0, 1], [260, 0])}px) rotateY(${turn}deg) scale(${interpolate(t, [0, 1], [1, 1.12])})`,
            }}
          />
        );
      })}
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
  const size = 1120;
  const top = 420;
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
          transform: `perspective(1800px) rotateY(${interpolate(frame, [0, dur], [-10, 4])}deg) scale(${z})`,
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
            left: 84,
            right: 84,
            top: 320,
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 110,
            letterSpacing: -2,
            color: accent,
          }}
        >
          <span
            className="ccw-text"
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
      <Product src={shot.images[0]} size={1080} top={400} />
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
          className="ccw-text"
          style={{
            position: 'absolute',
            left: 84,
            top: 300,
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

/**
 * Scene end card, at most 3 s: the camera keeps pushing on the real job photo
 * (prepared crop), the real CCW logo arrives on a white plate set in depth,
 * then the CTA pill and the web address.
 */
function SceneEndCard({
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
  const { frame, fps, dur } = useLocal();
  const t = interpolate(frame, [0, dur], [0, 1]);
  const s = spring({
    frame: frame - 1,
    fps,
    config: { damping: 11, stiffness: 140, mass: 0.8 },
  });
  const pulse = 1 + Math.sin(frame / 4) * 0.03 * enter(frame, fps, 12);
  return (
    <AbsoluteFill style={{ background: CCW.ink, overflow: 'hidden' }}>
      <Img
        src={staticFile(shot.images[0])}
        style={{
          position: 'absolute',
          width: 1188,
          height: 2112,
          left: -54,
          top: -96,
          transform: `translateX(${interpolate(t, [0, 1], [0, -40])}px) scale(${interpolate(t, [0, 1], [1.1, 1.26])})`,
          transformOrigin: '50% 62%',
        }}
      />
      <div style={{ position: 'absolute', inset: 0, perspective: 1200 }}>
        <div
          style={{
            position: 'absolute',
            left: 150,
            top: 330,
            width: 780,
            height: 330,
            background: 'rgba(255,255,255,0.96)',
            borderRadius: 26,
            boxShadow: '0 30px 60px rgba(10,20,40,0.35)',
            opacity: Math.min(1, s * 1.4),
            transform: `translateZ(${interpolate(s, [0, 1], [260, 0])}px) rotateY(${interpolate(s, [0, 1], [-35, -10])}deg) rotateZ(${interpolate(s, [0, 1], [-8, 0])}deg)`,
          }}
        >
          <Img
            className="ccw-text"
            src={staticFile(logo)}
            style={{
              position: 'absolute',
              inset: 36,
              width: 708,
              height: 258,
              objectFit: 'contain',
            }}
          />
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 84,
          right: 84,
          top: 820,
          textAlign: 'center',
          fontFamily: FONT,
        }}
      >
        <div
          className="ccw-text"
          style={{
            display: 'inline-block',
            background: CCW.blue,
            color: CCW.paper,
            fontWeight: 900,
            fontSize: 72,
            padding: '24px 44px',
            borderRadius: 18,
            boxShadow: '0 16px 40px rgba(10,20,40,0.35)',
            opacity: enter(frame, fps, 8),
            transform: `translateY(${interpolate(enter(frame, fps, 8), [0, 1], [24, 0])}px) scale(${pulse})`,
          }}
        >
          {cta}
        </div>
        <div style={{ marginTop: 26, opacity: enter(frame, fps, 12) }}>
          <span
            className="ccw-text"
            style={{
              background: 'rgba(255,255,255,0.94)',
              padding: '8px 22px',
              borderRadius: 12,
              fontWeight: 800,
              fontSize: 54,
              color: CCW.ink,
            }}
          >
            {url}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/**
 * End card, at most 3 s: a blue sweep wipes in, the real CCW logo scales up,
 * three products fly in on a 3D turn and keep moving, the CTA pill pulses.
 */
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
  const { frame, fps, dur } = useLocal();
  const t = interpolate(frame, [0, dur], [0, 1]);
  const wipe = enter(frame, fps);
  const s = enter(frame, fps, 3);
  const pulse = 1 + Math.sin(frame / 4) * 0.035 * enter(frame, fps, 12);
  if (shot.crop)
    return <SceneEndCard shot={shot} logo={logo} cta={cta} url={url} />;
  return (
    <AbsoluteFill style={{ background: CCW.paper, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: -300,
          top: 600,
          width: 1700,
          height: 520,
          background: CCW.mist,
          transform: `translateX(${interpolate(wipe, [0, 1], [-1700, 0]) + t * 120}px) rotate(-7deg)`,
        }}
      />
      <Img
        className="ccw-text"
        src={staticFile(logo)}
        style={{
          position: 'absolute',
          left: 140,
          top: 270,
          width: 800,
          height: 380,
          objectFit: 'contain',
          opacity: s,
          transform: `scale(${interpolate(s, [0, 1], [0.6, 1]) * interpolate(t, [0, 1], [1, 1.06])})`,
        }}
      />
      {shot.images.slice(0, 3).map((src, i) => {
        const e = enter(frame, fps, 4 + i * 3);
        const from = [-700, 0, 700][i];
        const x = [30, 380, 730][i];
        const float = Math.sin((frame + i * 14) / 9) * 14;
        return (
          <Img
            key={src}
            src={staticFile(src)}
            style={{
              position: 'absolute',
              left: x,
              top: 650,
              width: 320,
              height: 320,
              ...cardStyle(src),
              opacity: e,
              transform: `perspective(1400px) translateX(${interpolate(e, [0, 1], [from, 0]) + (i - 1) * t * 30}px) translateY(${interpolate(e, [0, 1], [i === 1 ? 500 : 0, 0]) + float}px) rotateY(${interpolate(e, [0, 1], [i === 0 ? 60 : i === 2 ? -60 : 0, (i - 1) * -10])}deg) scale(${interpolate(t, [0, 1], [1, 1.12])})`,
            }}
          />
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: 84,
          right: 84,
          top: 1000,
          textAlign: 'center',
          fontFamily: FONT,
        }}
      >
        <div
          className="ccw-text"
          style={{
            display: 'inline-block',
            background: CCW.blue,
            color: CCW.paper,
            fontWeight: 900,
            fontSize: 72,
            padding: '24px 44px',
            borderRadius: 18,
            opacity: enter(frame, fps, 8),
            transform: `translateY(${interpolate(enter(frame, fps, 8), [0, 1], [24, 0])}px) scale(${pulse})`,
          }}
        >
          {cta}
        </div>
        <div
          style={{
            marginTop: 26,
            fontWeight: 800,
            fontSize: 54,
            color: CCW.ink,
            opacity: enter(frame, fps, 12),
          }}
        >
          <span className="ccw-text">{url}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/**
 * Captions sit inside the Reels safe zone: the line grows upward from
 * y 1150, so it never reaches the bottom 35 % or the right-hand button
 * column (x > 853 below y 1152). Hidden on the end card, whose CTA button
 * shows the same words.
 */
function Captions({
  words,
  hideFrom,
  hidden = [],
}: {
  words: CcwCaptionWord[];
  hideFrom: number;
  /** Spans (seconds) where a shot's own type carries the words. */
  hidden?: { from: number; to: number }[];
}) {
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
  if (!line || t >= hideFrom) return null;
  if (hidden.some(h => t >= h.from && t < h.to)) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 84,
        right: 84,
        // 1130 leaves room for the 10 px pill padding below the line box.
        bottom: 1920 - 1130,
        textAlign: 'center',
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: 62,
        lineHeight: 1.2,
      }}
    >
      <span
        className="ccw-text"
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
    case 'floor':
      return (
        <CcwPmWorld
          scene={shot.images[0]}
          floorLines={shot.floorLines}
          floorSize={shot.floorSize}
          kinetic={shot.kinetic}
          sourceSlip={shot.sourceSlip}
          rippleTo={shot.rippleTo}
          rippleFrom={shot.rippleFrom}
          place={shot.place?.map(u => ({ ...u, src: shot.images[u.img] }))}
          slam={shot.slam}
          product={
            shot.product
              ? { ...shot.product, src: shot.images[shot.product.image] }
              : undefined
          }
        />
      );
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
    <AbsoluteFill className="ccw-root" style={{ background: CCW.paper }}>
      {props.textMask ? <style>{TEXT_MASK_CSS}</style> : null}
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
      <Captions
        words={props.words}
        hideFrom={
          props.shots.length
            ? props.shots[props.shots.length - 1].from
            : Infinity
        }
        hidden={props.shots.filter(s => s.noCaptions)}
      />
      <Audio src={staticFile(props.voice)} />
    </AbsoluteFill>
  );
};
