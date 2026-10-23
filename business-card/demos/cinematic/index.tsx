// Cinematic business films (approved look: CARSI style test, 23/10/2026). One composition, driven by each business's
// film.json from prepare.py: every scene is a real site screen that assembles from its own pieces in 3D, or the
// business's own steps as tiles, owned equipment photos on a bright stage, or a photo headline. Margot narrates.
// Render: npx remotion render business-card/demos/cinematic/index.tsx Film out.mp4 --public-dir <media> --props <id>/cine/props.json
import React, { useEffect, useState } from 'react';
import {
  AbsoluteFill,
  Audio,
  Composition,
  Easing,
  Img,
  Sequence,
  continueRender,
  delayRender,
  interpolate,
  random,
  registerRoot,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

type Piece = {
  i: number;
  tag: string;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
};
type Brand = { display: string; body: string; accent: string; ink: string };
type Scene = {
  n: number;
  type: 'assemble' | 'steps' | 'kit' | 'photo';
  seg: string;
  vo: string;
  from: number;
  frames: number;
  ticker: boolean;
  eyebrow?: string;
  before?: string;
  pixel?: string;
  after?: string;
  items?: [string, string][];
  kit?: string[];
  card?: { seg: string; piece: Piece } | null;
  slot?: string | null;
  image?: string | null;
  photo?: string;
};
type Film = {
  id: string;
  name: string;
  url: string;
  brand: Brand;
  topics: string[];
  scenes: Scene[];
  logo: { seg: string; piece: Piece | null };
  endFrom: number;
  durationInFrames: number;
};

const W = 1920,
  H = 1080,
  FPS = 30,
  LEAD = 15;
const PAPER = '#f4f1ea',
  CARD = '#fffdf8'; // getrubric.app light: warm paper, hard offset shadows
const IRIS = Easing.bezier(0.83, 0, 0.17, 1);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const font = (f: string, fb = 'Arial, sans-serif') => `"${f}", ${fb}`;
const PIXEL = '"Doto", monospace';

// brand faces plus Doto for the one dot-matrix word; the render waits until they are loaded
function useFonts(b: Brand) {
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    const fam = [...new Set([b.display, b.body])]
      .map(f => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700;800`)
      .join('&');
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = `https://fonts.googleapis.com/css2?${fam}&family=Doto:wght@700;900&display=block`;
    const done = () => continueRender(handle);
    l.onload = () =>
      Promise.all(
        [
          `800 40px "${b.display}"`,
          `500 20px "${b.body}"`,
          '900 40px Doto',
        ].map(f => document.fonts.load(f))
      ).then(done, done);
    l.onerror = done;
    document.head.appendChild(l);
  }, [b, handle]);
}

// every scene's piece list, loaded once before the first frame
function usePieces(film: Film) {
  const [map, setMap] = useState<Record<string, Piece[]> | null>(null);
  const [handle] = useState(() => delayRender('pieces'));
  useEffect(() => {
    const segs = [...new Set(film.scenes.map(s => s.seg))];
    Promise.all(
      segs.map(s =>
        fetch(staticFile(`${s}/pieces.json`))
          .then(r => r.json())
          .then(d => [s, d.pieces] as const)
      )
    ).then(all => {
      setMap(Object.fromEntries(all));
      continueRender(handle);
    });
  }, [film, handle]);
  return map;
}

