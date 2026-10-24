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
  useVideoConfig,
} from 'remotion';
import {
  DEFAULT_STYLE,
  Style,
  StagePaper,
  StyleOverlay,
  StyleProvider,
  useFrame,
  useStyle,
} from './style';

type Piece = {
  i: number;
  tag: string;
  text: string;
  pic?: boolean;
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
  chapter?: string;
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
  style?: Style;
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
  const st = useStyle();
  const s = (k: string) => random(`${seed}-${p.i}-${k}`) * 2 - 1;
  const away = Math.min(t, 1),
    out = Math.max(t - 1, 0),
    scatter = 1 - away;
  const glow = away > 0.96 && out === 0 ? 1 - (away - 0.96) / 0.04 : 0;
  const mode = st.motion.arrival;
  if (mode === 'outline' || mode === 'slide') {
    // outline: the piece is drawn as a blueprint box, then fills with its real pixels; slide: it snaps in along the grid
    const fill =
      mode === 'outline'
        ? interpolate(away, [0.45, 1], [0, 1], clamp)
        : interpolate(away, [0, 0.4], [0, 1], clamp);
    const dx = mode === 'slide' ? -220 * scatter + 900 * out : 0;
    return (
      <div
        style={{
          position: 'absolute',
          left: p.x,
          top: p.y,
          width: p.w,
          height: p.h,
          transform: `translateX(${dx}px) translateY(${mode === 'outline' ? -600 * out : 0}px)`,
          opacity: interpolate(out, [0.5, 1], [1, 0], clamp),
          outline:
            mode === 'outline'
              ? `1.5px solid rgba(31,95,191,${0.8 * (1 - fill) * Math.min(1, away * 3)})`
              : undefined,
          outlineOffset: 3,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${src})`,
            backgroundPosition: `-${p.x}px -${p.y}px`,
            backgroundSize: `${W}px ${H}px`,
            opacity: fill,
            clipPath:
              mode === 'outline'
                ? `inset(0 ${100 - 100 * fill}% 0 0)`
                : undefined,
          }}
        />
      </div>
    );
  }
  const jitter = mode === 'stopmotion' ? s('j') * 1.6 : 0; // a hand-placed cut-out never sits perfectly square
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
        transform: `translate3d(${s('x') * 700 * scatter + s('ox') * 900 * out}px, ${s('y') * 450 * scatter + s('oy') * 600 * out}px, ${(-1400 + s('z') * 600) * scatter + 1500 * out}px) rotateX(${s('rx') * 75 * scatter + s('orx') * 50 * out}deg) rotateY(${s('ry') * 75 * scatter + s('ory') * 50 * out}deg) rotateZ(${jitter}deg)`,
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
  const f = useFrame();
  const { fps } = useVideoConfig();
  const grid = pieces.length < 4;
  const list = grid ? gridPieces() : pieces;
  const src = staticFile(`${sc.seg}/${grid ? 'full' : 'pieces'}.png`);
  const st = useStyle();
  const fb = useFilmBrand();
  const stagger = Math.min(st.motion.stagger, 40 / list.length);
  const breakAt = sc.frames - 24;
  const board = st.motion.arrival === 'board'; // isometric board: the stage stays tilted like a table top
  const tilt = board
    ? 1
    : interpolate(f, [0, 50], [1, 0], { easing: IRIS, ...clamp });
  const push = interpolate(f, [50, breakAt], [1, 1 + st.motion.push], clamp);
  const bleed = st.scenes.plate === 'bleed';
  const [tx, tz] = st.motion.tilt;
  const plate =
    interpolate(f, [8, 40], [0, 1], clamp) *
    interpolate(f, [breakAt + 6, sc.frames], [1, 0], clamp);
  const screen = st.scenes.screen ?? (bleed ? 'bleed' : 'frame');
  // the headline piece: where the camera goes in the full-bleed treatment, and what the blueprint labels first
  const hero =
    list.find(q => q.tag === 'h1') ??
    [...list].sort((a, c) => c.w * c.h - a.w * a.h)[0];
  const cam =
    screen === 'bleed' && hero
      ? interpolate(f, [36, breakAt], [1, 1.5], { easing: IRIS, ...clamp })
      : 1;
  const origin =
    screen === 'bleed' && hero
      ? `${hero.x + hero.w / 2}px ${hero.y + hero.h / 2}px`
      : '50% 50%';
  const flat = screen === 'duotone' || screen === 'blueprint';
  const base =
    screen === 'split'
      ? 0.6
      : screen === 'collage'
        ? 0.76
        : bleed
          ? 1
          : board
            ? 0.72
            : 0.8 + 0.06 * (1 - tilt);
  const shift = screen === 'split' ? 'translateX(330px) ' : '';
  const labels =
    screen === 'blueprint'
      ? [...list]
          .filter(q => q.text)
          .sort((a, c) => c.w * c.h - a.w * a.h)
          .slice(0, 4)
      : [];
  const settle = interpolate(f, [55, 80], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ perspective: 1700, perspectiveOrigin: '50% 40%' }}>
      {screen === 'split' && (
        <div
          style={{
            position: 'absolute',
            left: 110,
            top: 330,
            width: 560,
            opacity: plate,
          }}
        >
          <div
            style={{
              width: 120,
              height: 6,
              background: fb.accent,
              marginBottom: 28,
            }}
          />
          <div
            style={{
              font: `800 58px ${font(fb.display)}`,
              color: fb.ink,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
            }}
          >
            {sc.chapter}
          </div>
        </div>
      )}
      <AbsoluteFill
        style={{
          transformStyle: flat ? 'flat' : 'preserve-3d',
          transformOrigin: origin,
          transform: `${shift}scale(${base * push * cam}) rotateX(${tx * tilt}deg) rotateZ(${tz * tilt + (screen === 'collage' ? -2.5 : 0)}deg)`,
          filter:
            screen === 'duotone'
              ? 'grayscale(1) contrast(1.2) brightness(1.05)'
              : screen === 'blueprint'
                ? `grayscale(${1 - 0.6 * settle}) contrast(1.05)`
                : undefined,
          clipPath: screen === 'collage' ? TORN : undefined,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: bleed ? 0 : 22,
            overflow: 'hidden',
            opacity: plate,
            boxShadow: bleed
              ? 'none'
              : '0 40px 90px rgba(11,27,51,0.22), 0 0 0 1px rgba(11,27,51,0.08)',
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
            config: st.motion.spring,
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
        {screen === 'blueprint' &&
          list.map(p => (
            <div
              key={`o${p.i}`}
              style={{
                position: 'absolute',
                left: p.x - 4,
                top: p.y - 4,
                width: p.w + 8,
                height: p.h + 8,
                border: `2px dashed ${fb.accent}`,
                opacity: 0.75 * plate,
              }}
            />
          ))}
        {labels.map((p, k) => (
          <div
            key={`l${p.i}`}
            style={{
              position: 'absolute',
              left: p.x + p.w + 24,
              top: p.y + p.h / 2 - 16 + k * 4,
              opacity: settle * plate,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              font: `700 22px ${font(fb.body)}`,
              color: fb.accent,
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ width: 60, height: 2, background: fb.accent }} />
            {String(k + 1).padStart(2, '0')}{' '}
            {p.tag === 'h1'
              ? 'HEADLINE'
              : p.tag === 'a' || p.tag === 'button'
                ? 'ACTION'
                : p.pic
                  ? 'PROOF'
                  : 'DETAIL'}
          </div>
        ))}
      </AbsoluteFill>
      {screen === 'duotone' && (
        <AbsoluteFill
          style={{
            background: fb.accent,
            mixBlendMode: 'screen',
            opacity: 0.55 * plate,
            pointerEvents: 'none',
          }}
        />
      )}
      {screen === 'collage' && (
        <>
          <div
            style={{
              position: 'absolute',
              left: 300,
              top: 120,
              width: 190,
              height: 50,
              background: 'rgba(250,240,200,0.75)',
              transform: 'rotate(-14deg)',
              opacity: plate,
              boxShadow: '0 2px 4px rgba(0,0,0,0.12)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 300,
              top: 150,
              width: 190,
              height: 50,
              background: 'rgba(250,240,200,0.75)',
              transform: 'rotate(11deg)',
              opacity: plate,
              boxShadow: '0 2px 4px rgba(0,0,0,0.12)',
            }}
          />
        </>
      )}
    </AbsoluteFill>
  );
};

// a hand-torn paper edge for the collage treatment (fixed points so every frame tears the same way)
const TORN = `polygon(${[
  [0, 2],
  [8, 0],
  [17, 1.5],
  [29, 0],
  [41, 2],
  [55, 0.5],
  [68, 2],
  [80, 0],
  [92, 1.5],
  [100, 0],
  [99, 14],
  [100, 31],
  [98.5, 52],
  [100, 70],
  [99, 88],
  [100, 100],
  [88, 98.5],
  [74, 100],
  [61, 98],
  [47, 100],
  [33, 98.5],
  [19, 100],
  [7, 98],
  [0, 100],
  [1, 81],
  [0, 63],
  [1.5, 44],
  [0, 26],
]
  .map(([x, y]) => `${x}% ${y}%`)
  .join(', ')})`;

const BrandCtx = React.createContext<Brand>({
  display: 'Inter',
  body: 'Inter',
  accent: '#1f5fbf',
  ink: '#111827',
});
const useFilmBrand = () => React.useContext(BrandCtx);

const Headline: React.FC<{ sc: Scene; b: Brand; size: number }> = ({
  sc,
  b,
  size,
}) => {
  const st = useStyle();
  return (
    <div
      style={{
        font: `${st.type.headlineWeight} ${size}px ${font(b.display)}`,
        color: b.ink,
        textAlign: st.type.align,
        lineHeight: 1.08,
        letterSpacing: '-0.02em',
        maxWidth: 1600,
      }}
    >
      {sc.before}{' '}
      <span
        style={{
          font: st.type.pixelWord
            ? `900 ${size * 1.12}px ${PIXEL}`
            : `900 ${size}px ${font(b.display)}`,
          color: b.accent,
          letterSpacing: 0,
          textTransform: st.type.pixelWord ? undefined : 'lowercase',
        }}
      >
        {sc.pixel}
      </span>
      {sc.after === '.' ? '.' : ` ${sc.after}`}
    </div>
  );
};

// the business's own steps as numbered tiles that drop in like kit parts, with hard offset shadows
const Steps: React.FC<{ sc: Scene; b: Brand }> = ({ sc, b }) => {
  const f = useFrame();
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
  const tiles = useStyle().scenes.tiles;
  const tileLook = (kk: number, k: number): React.CSSProperties =>
    tiles === 'rule'
      ? {
          background: 'transparent',
          border: 'none',
          borderTop: `4px solid ${b.accent}`,
          boxShadow: 'none',
        }
      : tiles === 'paper'
        ? {
            background: CARD,
            transform: `rotate(${(k % 2 ? 1 : -1) * 1.4}deg) translateY(${-200 * (1 - kk)}px)`,
            boxShadow: '0 10px 18px rgba(60,40,10,0.22)',
          }
        : tiles === 'ink'
          ? {
              background: `${b.accent}26`,
              border: `2px solid ${b.accent}`,
              boxShadow: `${6 * kk}px ${6 * kk}px 0 ${b.accent}88`,
            }
          : {};
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
                ...tileLook(kk, k),
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
  const f = useFrame();
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
  const f = useFrame();
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
  const f = useFrame();
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
  const f = useFrame();
  const { fps } = useVideoConfig();
  const k = spring({ frame: f, fps, config: { damping: 15, stiffness: 90 } });
  const name = spring({
    frame: f - 14,
    fps,
    config: { damping: 18, stiffness: 90 },
  });
  const p = film.logo.piece,
    b = film.brand;
  const scale = p ? Math.min(2.2, 900 / p.w, 260 / p.h) : 1; // beyond about 2x a captured raster logo goes soft
  const mode = useStyle().scenes.lockup ?? 'centre';
  const left = mode === 'left';
  return (
    <AbsoluteFill
      style={{
        alignItems: left ? 'flex-start' : 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 40,
        paddingLeft: left ? 160 : 0,
        perspective: 1200,
      }}
    >
      {left && (
        <div
          style={{ width: 160, height: 8, background: b.accent, opacity: name }}
        />
      )}
      {p && (
        <div
          style={{
            width: p.w,
            height: p.h,
            borderRadius: mode === 'scrap' ? 2 : 8,
            transformOrigin: left ? 'left center' : 'center',
            filter:
              mode === 'duotone' ? 'grayscale(1) contrast(1.3)' : undefined,
            outline:
              mode === 'outline'
                ? `2px dashed ${b.accent}`
                : mode === 'scrap'
                  ? '14px solid #fffdf8'
                  : undefined,
            outlineOffset: mode === 'outline' ? 10 : 0,
            boxShadow:
              mode === 'scrap' ? '0 18px 30px rgba(60,40,10,0.25)' : undefined,
            backgroundImage: `url(${staticFile(`${film.logo.seg}/full.png`)})`,
            backgroundPosition: `-${p.x}px -${p.y}px`,
            backgroundSize: `${W}px ${H}px`,
            transform: `translateZ(${-1200 * (1 - k)}px) rotateX(${70 * (1 - k)}deg) scale(${scale}) rotate(${mode === 'scrap' ? -3 : 0}deg)`,
            opacity: k,
            marginBottom: ((scale - 1) * p.h) / 2,
          }}
        />
      )}
      {/* the name, unless the logo already says it (its label names the business) */}
      {!(p && p.text.toLowerCase().includes(film.name.toLowerCase())) && (
        <div
          style={{
            font: `800 ${p ? (left ? 96 : 64) : 120}px ${font(b.display)}`,
            color: mode === 'duotone' ? b.accent : b.ink,
            opacity: name,
            transform: `translateY(${30 * (1 - name)}px)`,
          }}
        >
          {film.name}
        </div>
      )}
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
  const style = film.style ?? DEFAULT_STYLE;
  return (
    <StyleProvider value={style}>
      <BrandCtx.Provider value={b}>
        <AbsoluteFill>
          <StagePaper accent={b.accent} ink={b.ink} />
          {film.scenes.map(sc => (
            <Sequence key={sc.n} from={sc.from} durationInFrames={sc.frames}>
              {sc.type === 'assemble' && (
                <Assemble sc={sc} pieces={pieces[sc.seg]} />
              )}
              {sc.type === 'steps' && <Steps sc={sc} b={b} />}
              {sc.type === 'kit' && <Kit sc={sc} b={b} />}
              {sc.type === 'photo' && <Photo sc={sc} b={b} />}
              {sc.ticker && style.scenes.ticker && film.topics.length > 0 && (
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
          <StyleOverlay accent={b.accent} />
        </AbsoluteFill>
      </BrandCtx.Provider>
    </StyleProvider>
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
              maxWidth: 720,
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
