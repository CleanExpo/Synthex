import React from 'react';
import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { BRAND, SCENE_COLOURS } from '../lib/colors';
import type { ResolvedScene } from '../lib/types';
import { PersonaCard } from './PersonaCard';

interface BoardSceneProps {
  scene: ResolvedScene;
  /** Path to background music, relative to public/ */
  musicPath?: string;
}

/** Music track filename lookup */
const MUSIC_FILES: Record<string, string> = {
  opening: 'sounds/synthex-intro.mp3',
  closing: 'sounds/synthex-outro.mp3',
  deliberation: 'sounds/tense-underscore.mp3',
  decision: 'sounds/confident-build.mp3',
  action: 'sounds/momentum-drive.mp3',
  neutral: 'sounds/ambient-background.mp3',
};

export const BoardScene: React.FC<BoardSceneProps> = ({
  scene,
  musicPath,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const accentColour = SCENE_COLOURS[scene.type] ?? BRAND.accent;

  // Fade in/out
  const opacity = interpolate(
    frame,
    [0, 15, durationInFrames - 15, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Resolve music file
  const resolvedMusic =
    musicPath ?? (scene.music ? MUSIC_FILES[scene.music] : undefined);

  // Subtitle text animation — reveal word by word
  const words = scene.content.split(' ');
  const wordsPerSecond = 2.5;
  const framesPerWord = fps / wordsPerSecond;

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* Dark background */}
      <AbsoluteFill
        style={{
          backgroundColor: BRAND.bg,
        }}
      />

      {/* Ambient glow based on scene type */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accentColour}15 0%, transparent 70%)`,
          transform: 'translateX(-50%)',
        }}
      />

      {/* Scene type badge */}
      <div
        style={{
          position: 'absolute',
          top: 50,
          right: 60,
          fontSize: 13,
          fontWeight: 600,
          color: accentColour,
          letterSpacing: 3,
          textTransform: 'uppercase',
          opacity: 0.6,
        }}
      >
        {scene.type.replace(/_/g, ' ')}
      </div>

      {/* Main content area — subtitle text */}
      <div
        style={{
          position: 'absolute',
          bottom: 200,
          left: 60,
          right: 60,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          justifyContent: 'center',
        }}
      >
        {words.map((word, i) => {
          const wordFrame = i * framesPerWord;
          const wordOpacity = interpolate(
            frame,
            [wordFrame, wordFrame + 8],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );
          return (
            <span
              key={`${scene.id}-word-${i}`}
              style={{
                fontSize: 32,
                fontWeight: 500,
                color: BRAND.text,
                opacity: wordOpacity,
                lineHeight: 1.6,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>

      {/* Persona speaker card */}
      {scene.persona_entry && (
        <PersonaCard persona={scene.persona_entry} variant="speaker" />
      )}

      {/* Background music — low volume (narration audio is handled by BoardSession master) */}
      {resolvedMusic && (
        <Audio
          src={staticFile(resolvedMusic)}
          volume={0.15}
          loop
        />
      )}

      {/* SFX — play at scene start */}
      {scene.sfx?.map((sfxPath, i) => (
        <Sequence key={`sfx-${i}`} from={10}>
          <Audio src={staticFile(`sounds/${sfxPath.replace('sounds/', '')}`)} volume={0.4} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