const hex = (accent: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="208" viewBox="0 0 120 208"><path d="M60 0l60 34.6v69.3L60 138.6 0 103.9V34.6zM60 138.6V208" fill="none" stroke="${accent}" stroke-opacity="0.12" stroke-width="1.5"/></svg>`)}")`;
const Paper: React.FC<{ b: Brand }> = ({ b }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse at 50% 35%, white 0%, ${PAPER} 75%)`,
    }}
  >
    <AbsoluteFill
      style={{
        backgroundImage: hex(b.accent),
        backgroundSize: '120px 208px',
        maskImage:
          'radial-gradient(ellipse at center, black 35%, transparent 85%)',
      }}
    />
  </AbsoluteFill>
);

// a real piece of the page, cut from pieces.png (transparent), placed in 3D. t: 0 scattered, 1 in place, 2 blown past camera
const PieceView: React.FC<{
  p: Piece;
  t: number;
  src: string;
  seed: string;
}> = ({ p, t, src, seed }) => {
  const s = (k: string) => random(`${seed}-${p.i}-${k}`) * 2 - 1;
  const away = Math.min(t, 1),
    out = Math.max(t - 1, 0),
    scatter = 1 - away;
  const glow = away > 0.96 && out === 0 ? 1 - (away - 0.96) / 0.04 : 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: p.x,
        top: p.y,
        width: p.w,
        height: p.h,
        backgroundImage: `url(${src})`,
        backgroundPosition: `-${p.x}px -${p.y}px`,
        backgroundSize: `${W}px ${H}px`,
        transform: `translate3d(${s('x') * 700 * scatter + s('ox') * 900 * out}px, ${s('y') * 450 * scatter + s('oy') * 600 * out}px, ${(-1400 + s('z') * 600) * scatter + 1500 * out}px) rotateX(${s('rx') * 75 * scatter + s('orx') * 50 * out}deg) rotateY(${s('ry') * 75 * scatter + s('ory') * 50 * out}deg)`,
        opacity:
          interpolate(away, [0, 0.15], [0, 1], clamp) *
          interpolate(out, [0.6, 1], [1, 0], clamp),
        filter: `drop-shadow(0 ${24 * scatter + 4}px ${30 * scatter + 8}px rgba(11,27,51,${0.22 * scatter + 0.06})) drop-shadow(0 0 ${18 * glow}px rgba(124,196,255,0.9))`,
        backfaceVisibility: 'hidden',
      }}
    />
  );
};

// pages with too few pieces (a 3D app, a full-bleed image) break into a grid of tiles instead, like kit plates
const gridPieces = (): Piece[] =>
  Array.from({ length: 24 }, (_, k) => ({
    i: k,
    tag: 'tile',
    text: '',
    x: (k % 6) * 320,
    y: Math.floor(k / 6) * 270,
    w: 320,
    h: 270,
  }));

// the real screen as a framed panel on the bright stage, assembling from its pieces, then pulling apart toward the camera
const Assemble: React.FC<{ sc: Scene; pieces: Piece[] }> = ({ sc, pieces }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const grid = pieces.length < 4;
  const list = grid ? gridPieces() : pieces;
  const src = staticFile(`${sc.seg}/${grid ? 'full' : 'pieces'}.png`);
  const stagger = Math.min(4, 40 / list.length);
  const breakAt = sc.frames - 24;
  const tilt = interpolate(f, [0, 50], [1, 0], { easing: IRIS, ...clamp });
  const push = interpolate(f, [50, breakAt], [1, 1.05], clamp);
  const plate =
    interpolate(f, [8, 40], [0, 1], clamp) *
    interpolate(f, [breakAt + 6, sc.frames], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ perspective: 1700, perspectiveOrigin: '50% 40%' }}>
      <AbsoluteFill
        style={{
          transformStyle: 'preserve-3d',
          transformOrigin: '50% 50%',
          transform: `scale(${(0.8 + 0.06 * (1 - tilt)) * push}) rotateX(${28 * tilt}deg) rotateZ(${-6 * tilt}deg)`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 22,
            overflow: 'hidden',
            opacity: plate,
            boxShadow:
              '0 40px 90px rgba(11,27,51,0.22), 0 0 0 1px rgba(11,27,51,0.08)',
          }}
        >
          {!grid && (
            <Img
              src={staticFile(`${sc.seg}/plate.png`)}
              style={{ width: W, height: H }}
            />
          )}
        </div>
        {list.map((p, k) => {
          const inT = spring({
            frame: f - 4 - k * stagger,
            fps,
            config: { damping: 14, stiffness: 80, mass: 1 },
          });
          const outT = interpolate(
            f,
            [breakAt + k * 0.6, breakAt + 22 + k * 0.6],
            [0, 1],
            { easing: Easing.in(Easing.cubic), ...clamp }
          );
          return (
            <PieceView
              key={p.i}
              p={p}
              t={Math.min(inT, 1) + outT}
              src={src}
              seed={sc.seg}
            />
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Headline: React.FC<{ sc: Scene; b: Brand; size: number }> = ({
  sc,
  b,
  size,
}) => (
  <div
    style={{
      font: `700 ${size}px ${font(b.display)}`,
      color: b.ink,
      textAlign: 'center',
      lineHeight: 1.08,
      letterSpacing: '-0.02em',
      maxWidth: 1600,
    }}
  >
    {sc.before}{' '}
    <span
      style={{
        font: `900 ${size * 1.12}px ${PIXEL}`,
        color: b.accent,
        letterSpacing: 0,
      }}
    >
      {sc.pixel}
    </span>
    {sc.after === '.' ? '.' : ` ${sc.after}`}
  </div>
);

// the business's own steps as numbered tiles that drop in like kit parts, with hard offset shadows
const Steps: React.FC<{ sc: Scene; b: Brand }> = ({ sc, b }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const items = sc.items || [];
  const cols = items.length <= 4 ? 2 : items.length <= 6 ? 3 : 4;
  const tileW = cols === 2 ? 680 : cols === 3 ? 520 : 400;
  const head = spring({
    frame: f,
    fps,
    config: { damping: 16, stiffness: 90 },
  });
  const out = interpolate(f, [sc.frames - 16, sc.frames], [1, 0], clamp);
  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        paddingTop: items.length > 4 ? 110 : 150,
        perspective: 1400,
        opacity: out,
      }}
    >
      <div
        style={{
          font: `700 20px ${font(b.body)}`,
          letterSpacing: '0.55em',
          color: b.accent,
          opacity: head,
        }}
      >
        {sc.eyebrow}
      </div>
      <div
        style={{
          marginTop: 16,
          opacity: head,
          transform: `translateY(${30 * (1 - head)}px)`,
        }}
      >
        <Headline sc={sc} b={b} size={74} />
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 32,
          marginTop: 60,
          maxWidth: cols * (tileW + 32),
        }}
      >
        {items.map(([t, d], k) => {
          const kk = spring({
            frame: f - 12 - k * 7,
            fps,
            config: { damping: 12, stiffness: 110, mass: 0.9 },
          });
          return (
            <div
              key={t}
              style={{
                width: tileW,
                boxSizing: 'border-box',
                background: CARD,
                border: `2px solid ${b.ink}`,
                boxShadow: `${8 * kk}px ${8 * kk}px 0 ${b.ink}`,
                padding: '24px 28px',
                display: 'flex',
                gap: 22,
                alignItems: 'baseline',
                opacity: Math.min(1, kk * 1.5),
                transform: `translate3d(0, ${-260 * (1 - kk)}px, ${-500 * (1 - kk)}px) rotateX(${50 * (1 - kk)}deg)`,
              }}
            >
              <div
                style={{
                  font: `900 50px ${PIXEL}`,
                  color: b.accent,
                  minWidth: 72,
                }}
              >
                {String(k + 1).padStart(2, '0')}
              </div>
              <div>
                <div
                  style={{
                    font: `600 ${cols === 4 ? 28 : 32}px ${font(b.display)}`,
                    color: b.ink,
                    lineHeight: 1.15,
                  }}
                >
                  {t}
                </div>
                {d && (
                  <div
                    style={{
                      font: `500 21px ${font(b.body)}`,
                      color: `${b.ink}99`,
                      marginTop: 6,
                    }}
                  >
                    {d}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// owned equipment photos standing on the bright stage, lifting in and turning slowly; a site card can dock beside them
const Kit: React.FC<{ sc: Scene; b: Brand }> = ({ sc, b }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const kit = sc.kit || [];
  const card = sc.card;
  const size = (kit.length > 2 ? 520 : 620) * (card ? 0.8 : 1); // leave room for a docked card
  const out = interpolate(f, [sc.frames - 16, sc.frames], [1, 0], clamp);
  const dock = spring({
    frame: f - 45,
    fps,
    config: { damping: 13, stiffness: 80 },
  });
  return (
    <AbsoluteFill style={{ perspective: 1400, opacity: out }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 80%, white 0%, transparent 60%)`,
        }}
      />
      <AbsoluteFill
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 40,
          paddingBottom: card ? 0 : 40,
          transform: `scale(${interpolate(f, [0, sc.frames], [0.92, 1.03])}) translateX(${card ? -260 : 0}px)`,
        }}
      >
        {kit.map((k, i) => {
          const lift = spring({
            frame: f - i * 9,
            fps,
            config: { damping: 16, stiffness: 60 },
          });
          const orbit = interpolate(
            f,
            [0, sc.frames],
            [-24 + i * 6, 10 + i * 4],
            { easing: IRIS }
          );
          return (
            <div
              key={k}
              style={{
                position: 'relative',
                width: size,
                height: size,
                opacity: lift,
                transform: `translateY(${140 * (1 - lift)}px) rotateY(${orbit}deg)`,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: size * 0.18,
                  top: size * 0.86,
                  width: size * 0.64,
                  height: 50,
                  borderRadius: '50%',
                  background:
                    'radial-gradient(ellipse, rgba(11,27,51,0.26), transparent 70%)',
                }}
              />
              <Img
                src={staticFile(`_kit/${k}.png`)}
                style={{
                  position: 'relative',
                  width: size,
                  height: size,
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 26px 26px rgba(11,27,51,0.2))',
                }}
              />
            </div>
          );
        })}
      </AbsoluteFill>
      {card && (
        <div
          style={{
            position: 'absolute',
            right: 150,
            top: 400,
            width: card.piece.w,
            height: card.piece.h,
            backgroundImage: `url(${staticFile(`${card.seg}/full.png`)})`,
            backgroundPosition: `-${card.piece.x}px -${card.piece.y}px`,
            backgroundSize: `${W}px ${H}px`,
            transform: `translate3d(${500 * (1 - dock)}px, ${-200 * (1 - dock)}px, ${-900 * (1 - dock)}px) rotateY(${-60 * (1 - dock)}deg) scale(1.6)`,
            transformOrigin: 'right top',
            opacity: Math.min(dock * 2, 1),
            borderRadius: 10,
            boxShadow: `0 30px 70px rgba(11,27,51,0.22), 0 0 0 2px ${b.accent}33`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

// a bright full-bleed photo of real people with one headline over it; a labelled placeholder until Phill's photo exists
const Photo: React.FC<{ sc: Scene; b: Brand }> = ({ sc, b }) => {
  const f = useCurrentFrame();
  const drift = interpolate(f, [0, sc.frames], [1.04, 1.12]);
  const rise = interpolate(f, [8, 38], [40, 0], { easing: IRIS, ...clamp });
  const out = interpolate(f, [sc.frames - 14, sc.frames], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ overflow: 'hidden', opacity: out }}>
      <AbsoluteFill
        style={{
          transform: `scale(${drift})`,
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingBottom: 90,
          background: `linear-gradient(135deg, white, ${b.accent}22 55%, ${PAPER})`,
        }}
      >
        {sc.image ? (
          <Img
            src={staticFile(sc.image)}
            style={{
              position: 'absolute',
              inset: 0,
              width: W,
              height: H,
              objectFit: 'cover',
            }}
          />
        ) : sc.slot ? (
          <div
            style={{
              border: `3px dashed ${b.accent}99`,
              borderRadius: 18,
              padding: '14px 28px',
              color: `${b.ink}bb`,
              font: `600 28px ${font(b.body)}`,
              background: '#ffffffb0',
            }}
          >
            YOUR PHOTO HERE: {sc.photo} (with their OK)
          </div>
        ) : null}
      </AbsoluteFill>
      {sc.image && (
        <AbsoluteFill
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(255,255,255,0.72), rgba(255,255,255,0.15) 70%)',
          }}
        />
      )}
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <div
          style={{
            font: `700 24px ${font(b.body)}`,
            letterSpacing: '0.5em',
            color: b.accent,
          }}
        >
          {sc.eyebrow}
        </div>
        <div
          style={{
            transform: `translateY(${rise}px)`,
            textShadow: '0 2px 30px rgba(255,255,255,0.85)',
          }}
        >
          <Headline sc={sc} b={b} size={96} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Ticker: React.FC<{ b: Brand; topics: string[] }> = ({ b, topics }) => {
  const f = useCurrentFrame();
  const line = topics.join('  •  ') + '  •  ';
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 64,
        background: CARD,
        borderTop: `2px solid ${b.ink}`,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          whiteSpace: 'nowrap',
          font: `700 26px ${font(b.display)}`,
          letterSpacing: '0.08em',
          color: b.accent,
          transform: `translateX(${-f * 4}px)`,
        }}
      >
        {line + line + line + line}
      </div>
    </div>
  );
};

