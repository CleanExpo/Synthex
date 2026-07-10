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
import { BRAND } from '../lib/colors';
import { buildCaptionCues, captionAtFrame, type SrtCue } from '../lib/srt';
import type { ResolvedScene } from '../lib/types';
import { BoardScene } from './BoardScene';
import { DecisionCard } from './DecisionCard';
import { EndScreen } from './EndScreen';

interface BoardSessionShortProps {
  scenes: ResolvedScene[];
  sessionNumber: number;
  title: string;
  audioBasePath?: string;
}

/** Smooth 0.5s in/out volume fade to avoid jarring speaker cuts. */
const FadedAudio: React.FC<{ src: string; sceneDurationFrames: number }> = ({
  src,
  sceneDurationFrames,
}) => {
  const frame = useCurrentFrame();
  const FADE = 15;
  const volume = interpolate(
    frame,
    [0, FADE, sceneDurationFrames - FADE, sceneDurationFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  return <Audio src={src} volume={volume} />;
};

/**
 * BoardSessionShort — the 9:16 (1080×1920) vertical cut for Reels / Shorts.
 *
 * SYN-500 Phase 4a. Re-uses the long-form scene components (the same
 * BoardScene / DecisionCard / EndScreen) — they read useVideoConfig() and so
 * fill the portrait frame — and overlays a burned-in caption band driven by
 * the deterministic SRT cues. Scene selection + re-timing happen upstream in
 * resolve-short-scenes.ts.
 */
export const BoardSessionShort: React.FC<BoardSessionShortProps> = ({
  scenes,
  sessionNumber,
  title,
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

  const cues = buildCaptionCues(scenes);

  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.bg }}>
      {scenes.map(scene => {
        const narratedIndex = narratedIndices.get(scene.id);
        const audioPath = resolveAudioPath(scene, narratedIndex, audioBasePath);

        return (
          <Sequence
            key={scene.id}
            from={scene.startFrame}
            durationInFrames={scene.durationFrames}
            name={`${scene.id} (${scene.type})`}
          >
            {audioPath && (
              <FadedAudio
                src={staticFile(audioPath)}
                sceneDurationFrames={scene.durationFrames}
              />
            )}

            {scene.type === 'decision' ? (
              <DecisionCard content={scene.content} />
            ) : scene.type === 'closing' ? (
              <EndScreen sessionNumber={sessionNumber} title={title} />
            ) : (
              <BoardScene scene={scene} />
            )}
          </Sequence>
        );
      })}

      {/* Burned-in caption band — always on for sound-off mobile viewing. */}
      <CaptionBand cues={cues} />
    </AbsoluteFill>
  );
};

/**
 * Bottom-third caption band. Portrait Reels are watched muted, so captions are
 * a first-class layer rather than an ffmpeg afterthought.
 */
const CaptionBand: React.FC<{ cues: SrtCue[] }> = ({ cues }) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const text = captionAtFrame(cues, frame);
  if (!text) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: 48,
        right: 48,
        bottom: Math.round(height * 0.16),
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          fontSize: 54,
          fontWeight: 800,
          lineHeight: 1.25,
          textAlign: 'center',
          color: BRAND.text,
          backgroundColor: 'rgba(10,10,15,0.72)',
          padding: '12px 22px',
          borderRadius: 14,
          textShadow: '0 2px 12px rgba(0,0,0,0.9)',
          boxDecorationBreak: 'clone',
          WebkitBoxDecorationBreak: 'clone',
        }}
      >
        {text}
      </span>
    </div>
  );
};

function resolveAudioPath(
  scene: ResolvedScene,
  narratedIndex: number | undefined,
  basePath?: string
): string | undefined {
  if (!scene.narrated || narratedIndex === undefined || !basePath)
    return undefined;
  const prefix = narratedIndex.toString().padStart(2, '0');
  const persona = scene.persona ?? 'narrator';
  return `${basePath}/${prefix}-${persona}-${scene.id}.mp3`;
}
