import React from 'react';
import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type { ResolvedScene } from '../lib/types';
import { BoardScene } from './BoardScene';
import { DecisionCard } from './DecisionCard';
import { EndScreen } from './EndScreen';
import { TitleSlate } from './TitleSlate';

interface BoardSessionProps {
  scenes: ResolvedScene[];
  sessionNumber: number;
  title: string;
  topic: string;
  audioBasePath?: string;
}

/** Smooth volume fade — 0.6s in, 0.6s out to avoid jarring speaker cuts */
const FadedAudio: React.FC<{ src: string; sceneDurationFrames: number }> = ({
  src,
  sceneDurationFrames,
}) => {
  const frame = useCurrentFrame();
  const FADE = 18; // 18 frames = 0.6s @ 30fps
  const volume = interpolate(
    frame,
    [0, FADE, sceneDurationFrames - FADE, sceneDurationFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  return <Audio src={src} volume={volume} />;
};

export const BoardSession: React.FC<BoardSessionProps> = ({
  scenes,
  sessionNumber,
  title,
  topic,
  audioBasePath,
}) => {
  const narratedIndices = new Map<string, number>();
  let narratedCount = 0;
  for (const s of scenes) {
    if (s.narrated) {
      narratedIndices.set(s.id, narratedCount);
      narratedCount++;
    }
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#0A0A0F' }}>
      {scenes.map((scene) => {
        const narratedIndex = narratedIndices.get(scene.id);
        const audioPath = resolveAudioPath(scene, narratedIndex, audioBasePath);

        return (
          <Sequence
            key={scene.id}
            from={scene.startFrame}
            durationInFrames={scene.durationFrames}
            name={`${scene.id} (${scene.type})`}
          >
            {/* Faded audio — smooth crossfade between speakers */}
            {audioPath && (
              <FadedAudio
                src={staticFile(audioPath)}
                sceneDurationFrames={scene.durationFrames}
              />
            )}

            {scene.type === 'title_card' ? (
              <TitleSlate
                sessionNumber={sessionNumber}
                title={title}
                topic={topic}
              />
            ) : scene.type === 'decision' ? (
              <DecisionCard content={scene.content} />
            ) : scene.type === 'closing' ? (
              <EndScreen sessionNumber={sessionNumber} title={title} />
            ) : (
              <BoardScene scene={scene} />
            )}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

function resolveAudioPath(
  scene: ResolvedScene,
  narratedIndex: number | undefined,
  basePath?: string,
): string | undefined {
  if (!scene.narrated || narratedIndex === undefined || !basePath) return undefined;
  const prefix = narratedIndex.toString().padStart(2, '0');
  const persona = scene.persona ?? 'narrator';
  return `${basePath}/${prefix}-${persona}-${scene.id}.mp3`;
}
