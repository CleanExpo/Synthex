'use client';

/**
 * InvisibleLineAnthem Composition
 *
 * Master ~68-second cinematic motion-graphics anthem for
 * "The Invisible Line" — RestoreAssist / NRPG / DisasterRecovery.com.au.
 *
 * 6 acts + outro sequenced to pre-generated voiceover files.
 * 1920×1080 · 30fps · 2030 frames (~67.7s)
 *
 * Sequence timings (EXACT — must not drift or VO de-syncs):
 *   Act I   — Invisible Threat    from=0    dur=270
 *   Act II  — Flawed System       from=270  dur=495
 *   Act III — Paradigm Shift      from=765  dur=140
 *   Act IV  — The Methods         from=905  dur=400
 *   Act V   — The Proof           from=1305 dur=315
 *   Act VI  — The Sanctuary       from=1620 dur=200
 *   Outro                         from=1820 dur=210
 */

import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
  Audio,
  staticFile,
} from 'remotion';
import { InvisibleLineOutro } from './InvisibleLineOutro';

// ── Design tokens ──────────────────────────────────────────────────────────────

const CHARCOAL = '#16181B';
const OFF_WHITE = '#F5F5F2';
const MUTED_GREY = '#8A9196';
const THERMAL_BLUE = '#2E9BD6';
const WARNING_AMBER = '#E8A33D';
const WARM_SANCTUARY = '#E8C9A0';
const FONT_SANS = "system-ui, -apple-system, 'Segoe UI', sans-serif";

// ── Shared helpers ─────────────────────────────────────────────────────────────