// the logo, a real piece of the home page, flies in and locks; the business name sits under it
const Lockup: React.FC<{ film: Film }> = ({ film }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = spring({ frame: f, fps, config: { damping: 15, stiffness: 90 } });
  const name = spring({
    frame: f - 14,
    fps,
    config: { damping: 18, stiffness: 90 },
  });
  const p = film.logo.piece,
    b = film.brand;
  const scale = p ? Math.min(3.6, 900 / p.w, 260 / p.h) : 1;
  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 40,
        perspective: 1200,
      }}
    >
      {p && (
        <div
          style={{
            width: p.w,
            height: p.h,
            borderRadius: 8,
            backgroundImage: `url(${staticFile(`${film.logo.seg}/full.png`)})`,
            backgroundPosition: `-${p.x}px -${p.y}px`,
            backgroundSize: `${W}px ${H}px`,
            transform: `translateZ(${-1200 * (1 - k)}px) rotateX(${70 * (1 - k)}deg) scale(${scale})`,
            opacity: k,
            marginBottom: ((scale - 1) * p.h) / 2,
          }}
        />
      )}
      <div
        style={{
          font: `800 ${p ? 64 : 120}px ${font(b.display)}`,
          color: b.ink,
          opacity: name,
          transform: `translateY(${30 * (1 - name)}px)`,
        }}
      >
        {film.name}
      </div>
      <div
        style={{
          font: `600 30px ${font(b.body)}`,
          color: b.accent,
          opacity: name,
          letterSpacing: '0.04em',
        }}
      >
        {film.url.replace(/^https?:\/\/(www\.)?/, '')}
      </div>
    </AbsoluteFill>
  );
};

