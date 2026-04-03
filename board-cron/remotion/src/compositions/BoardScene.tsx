import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { BRAND, PERSONA_COLOURS, SCENE_COLOURS } from '../lib/colors';
import type { PersonaEntry, ResolvedScene } from '../lib/types';

interface BoardSceneProps {
  scene: ResolvedScene;
  musicPath?: string;
}

const MUSIC_FILES: Record<string, string> = {
  opening: 'sounds/synthex-intro.mp3',
  closing: 'sounds/synthex-outro.mp3',
  deliberation: 'sounds/tense-underscore.mp3',
  decision: 'sounds/confident-build.mp3',
  action: 'sounds/momentum-drive.mp3',
  neutral: 'sounds/ambient-background.mp3',
};

export const BoardScene: React.FC<BoardSceneProps> = ({ scene, musicPath }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();

  const accent = SCENE_COLOURS[scene.type] ?? BRAND.accent;
  const personaColour = scene.persona_entry
    ? (PERSONA_COLOURS[scene.persona_entry.id] ?? accent)
    : accent;

  // Scene-level fade
  const sceneOpacity = interpolate(
    frame,
    [0, 8, durationInFrames - 8, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Background colour pulse tied to speaker colour
  const bgPulse = Math.sin(frame * 0.04) * 0.5 + 0.5; // 0–1 slow oscillation

  const resolvedMusic =
    musicPath ?? (scene.music ? MUSIC_FILES[scene.music] : undefined);

  return (
    <AbsoluteFill style={{ opacity: sceneOpacity }}>

      {/* === BASE BACKGROUND === */}
      <AbsoluteFill style={{ backgroundColor: BRAND.bg }} />

      {/* === ANIMATED GRADIENT WASH — unique per speaker colour === */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 120% 80% at 50% 40%, ${personaColour}${Math.round(8 + bgPulse * 10).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
        }}
      />

      {/* === PROGRESS LINE (top) — fills across scene duration === */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: 3,
          width: `${(frame / durationInFrames) * 100}%`,
          background: `linear-gradient(90deg, ${personaColour}, ${accent})`,
          boxShadow: `0 0 8px ${personaColour}`,
        }}
      />

      {/* === SCENE TYPE BADGE (top-left) === */}
      <SceneBadge type={scene.type} accent={accent} frame={frame} fps={fps} />

      {/* === MAIN QUOTE TEXT — kinetic, centre-stage === */}
      <KineticText
        content={scene.content}
        frame={frame}
        fps={fps}
        durationInFrames={durationInFrames}
        accentColour={personaColour}
      />

      {/* === LOWER-THIRD SPEAKER STRIP === */}
      {scene.persona_entry && (
        <LowerThird
          persona={scene.persona_entry}
          colour={personaColour}
          frame={frame}
          fps={fps}
          durationInFrames={durationInFrames}
        />
      )}

      {/* === BACKGROUND MUSIC === */}
      {resolvedMusic && (
        <Audio src={staticFile(resolvedMusic)} volume={0.1} loop />
      )}

      {/* === SFX === */}
      {scene.sfx?.map((sfxPath, i) => (
        <Sequence key={`sfx-${i}`} from={10}>
          <Audio
            src={staticFile(`sounds/${sfxPath.replace('sounds/', '')}`)}
            volume={0.35}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

// ─── SCENE BADGE ────────────────────────────────────────────────────────────

const BADGE_LABELS: Record<string, string> = {
  narration: 'NARRATION',
  deliberation: 'DELIBERATION',
  decision: 'DECISION',
  decision_body: 'DECISION',
  next_actions: 'NEXT ACTIONS',
  risk: 'RISK WATCH',
  opening: 'OPENING',
  neutral: 'BOARD SESSION',
};

const SceneBadge: React.FC<{
  type: string;
  accent: string;
  frame: number;
  fps: number;
}> = ({ type, accent, frame, fps }) => {
  const slideIn = spring({ frame, fps, config: { damping: 20, stiffness: 120 } });
  const label = BADGE_LABELS[type] ?? type.replace(/_/g, ' ').toUpperCase();

  return (
    <div
      style={{
        position: 'absolute',
        top: 40,
        left: 60,
        opacity: interpolate(slideIn, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(slideIn, [0, 1], [-20, 0])}px)`,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 16px',
          borderRadius: 4,
          backgroundColor: `${accent}20`,
          border: `1px solid ${accent}60`,
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: accent,
            boxShadow: `0 0 6px ${accent}`,
          }}
        />
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: accent,
            letterSpacing: 3,
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
};

// ─── KINETIC TEXT ────────────────────────────────────────────────────────────

const KineticText: React.FC<{
  content: string;
  frame: number;
  fps: number;
  durationInFrames: number;
  accentColour: string;
}> = ({ content, frame, fps, durationInFrames, accentColour }) => {
  const words = content.split(' ');
  // Spread words across 70% of the scene duration so last word lands well before cutoff
  const revealWindow = durationInFrames * 0.7;
  const framesPerWord = Math.max(4, revealWindow / words.length);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 160, // leave room for lower-third
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 120px 0',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px 14px',
          justifyContent: 'center',
          alignContent: 'center',
        }}
      >
        {words.map((word, i) => {
          const startFrame = i * framesPerWord;
          const wordSpring = spring({
            frame: Math.max(0, frame - startFrame),
            fps,
            config: { damping: 14, stiffness: 180, mass: 0.6 },
          });
          const wordOpacity = interpolate(wordSpring, [0, 1], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const wordScale = interpolate(wordSpring, [0, 1], [0.75, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const wordY = interpolate(wordSpring, [0, 1], [18, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

          // Accent the first word of a sentence for visual rhythm
          const isFirstWord = i === 0;

          return (
            <span
              key={`${i}-${word}`}
              style={{
                fontSize: isFirstWord ? 46 : 42,
                fontWeight: isFirstWord ? 800 : 500,
                color: isFirstWord ? accentColour : BRAND.text,
                lineHeight: 1.45,
                opacity: wordOpacity,
                transform: `scale(${wordScale}) translateY(${wordY}px)`,
                display: 'inline-block',
                textShadow: isFirstWord ? `0 0 30px ${accentColour}60` : 'none',
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ─── LOWER-THIRD SPEAKER STRIP ───────────────────────────────────────────────

const LowerThird: React.FC<{
  persona: PersonaEntry;
  colour: string;
  frame: number;
  fps: number;
  durationInFrames: number;
}> = ({ persona, colour, frame, fps, durationInFrames }) => {
  const SLIDE_FRAMES = 20;
  const slideIn = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 140 },
  });
  const slideOut = spring({
    frame: Math.max(0, durationInFrames - frame - SLIDE_FRAMES),
    fps,
    config: { damping: 22, stiffness: 140 },
  });

  const translateY = interpolate(
    Math.min(slideIn, 1 - slideOut),
    [0, 1],
    [80, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const opacity = interpolate(
    Math.min(slideIn, 1 - slideOut),
    [0, 1],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Waveform bars — simulate "speaking" activity
  const barCount = 12;
  const bars = Array.from({ length: barCount }, (_, i) => {
    const phase = (i / barCount) * Math.PI * 2;
    const height = 8 + Math.sin(frame * 0.25 + phase) * 7 + Math.sin(frame * 0.1 + phase * 1.7) * 5;
    return Math.max(4, height);
  });

  const speakerName = persona.voice_name !== 'TBD' ? persona.voice_name : persona.id;
  const speakerRole = persona.title;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 140,
        transform: `translateY(${translateY}px)`,
        opacity,
      }}
    >
      {/* Gradient fade from transparent to dark */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(to bottom, transparent 0%, rgba(10,10,15,0.95) 40%, rgba(10,10,15,1) 100%)`,
        }}
      />

      {/* Coloured accent line at top of lower-third */}
      <div
        style={{
          position: 'absolute',
          top: 30,
          left: 60,
          right: 60,
          height: 1,
          background: `linear-gradient(90deg, ${colour}, ${colour}00)`,
        }}
      />

      {/* Content row */}
      <div
        style={{
          position: 'absolute',
          bottom: 32,
          left: 60,
          right: 60,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
        }}
      >
        {/* Avatar */}
        <SpeakerAvatar persona={persona} colour={colour} />

        {/* Name + role */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: BRAND.text,
              lineHeight: 1.2,
            }}
          >
            {speakerName}
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: colour,
              letterSpacing: 2,
              textTransform: 'uppercase',
              marginTop: 3,
            }}
          >
            {speakerRole}
          </div>
        </div>

        {/* Waveform — animated speaking indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            marginRight: 12,
          }}
        >
          {bars.map((h, i) => (
            <div
              key={i}
              style={{
                width: 3,
                height: h,
                borderRadius: 2,
                backgroundColor: colour,
                opacity: 0.7,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── SPEAKER AVATAR ──────────────────────────────────────────────────────────

const SpeakerAvatar: React.FC<{
  persona: PersonaEntry;
  colour: string;
}> = ({ persona, colour }) => {
  const size = 56;
  const initial = persona.id.charAt(0).toUpperCase();
  const imagePath = `personas/${persona.filename}`;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: `${colour}20`,
        border: `2px solid ${colour}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
        boxShadow: `0 0 12px ${colour}50`,
      }}
    >
      <Img
        src={staticFile(imagePath)}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  );
};
