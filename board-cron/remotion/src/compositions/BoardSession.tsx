import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
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
  /** Base path for session audio files (e.g. 'session-23/audio') */
  audioBasePath?: string;
}

/**
 * Master composition — orchestrates all scenes into a single video.
 *
 * Scene routing:
 * - title_card    → TitleSlate
 * - decision      → DecisionCard (dramatic reveal)
 * - closing       → EndScreen
 * - everything else → BoardScene (narration with persona card)
 */
export const BoardSession: React.FC<BoardSessionProps> = ({
  scenes,
  sessionNumber,
  title,
  topic,
  audioBasePath,
}) => {
  // Pre-compute narrated scene indices (audio files are numbered 00, 01, ... for narrated scenes only)
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
            {/* Audio layer — plays for any narrated scene regardless of visual */}
            {audioPath && (
              <Audio src={staticFile(audioPath)} volume={1} />
            )}

            {/* Visual layer — routed by scene type */}
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

/**
 * Resolve audio file path for a scene.
 * Audio files follow naming: {narratedIndex:02d}-{persona}-{scene_id}.mp3
 * Only narrated scenes have audio — index is among narrated scenes only.
 */
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