const FilmView: React.FC<{ film: Film }> = ({ film }) => {
  useFonts(film.brand);
  const pieces = usePieces(film);
  if (!pieces) return null;
  const b = film.brand;
  return (
    <AbsoluteFill>
      <Paper b={b} />
      {film.scenes.map(sc => (
        <Sequence key={sc.n} from={sc.from} durationInFrames={sc.frames}>
          {sc.type === 'assemble' && (
            <Assemble sc={sc} pieces={pieces[sc.seg]} />
          )}
          {sc.type === 'steps' && <Steps sc={sc} b={b} />}
          {sc.type === 'kit' && <Kit sc={sc} b={b} />}
          {sc.type === 'photo' && <Photo sc={sc} b={b} />}
          {sc.ticker && film.topics.length > 0 && (
            <Ticker b={b} topics={film.topics} />
          )}
          <Sequence from={LEAD}>
            <Audio src={staticFile(sc.vo)} />
          </Sequence>
          {sc.type !== 'photo' && (
            <Sequence from={22}>
              <Audio src={staticFile('_sfx/assemble.mp3')} volume={0.4} />
            </Sequence>
          )}
          {sc.type === 'assemble' && (
            <Sequence from={sc.frames - 24}>
              <Audio src={staticFile('_sfx/whoosh.mp3')} volume={0.45} />
            </Sequence>
          )}
          {sc.type === 'photo' && (
            <Audio src={staticFile('_sfx/whoosh.mp3')} volume={0.35} />
          )}
        </Sequence>
      ))}
      <Sequence from={film.endFrom}>
        <Lockup film={film} />
        <Audio src={staticFile('_sfx/impact.mp3')} volume={0.55} />
      </Sequence>
      <Sequence from={0} durationInFrames={90}>
        <Audio src={staticFile('_sfx/impact.mp3')} volume={0.55} />
      </Sequence>
    </AbsoluteFill>
  );
};

