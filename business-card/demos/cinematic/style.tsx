// Film styles: one data file per named look (styles/<id>.json), applied by the composition through this context.
// A style changes treatment only (paper, how pieces arrive, stage and camera, tiles, the pixel word, grain).
// The words, real screens, owned photos and Margot's narration never change between styles.
import React, { createContext, useContext } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';

export type Style = {
  id: string;
  name: string;
  palette: {
    paper: string; // stage colour
    pattern: 'hex' | 'blueprint' | 'columns' | 'kraft' | 'halftone' | 'none';
    patternInk: 'accent' | 'ink';
    overlay: 'none' | 'riso' | 'grain';
  };
  type: {
    pixelWord: boolean;
    headlineWeight: number;
    align: 'center' | 'left';
  };
  motion: {
    arrival: 'fly' | 'outline' | 'slide' | 'stopmotion' | 'board';
    tilt: [number, number]; // stage rotateX, rotateZ while assembling (degrees)
    stagger: number; // max frames between pieces
    spring: { damping: number; stiffness: number; mass: number };
    quantise: number; // 1 = every frame, 2 = on twos (stop-motion feel)
    push: number; // slow camera push over the hold, e.g. 0.05
  };
  scenes: {
    plate: 'frame' | 'bleed';
    tiles: 'offset' | 'rule' | 'paper' | 'ink';
    ticker: boolean;
    // how the real screen is treated: framed panel, full-bleed camera move, Swiss split, torn cut-out, two-ink print, blueprint
    screen?: 'frame' | 'bleed' | 'split' | 'collage' | 'duotone' | 'blueprint';
    lockup?: 'centre' | 'left' | 'scrap' | 'duotone' | 'outline';
  };
};

// the approved CARSI test look, used when a plan names no style
export const DEFAULT_STYLE: Style = {
  id: 'kit-bench',
  name: 'Kit Bench',
  palette: {
    paper: '#f4f1ea',
    pattern: 'hex',
    patternInk: 'accent',
    overlay: 'none',
  },
  type: { pixelWord: true, headlineWeight: 700, align: 'center' },
  motion: {
    arrival: 'fly',
    tilt: [28, -6],
    stagger: 4,
    spring: { damping: 14, stiffness: 80, mass: 1 },
    quantise: 1,
    push: 0.05,
  },
  scenes: { plate: 'frame', tiles: 'offset', ticker: true },
};

const Ctx = createContext<Style>(DEFAULT_STYLE);
export const StyleProvider = Ctx.Provider;
export const useStyle = () => useContext(Ctx);

// the frame, held on twos (or more) when the style asks for a stop-motion feel
export function useFrame() {
  const f = useCurrentFrame();
  const q = useContext(Ctx).motion.quantise || 1;
  return q > 1 ? Math.floor(f / q) * q : f;
}

const svg = (body: string, w: number, h: number) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`)}")`;

const PATTERN: Record<
  Style['palette']['pattern'],
  (ink: string) => { image: string; size: string } | null
> = {
  hex: ink => ({
    image: svg(
      `<path d="M60 0l60 34.6v69.3L60 138.6 0 103.9V34.6zM60 138.6V208" fill="none" stroke="${ink}" stroke-opacity="0.12" stroke-width="1.5"/>`,
      120,
      208
    ),
    size: '120px 208px',
  }),
  blueprint: ink => ({
    image: svg(
      `<path d="M0 .5H48M.5 0V48" stroke="${ink}" stroke-opacity="0.22"/><path d="M0 24.5H48M24.5 0V48" stroke="${ink}" stroke-opacity="0.08"/>`,
      48,
      48
    ),
    size: '48px 48px',
  }),
  columns: ink => ({
    image: svg(
      `<rect x="0" y="0" width="1" height="10" fill="${ink}" fill-opacity="0.18"/>`,
      160,
      10
    ),
    size: '160px 10px',
  }),
  kraft: () => ({
    image: svg(
      `<filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2"/><feColorMatrix values="0 0 0 0 .35 0 0 0 0 .25 0 0 0 0 .12 0 0 0 .18 0"/></filter><rect width="200" height="200" filter="url(#n)"/>`,
      200,
      200
    ),
    size: '200px 200px',
  }),
  halftone: ink => ({
    image: svg(
      `<circle cx="4" cy="4" r="1.4" fill="${ink}" fill-opacity="0.16"/>`,
      8,
      8
    ),
    size: '8px 8px',
  }),
  none: () => null,
};

// the stage behind every scene
export const StagePaper: React.FC<{ accent: string; ink: string }> = ({
  accent,
  ink,
}) => {
  const s = useStyle();
  const pat = PATTERN[s.palette.pattern](
    s.palette.patternInk === 'accent' ? accent : ink
  );
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 35%, ${lighten(s.palette.paper)} 0%, ${s.palette.paper} 75%)`,
      }}
    >
      {pat && (
        <AbsoluteFill
          style={{
            backgroundImage: pat.image,
            backgroundSize: pat.size,
            maskImage:
              s.palette.pattern === 'kraft'
                ? undefined
                : 'radial-gradient(ellipse at center, black 35%, transparent 85%)',
          }}
        />
      )}
    </AbsoluteFill>
  );
};

// print texture laid over the whole frame: two-ink risograph dots, or fine grain
export const StyleOverlay: React.FC<{ accent: string }> = ({ accent }) => {
  const s = useStyle();
  const f = useFrame();
  if (s.palette.overlay === 'none') return null;
  if (s.palette.overlay === 'grain') {
    return (
      <AbsoluteFill
        style={{
          backgroundImage: PATTERN.kraft('')!.image,
          backgroundPosition: `${(f * 37) % 200}px ${(f * 53) % 200}px`,
          opacity: 0.35,
          mixBlendMode: 'multiply',
        }}
      />
    );
  }
  return (
    <AbsoluteFill
      style={{
        backgroundImage: PATTERN.halftone(accent)!.image,
        backgroundSize: '6px 6px',
        backgroundPosition: '2px 1px', // slight misregistration, as on a riso print
        mixBlendMode: 'multiply',
        opacity: 0.9,
      }}
    />
  );
};

// a touch lighter than the paper for the centre of the stage
function lighten(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.min(255, Math.round(v + (255 - v) * 0.6));
  return `rgb(${ch((n >> 16) & 255)}, ${ch((n >> 8) & 255)}, ${ch(n & 255)})`;
}