/** Clamp-interpolate shorthand. */
function ci(
  frame: number,
  inRange: [number, number],
  outRange: [number, number]
): number {
  return interpolate(frame, inRange, outRange, {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

/** Spring-driven opacity + translateY entrance. */
function useSlideIn(
  frame: number,
  fps: number,
  startFrame: number
): { opacity: number; translateY: number } {
  const localFrame = Math.max(0, frame - startFrame);
  const s = spring({
    frame: localFrame,
    fps,
    config: { damping: 16, stiffness: 180 },
  });
  return {
    opacity: ci(frame, [startFrame, startFrame + 12], [0, 1]),
    translateY: interpolate(s, [0, 1], [28, 0]),
  };
}

// ── Reusable components ────────────────────────────────────────────────────────

/** Small-caps "act label" — fades in at top-left. */
function ActLabel({
  text,
  startFrame = 0,
  colour = MUTED_GREY,
  centred = false,
}: {
  text: string;
  startFrame?: number;
  colour?: string;
  centred?: boolean;
}) {
  const frame = useCurrentFrame();
  const opacity = ci(frame, [startFrame, startFrame + 18], [0, 1]);
  return (
    <div
      style={{
        position: 'absolute',
        top: 48,
        left: centred ? undefined : 64,
        right: centred ? undefined : undefined,
        width: centred ? '100%' : undefined,
        textAlign: centred ? 'center' : undefined,
        opacity,
        fontFamily: FONT_SANS,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '3.5px',
        textTransform: 'uppercase' as const,
        color: colour,
      }}
    >
      {text}
    </div>
  );
}

/** Single word/phrase that springs in with stagger. */
function KineticWord({
  text,
  startFrame,
  fontSize = 52,
  fontWeight = 800,
  colour = OFF_WHITE,
  centred = false,
}: {
  text: string;
  startFrame: number;
  fontSize?: number;
  fontWeight?: number;
  colour?: string;
  centred?: boolean;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { opacity, translateY } = useSlideIn(frame, fps, startFrame);
  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        fontFamily: FONT_SANS,
        fontSize,
        fontWeight,
        color: colour,
        lineHeight: 1.15,
        textAlign: centred ? 'center' : undefined,
        letterSpacing: fontWeight >= 800 ? '-1px' : '0px',
      }}
    >
      {text}
    </div>
  );
}

/** Cross-fade envelope — apply to each act for soft in/out. */
function CrossFade({
  totalFrames,
  fadeFrames = 10,
  hardCutIn = false,
}: {
  totalFrames: number;
  fadeFrames?: number;
  hardCutIn?: boolean;
}) {
  const frame = useCurrentFrame();
  const fadeIn = hardCutIn ? 1 : ci(frame, [0, fadeFrames], [0, 1]);
  const fadeOut = ci(frame, [totalFrames - fadeFrames, totalFrames], [1, 0]);
  const opacity = Math.min(fadeIn, fadeOut);
  return <AbsoluteFill style={{ opacity, pointerEvents: 'none' }} />;
}

/** Thin 1px thermal-blue horizontal "line" motif. */
function ThermalLine({
  startFrame = 0,
  drawEndFrame = 30,
  top = '50%',
}: {
  startFrame?: number;
  drawEndFrame?: number;
  top?: string | number;
}) {
  const frame = useCurrentFrame();
  const widthPct = ci(frame, [startFrame, drawEndFrame], [0, 100]);
  const opacity = ci(frame, [startFrame, startFrame + 4], [0, 1]);
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: 0,
        width: '100%',
        height: 1,
        opacity,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${widthPct}%`,
          backgroundColor: THERMAL_BLUE,
          boxShadow: `0 0 6px ${THERMAL_BLUE}`,
        }}
      />
    </div>
  );
}

// ── Act I — The Invisible Threat ───────────────────────────────────────────────

function InvisibleThreatScene() {
  const frame = useCurrentFrame();
  // Wicking gradient creeps up: 0% → 100% over the act
  const wickHeight = ci(frame, [0, 270], [0, 100]);
  // Heartbeat pulse: subtle opacity variation on the wick
  const heartbeat = 0.06 + 0.06 * Math.sin((frame / 30) * Math.PI * 2);

  return (
    <AbsoluteFill style={{ backgroundColor: CHARCOAL }}>
      {/* Cross-fade envelope */}
      <AbsoluteFill
        style={{
          opacity: ci(frame, [0, 10], [0, 1]) * ci(frame, [260, 270], [1, 0]),
        }}
      >
        {/* Wicking gradient from bottom — desaturated grey-green */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            height: `${wickHeight}%`,
            background: `linear-gradient(to top, rgba(48,68,48,${0.18 + heartbeat}) 0%, rgba(38,52,38,0.06) 80%, transparent 100%)`,
            transition: 'none',
          }}
        />

        {/* Subtle vignette */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)',
          }}
        />

        <ActLabel text="CATEGORY 3 · THE INVISIBLE THREAT" startFrame={8} />

        {/* Kinetic VO phrases — staggered fade in/out groups */}
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column',
            gap: 18,
            paddingLeft: 120,
            paddingRight: 120,
          }}
        >
          {/* "WHEN THE STORM PASSES." — frames 20–90 */}
          <div
            style={{
              opacity:
                ci(frame, [20, 32], [0, 1]) * ci(frame, [80, 92], [1, 0]),
              transform: `translateY(${interpolate(ci(frame, [20, 32], [0, 1]), [0, 1], [24, 0])}px)`,
            }}
          >
            <KineticWord
              text="WHEN THE STORM PASSES."
              startFrame={20}
              fontSize={58}
              fontWeight={300}
              colour={OFF_WHITE}
              centred
            />
          </div>

          {/* "THE TRAUMA IS VISIBLE." — frames 60–140 */}
          <div
            style={{
              opacity:
                ci(frame, [60, 72], [0, 1]) * ci(frame, [130, 142], [1, 0]),
              transform: `translateY(${interpolate(ci(frame, [60, 72], [0, 1]), [0, 1], [24, 0])}px)`,
            }}
          >
            <KineticWord
              text="THE TRAUMA IS VISIBLE."
              startFrame={60}
              fontSize={42}
              fontWeight={300}
              colour={MUTED_GREY}
              centred
            />
          </div>

          {/* "BUT THE TRUE DISASTER…" — frames 120–200 */}
          <div
            style={{
              opacity:
                ci(frame, [120, 132], [0, 1]) * ci(frame, [190, 202], [1, 0]),
              transform: `translateY(${interpolate(ci(frame, [120, 132], [0, 1]), [0, 1], [24, 0])}px)`,
            }}
          >
            <KineticWord
              text="BUT THE TRUE DISASTER…"
              startFrame={120}
              fontSize={50}
              fontWeight={800}
              colour={OFF_WHITE}
              centred
            />
          </div>

          {/* "IS WHAT YOU CAN'T SEE." — frames 175–265 */}
          <div
            style={{
              opacity:
                ci(frame, [175, 187], [0, 1]) * ci(frame, [255, 268], [1, 0]),
              transform: `translateY(${interpolate(ci(frame, [175, 187], [0, 1]), [0, 1], [24, 0])}px)`,
            }}
          >
            <KineticWord
              text="IS WHAT YOU CAN'T SEE."
              startFrame={175}
              fontSize={58}
              fontWeight={900}
              colour={OFF_WHITE}
              centred
            />
          </div>
        </AbsoluteFill>

        {/* Persistent thermal line at bottom of text zone */}
        <ThermalLine startFrame={220} drawEndFrame={255} top="70%" />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ── Act II — The Flawed System ─────────────────────────────────────────────────

function FlawedSystemScene() {
  const frame = useCurrentFrame();
  // Jitter: sine-based 2-3px shake
  const jitterX = 2.5 * Math.sin(frame * 0.7);
  const jitterY = 1.5 * Math.sin(frame * 1.1 + 1.2);
  // Ticking second-hand: rotates every 30 frames
  const secondAngle = (frame % 30) * (360 / 30);
  // Amber pulse
  const amberPulse = 0.7 + 0.3 * Math.sin((frame / 18) * Math.PI);
  const fadeIn = ci(frame, [0, 10], [0, 1]);
  const fadeOut = ci(frame, [485, 495], [1, 0]);
  const envelopeOpacity = fadeIn * fadeOut;

  return (
    <AbsoluteFill style={{ backgroundColor: CHARCOAL }}>
      <AbsoluteFill style={{ opacity: envelopeOpacity }}>
        {/* Amber accent stripe at top */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: 3,
            backgroundColor: WARNING_AMBER,
            opacity: amberPulse * 0.8,
            boxShadow: `0 0 16px ${WARNING_AMBER}`,
          }}
        />

        <ActLabel
          text="THE COMPROMISED SYSTEM"
          startFrame={6}
          colour={WARNING_AMBER}
        />

        {/* Main jitter container */}
        <AbsoluteFill
          style={{
            transform: `translate(${jitterX}px, ${jitterY}px)`,
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column',
            gap: 32,
          }}
        >
          {/* SLEDGEHAMMERS. headline — slams in at frame 20 */}
          <div style={{ opacity: ci(frame, [20, 26], [0, 1]) }}>
            <div
              style={{
                fontFamily: FONT_SANS,
                fontSize: 88,
                fontWeight: 900,
                color: OFF_WHITE,
                letterSpacing: '-3px',
                textTransform: 'uppercase' as const,
                lineHeight: 0.95,
                textAlign: 'center',
              }}
            >
              SLEDGEHAMMERS.
            </div>
          </div>

          {/* GUESSWORK. headline — slams in at frame 40 */}
          <div style={{ opacity: ci(frame, [40, 46], [0, 1]) }}>
            <div
              style={{
                fontFamily: FONT_SANS,
                fontSize: 88,
                fontWeight: 900,
                color: WARNING_AMBER,
                letterSpacing: '-3px',
                textTransform: 'uppercase' as const,
                lineHeight: 0.95,
                textAlign: 'center',
              }}
            >
              GUESSWORK.
            </div>
          </div>

          {/* Redacted lines motif — appears at frame 90 */}
          <div
            style={{
              opacity: ci(frame, [90, 104], [0, 1]),
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              marginTop: 24,
            }}
          >
            {[
              'COMPLIANCE REPORT ████████',
              'SCOPE OF WORKS ████ TICK ✓',
              'INVOICE ██████ APPROVED',
            ].map((line, i) => (
              <div
                key={i}
                style={{
                  fontFamily: FONT_SANS,
                  fontSize: 18,
                  fontWeight: 300,
                  letterSpacing: '2px',
                  color: MUTED_GREY,
                  textTransform: 'uppercase' as const,
                  opacity: ci(frame, [90 + i * 16, 104 + i * 16], [0, 1]),
                }}
              >
                {line}
              </div>
            ))}
          </div>
        </AbsoluteFill>

        {/* Ticking second-hand clock — bottom right */}
        <div
          style={{
            position: 'absolute',
            bottom: 64,
            right: 80,
            opacity: ci(frame, [60, 72], [0, 1]),
          }}
        >
          <svg width={64} height={64} viewBox="0 0 64 64">
            <circle
              cx={32}
              cy={32}
              r={28}
              fill="none"
              stroke={WARNING_AMBER}
              strokeWidth={1.5}
              opacity={0.5}
            />
            <line
              x1={32}
              y1={32}
              x2={32 + 22 * Math.sin((secondAngle * Math.PI) / 180)}
              y2={32 - 22 * Math.cos((secondAngle * Math.PI) / 180)}
              stroke={WARNING_AMBER}
              strokeWidth={1.5}
            />
            <circle cx={32} cy={32} r={2.5} fill={WARNING_AMBER} />
          </svg>
          <div
            style={{
              fontFamily: FONT_SANS,
              fontSize: 10,
              letterSpacing: '2px',
              color: WARNING_AMBER,
              textAlign: 'center',
              marginTop: 4,
              textTransform: 'uppercase' as const,
            }}
          >
            TICKING
          </div>
        </div>

        {/* "MASKING. PAINTING. COVERING UP." — later in act */}
        <div
          style={{
            position: 'absolute',
            bottom: 160,
            left: 0,
            right: 0,
            textAlign: 'center',
            opacity:
              ci(frame, [240, 256], [0, 1]) * ci(frame, [450, 466], [1, 0]),
          }}
        >
          <div
            style={{
              fontFamily: FONT_SANS,
              fontSize: 26,
              fontWeight: 300,
              letterSpacing: '6px',
              color: MUTED_GREY,
              textTransform: 'uppercase' as const,
            }}
          >
            MASKING · PAINTING · COVERING UP
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ── Act III — Paradigm Shift ───────────────────────────────────────────────────

function ParadigmShiftScene() {
  const frame = useCurrentFrame();
  // HARD CUT — no fade-in. Pure black → thermal-blue sweep
  const fadeOut = ci(frame, [130, 140], [1, 0]);

  // Thermal-blue wipe: expands from left, frames 0–18
  const wipeWidth = ci(frame, [0, 18], [0, 100]);

  // Bold headline appears after wipe passes through, frame 10
  const headlineOpacity = ci(frame, [10, 22], [0, 1]);
  const headlineY = interpolate(
    spring({
      frame: Math.max(0, frame - 10),
      fps: 30,
      config: { damping: 14, stiffness: 200 },
    }),
    [0, 1],
    [32, 0]
  );

  // The Line slashes across, frames 28–55
  const lineWidth = ci(frame, [28, 55], [0, 100]);
  const lineOpacity = ci(frame, [26, 30], [0, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000', opacity: fadeOut }}>
      {/* Thermal-blue sweep overlay — wipe from left */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: '100%',
          width: `${wipeWidth}%`,
          backgroundColor: THERMAL_BLUE,
          opacity: 0.12,
        }}
      />

      <ActLabel
        text="THE PARADIGM SHIFT"
        startFrame={4}
        colour={THERMAL_BLUE}
      />

      {/* Main headline */}
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          gap: 32,
        }}
      >
        <div
          style={{
            opacity: headlineOpacity,
            transform: `translateY(${headlineY}px)`,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontFamily: FONT_SANS,
              fontSize: 96,
              fontWeight: 900,
              color: OFF_WHITE,
              letterSpacing: '-3px',
              lineHeight: 0.95,
              textTransform: 'uppercase' as const,
            }}
          >
            WE DON'T GUESS.
          </div>
          <div
            style={{
              fontFamily: FONT_SANS,
              fontSize: 96,
              fontWeight: 900,
              color: THERMAL_BLUE,
              letterSpacing: '-3px',
              lineHeight: 0.95,
              textTransform: 'uppercase' as const,
              textShadow: `0 0 40px ${THERMAL_BLUE}66`,
            }}
          >
            WE MEASURE.
          </div>
        </div>

        {/* The Line — draws across */}
        <div
          style={{
            width: 960,
            height: 1,
            opacity: lineOpacity,
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: `${lineWidth}%`,
              backgroundColor: THERMAL_BLUE,
              boxShadow: `0 0 12px ${THERMAL_BLUE}, 0 0 24px ${THERMAL_BLUE}66`,
            }}
          />
        </div>

        {/* Sub-label */}
        <div
          style={{
            opacity: ci(frame, [60, 74], [0, 1]),
            fontFamily: FONT_SANS,
            fontSize: 14,
            fontWeight: 300,
            letterSpacing: '5px',
            color: MUTED_GREY,
            textTransform: 'uppercase' as const,
          }}
        >
          DRAW THE LINE
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ── Act IV — The Methods ───────────────────────────────────────────────────────

/** Single HUD method block animating in at blockStartFrame. */
function MethodBlock({
  label,
  sublabel,
  value,
  unit,
  blockStartFrame,
  accentColour = THERMAL_BLUE,
  flashGreen = false,
}: {
  label: string;
  sublabel: string;
  value: string | number;
  unit?: string;
  blockStartFrame: number;
  accentColour?: string;
  flashGreen?: boolean;
}) {
  const frame = useCurrentFrame();
  const localFrame = Math.max(0, frame - blockStartFrame);
  const opacity = ci(frame, [blockStartFrame, blockStartFrame + 14], [0, 1]);
  const green = flashGreen
    ? Math.floor(localFrame / 8) % 2 === 0
      ? '#00E676'
      : '#4CAF50'
    : undefined;
  const displayValue =
    typeof value === 'number'
      ? Math.floor(
          ci(
            frame,
            [blockStartFrame, blockStartFrame + 60],
            [0, value as number]
          )
        )
      : value;

  return (
    <div
      style={{
        opacity,
        border: `1px solid ${accentColour}33`,
        borderLeft: `2px solid ${accentColour}`,
        padding: '16px 24px',
        minWidth: 280,
        backgroundColor: `${accentColour}08`,
      }}
    >
      <div
        style={{
          fontFamily: FONT_SANS,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '3px',
          color: accentColour,
          textTransform: 'uppercase' as const,
          marginBottom: 8,
        }}
      >
        {sublabel}
      </div>
      <div
        style={{
          fontFamily: FONT_SANS,
          fontSize: 48,
          fontWeight: 800,
          color: flashGreen && green ? green : OFF_WHITE,
          letterSpacing: '-1px',
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {displayValue}
        {unit && (
          <span
            style={{
              fontSize: 18,
              fontWeight: 300,
              color: MUTED_GREY,
              marginLeft: 6,
            }}
          >
            {unit}
          </span>
        )}
      </div>
      <div
        style={{
          fontFamily: FONT_SANS,
          fontSize: 22,
          fontWeight: 700,
          color: OFF_WHITE,
          marginTop: 6,
          textTransform: 'uppercase' as const,
          letterSpacing: '1px',
        }}
      >
        {label}
      </div>
    </div>
  );
}

function TheMethodsScene() {
  const frame = useCurrentFrame();
  const fadeOut = ci(frame, [388, 400], [1, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: CHARCOAL,
        opacity: ci(frame, [0, 10], [0, 1]) * fadeOut,
      }}
    >
      {/* HUD scan-line overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(46,155,214,0.02) 3px, rgba(46,155,214,0.02) 4px)',
          pointerEvents: 'none',
        }}
      />

      <ActLabel
        text="THE METHODS · GOVERNED BY NRPG"
        startFrame={4}
        colour={THERMAL_BLUE}
      />

      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          gap: 24,
          paddingTop: 60,
        }}
      >
        {/* WATER block — frames 0–95 */}
        <div
          style={{
            opacity: ci(frame, [0, 4], [0, 1]) * ci(frame, [88, 100], [1, 0]),
          }}
        >
          <MethodBlock
            label="Water"
            sublabel="Psychrometry"
            value={87}
            unit="% EMC"
            blockStartFrame={0}
          />
        </div>

        {/* MOULD block — frames 95–190 */}
        <div
          style={{
            opacity:
              ci(frame, [95, 99], [0, 1]) * ci(frame, [183, 195], [1, 0]),
          }}
        >
          <MethodBlock
            label="Mould"
            sublabel="Negative Air · Containment"
            value="SEALED"
            blockStartFrame={95}
          />
        </div>

        {/* BIOHAZARD block — frames 190–285 */}
        <div
          style={{
            opacity:
              ci(frame, [190, 194], [0, 1]) * ci(frame, [278, 290], [1, 0]),
          }}
        >
          <MethodBlock
            label="Biohazard"
            sublabel="ATP Luminometer"
            value="0 RLU"
            blockStartFrame={190}
            flashGreen
          />
        </div>

        {/* FIRE block — frames 285–400 */}
        <div style={{ opacity: ci(frame, [285, 289], [0, 1]) }}>
          <MethodBlock
            label="Fire"
            sublabel="Dry-Chem · Soot Lift"
            value="CLEARED"
            blockStartFrame={285}
          />
        </div>
      </AbsoluteFill>

      {/* Footer */}
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: ci(frame, [30, 44], [0, 1]),
          fontFamily: FONT_SANS,
          fontSize: 11,
          fontWeight: 300,
          letterSpacing: '4px',
          color: MUTED_GREY,
          textTransform: 'uppercase' as const,
        }}
      >
        GOVERNED BY NRPG · OPEN SOURCE
      </div>

      {/* Persistent thermal line */}
      <ThermalLine startFrame={8} drawEndFrame={35} top={86} />
    </AbsoluteFill>
  );
}

// ── Act V — The Proof ──────────────────────────────────────────────────────────

function DashboardRow({
  label,
  value,
  startFrame,
  isCheckmark = false,
  timestamp,
}: {
  label: string;
  value: string;
  startFrame: number;
  isCheckmark?: boolean;
  timestamp?: string;
}) {
  const frame = useCurrentFrame();
  const opacity = ci(frame, [startFrame, startFrame + 12], [0, 1]);
  const translateX = interpolate(
    ci(frame, [startFrame, startFrame + 16], [0, 1]),
    [0, 1],
    [-20, 0]
  );

  return (
    <div
      style={{
        opacity,
        transform: `translateX(${translateX}px)`,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '12px 0',
        borderBottom: `1px solid ${THERMAL_BLUE}18`,
      }}
    >
      {isCheckmark && (
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            backgroundColor: '#00E676',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width={12} height={12} viewBox="0 0 12 12">
            <polyline
              points="2,6 5,9 10,3"
              fill="none"
              stroke="#000"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontFamily: FONT_SANS,
            fontSize: 11,
            fontWeight: 300,
            letterSpacing: '3px',
            color: MUTED_GREY,
            textTransform: 'uppercase' as const,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: FONT_SANS,
            fontSize: 22,
            fontWeight: 700,
            color: OFF_WHITE,
            marginTop: 2,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </div>
      </div>
      {timestamp && (
        <div
          style={{
            fontFamily: FONT_SANS,
            fontSize: 11,
            color: THERMAL_BLUE,
            letterSpacing: '1px',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {timestamp}
        </div>
      )}
    </div>
  );
}

function TheProofScene() {
  const frame = useCurrentFrame();
  const fadeOut = ci(frame, [303, 315], [1, 0]);
  // Animated VPD value: ticks up
  const vpdValue = ci(frame, [20, 100], [0.0, 2.34]).toFixed(2);
  // GPP value: ticks up
  const gppValue = Math.floor(ci(frame, [20, 120], [0, 48]));
  // Progress bar: 0→100% over frames 80–220
  const progressWidth = ci(frame, [80, 220], [0, 100]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: CHARCOAL,
        opacity: ci(frame, [0, 10], [0, 1]) * fadeOut,
      }}
    >
      {/* HUD scan lines */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(46,155,214,0.015) 3px, rgba(46,155,214,0.015) 4px)',
          pointerEvents: 'none',
        }}
      />

      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: 44,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: ci(frame, [6, 18], [0, 1]),
          fontFamily: FONT_SANS,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '4px',
          color: THERMAL_BLUE,
          textTransform: 'uppercase' as const,
        }}
      >
        RESTOREASSIST · IMMUTABLE EVIDENCE
      </div>

      <ThermalLine startFrame={10} drawEndFrame={36} top={88} />

      {/* Dashboard panel */}
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: 780,
            backgroundColor: '#0D0F12',
            border: `1px solid ${THERMAL_BLUE}22`,
            borderRadius: 4,
            padding: '32px 40px',
          }}
        >
          {/* VPD readout */}
          <DashboardRow
            label="Vapor Pressure Differential"
            value={`${vpdValue} kPa`}
            startFrame={18}
          />

          {/* GPP readout */}
          <DashboardRow
            label="Grains Per Pound"
            value={`${gppValue} GPP`}
            startFrame={50}
          />

          {/* 3D Structural Scan progress bar */}
          <div
            style={{
              opacity: ci(frame, [75, 87], [0, 1]),
              padding: '16px 0',
              borderBottom: `1px solid ${THERMAL_BLUE}18`,
            }}
          >
            <div
              style={{
                fontFamily: FONT_SANS,
                fontSize: 11,
                fontWeight: 300,
                letterSpacing: '3px',
                color: MUTED_GREY,
                textTransform: 'uppercase' as const,
                marginBottom: 10,
              }}
            >
              3D Structural Scan
            </div>
            <div
              style={{
                width: '100%',
                height: 4,
                backgroundColor: `${THERMAL_BLUE}22`,
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${progressWidth}%`,
                  height: '100%',
                  backgroundColor: THERMAL_BLUE,
                  boxShadow: `0 0 8px ${THERMAL_BLUE}`,
                  borderRadius: 2,
                }}
              />
            </div>
            <div
              style={{
                fontFamily: FONT_SANS,
                fontSize: 18,
                fontWeight: 700,
                color: OFF_WHITE,
                marginTop: 8,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {Math.floor(progressWidth)}%
            </div>
          </div>

          {/* Chain of Custody rows */}
          <DashboardRow
            label="Chain of Custody"
            value="SITE INTAKE LOGGED"
            startFrame={140}
            isCheckmark
            timestamp="09:14:03"
          />
          <DashboardRow
            label="Chain of Custody"
            value="CLEARANCE SAMPLES COLLECTED"
            startFrame={175}
            isCheckmark
            timestamp="11:32:17"
          />
          <DashboardRow
            label="Chain of Custody"
            value="LAB CERTIFICATE ISSUED"
            startFrame={220}
            isCheckmark
            timestamp="14:55:44"
          />
          <DashboardRow
            label="Chain of Custody"
            value="SIGN-OFF LOCKED"
            startFrame={265}
            isCheckmark
            timestamp="15:01:00"
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ── Act VI — The Sanctuary ─────────────────────────────────────────────────────

function TheSanctuaryScene() {
  const frame = useCurrentFrame();
  const fadeOut = ci(frame, [188, 200], [1, 0]);
  // Warm tonal shift: charcoal gradually warms
  const warmOverlayOpacity = ci(frame, [0, 200], [0, 0.15]);
  // Breathing scale effect
  const breathScale = 1 + 0.012 * Math.sin((frame / 40) * Math.PI * 2);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: CHARCOAL,
        opacity: ci(frame, [0, 10], [0, 1]) * fadeOut,
      }}
    >
      {/* Warm sanctuary overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at center, ${WARM_SANCTUARY} 0%, transparent 65%)`,
          opacity: warmOverlayOpacity,
          pointerEvents: 'none',
        }}
      />

      <ActLabel text="THE SANCTUARY" startFrame={6} colour={WARM_SANCTUARY} />

      {/* Kinetic text — calm, breathing */}
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        <div
          style={{
            transform: `scale(${breathScale})`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}
        >
          {/* Line 1 */}
          <div
            style={{
              opacity: ci(frame, [18, 32], [0, 1]),
              transform: `translateY(${interpolate(ci(frame, [18, 32], [0, 1]), [0, 1], [20, 0])}px)`,
              fontFamily: FONT_SANS,
              fontSize: 52,
              fontWeight: 300,
              color: OFF_WHITE,
              textAlign: 'center',
              letterSpacing: '1px',
              maxWidth: 900,
              lineHeight: 1.2,
            }}
          >
            TRUE RESTORATION
          </div>
          {/* Line 2 */}
          <div
            style={{
              opacity: ci(frame, [45, 59], [0, 1]),
              transform: `translateY(${interpolate(ci(frame, [45, 59], [0, 1]), [0, 1], [20, 0])}px)`,
              fontFamily: FONT_SANS,
              fontSize: 38,
              fontWeight: 800,
              color: WARM_SANCTUARY,
              textAlign: 'center',
              letterSpacing: '-0.5px',
              maxWidth: 900,
              lineHeight: 1.2,
            }}
          >
            ISN'T A CONSTRUCTION SITE.
          </div>
          {/* Line 3 */}
          <div
            style={{
              opacity: ci(frame, [90, 104], [0, 1]),
              transform: `translateY(${interpolate(ci(frame, [90, 104], [0, 1]), [0, 1], [16, 0])}px)`,
              fontFamily: FONT_SANS,
              fontSize: 24,
              fontWeight: 300,
              color: MUTED_GREY,
              textAlign: 'center',
              letterSpacing: '3px',
              textTransform: 'uppercase' as const,
              maxWidth: 700,
              lineHeight: 1.5,
            }}
          >
            IT IS THE UNCOMPROMISING PROTECTION
            <br />
            OF THE INDOOR ENVIRONMENT.
          </div>
        </div>

        {/* Warm separator line */}
        <div
          style={{
            opacity: ci(frame, [120, 134], [0, 1]),
            width: 280,
            height: 1,
            background: `linear-gradient(to right, transparent, ${WARM_SANCTUARY}, transparent)`,
            marginTop: 8,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ── Main composition ───────────────────────────────────────────────────────────

export interface InvisibleLineAnthemProps {
  // All props optional — renders standalone with no props
  title?: string;
}

export function InvisibleLineAnthem(_props: InvisibleLineAnthemProps = {}) {
  return (
    <AbsoluteFill style={{ backgroundColor: CHARCOAL }}>
      {/* ── Act I — The Invisible Threat (0–270) ─────────────────────────── */}
      <Sequence from={0} durationInFrames={270}>
        <Audio src={staticFile('invisible-line/act1.mp3')} />
        <InvisibleThreatScene />
      </Sequence>

      {/* ── Act II — The Flawed System (270–765) ─────────────────────────── */}
      <Sequence from={270} durationInFrames={495}>
        <Audio src={staticFile('invisible-line/act2.mp3')} />
        <FlawedSystemScene />
      </Sequence>

      {/* ── Act III — Paradigm Shift (765–905) — HARD CUT ────────────────── */}
      <Sequence from={765} durationInFrames={140}>
        <Audio src={staticFile('invisible-line/act3.mp3')} />
        <ParadigmShiftScene />
      </Sequence>

      {/* ── Act IV — The Methods (905–1305) ──────────────────────────────── */}
      <Sequence from={905} durationInFrames={400}>
        <Audio src={staticFile('invisible-line/act4.mp3')} />
        <TheMethodsScene />
      </Sequence>

      {/* ── Act V — The Proof (1305–1620) ────────────────────────────────── */}
      <Sequence from={1305} durationInFrames={315}>
        <Audio src={staticFile('invisible-line/act5.mp3')} />
        <TheProofScene />
      </Sequence>

      {/* ── Act VI — The Sanctuary (1620–1820) ───────────────────────────── */}
      <Sequence from={1620} durationInFrames={200}>
        <Audio src={staticFile('invisible-line/act6.mp3')} />
        <TheSanctuaryScene />
      </Sequence>

      {/* ── Outro (1820–2030) ────────────────────────────────────────────── */}
      <Sequence from={1820} durationInFrames={210}>
        <InvisibleLineOutro voiceoverSrc="invisible-line/outro-vo.mp3" />
      </Sequence>
    </AbsoluteFill>
  );
}