// YouTube thumbnail (1280x720 at 1.5x): the real home screen tilted in 3D beside the name and the film's pixel line
const ThumbView: React.FC<{ film: Film }> = ({ film }) => {
  useFonts(film.brand);
  const b = film.brand;
  const line = film.scenes.find(s => s.pixel);
  return (
    <AbsoluteFill>
      <Paper b={b} />
      <AbsoluteFill style={{ perspective: 1600 }}>
        <div
          style={{
            position: 'absolute',
            left: 860,
            top: 150,
            width: W,
            height: H,
            transformOrigin: 'left top',
            transform: 'scale(0.62) rotateY(-24deg) rotateX(6deg)',
            borderRadius: 26,
            overflow: 'hidden',
            boxShadow:
              '0 50px 110px rgba(11,27,51,0.28), 0 0 0 2px rgba(11,27,51,0.08)',
          }}
        >
          <Img
            src={staticFile(`${film.scenes[0].seg}/full.png`)}
            style={{ width: W, height: H }}
          />
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          padding: '0 0 0 110px',
          justifyContent: 'center',
          gap: 28,
          width: 900,
        }}
      >
        <div style={{ width: 120, height: 12, background: b.accent }} />
        <div
          style={{
            font: `800 112px ${font(b.display)}`,
            color: b.ink,
            lineHeight: 0.98,
            letterSpacing: '-0.03em',
          }}
        >
          {film.name}
        </div>
        {line && (
          <div
            style={{
              font: `700 58px ${font(b.display)}`,
              color: b.ink,
              lineHeight: 1.1,
              maxWidth: 680,
            }}
          >
            {line.before}{' '}
            <span style={{ font: `900 66px ${PIXEL}`, color: b.accent }}>
              {line.pixel}
            </span>
            {line.after === '.' ? '.' : ` ${line.after}`}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Root: React.FC = () => (
  <>
    <Composition
      id="Thumb"
      component={ThumbView as unknown as React.FC<Record<string, unknown>>}
      width={W}
      height={H}
      fps={FPS}
      durationInFrames={1}
      defaultProps={{ film: null }}
    />
    <Composition
      id="Film"
      component={FilmView as unknown as React.FC<Record<string, unknown>>}
      width={W}
      height={H}
      fps={FPS}
      durationInFrames={300}
      defaultProps={{ film: null }}
      calculateMetadata={({ props }) => ({
        durationInFrames: (props as unknown as { film: Film }).film
          .durationInFrames,
      })}
    />
  </>
);
registerRoot(Root);
