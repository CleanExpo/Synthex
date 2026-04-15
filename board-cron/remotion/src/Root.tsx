import React from 'react';
import { Composition } from 'remotion';
import { BoardSession } from './compositions/BoardSession';
import { DecisionCard } from './compositions/DecisionCard';
import { EndScreen } from './compositions/EndScreen';
import { TitleSlate } from './compositions/TitleSlate';
import { FPS, resolveScenes, totalFrames } from './lib/resolve-scenes';
import type { BoardScript, PersonaManifest } from './lib/types';

// Load session-23 script and persona manifest
import script from './data/session-23-client-journey.json';
import manifest from './assets/personas/persona-manifest.json';

const boardScript = script as unknown as BoardScript;
const personaManifest = manifest as unknown as PersonaManifest;
const resolvedScenes = resolveScenes(boardScript, personaManifest);
const total = totalFrames(resolvedScenes);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Full episode — the main render target */}
      <Composition
        id="BoardSession"
        component={BoardSession as unknown as React.ComponentType<Record<string, unknown>>}
        durationInFrames={total}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{
          scenes: resolvedScenes,
          sessionNumber: boardScript._meta.session,
          title: boardScript._meta.title,
          topic: boardScript._meta.topic,
          audioBasePath: 'session-23/audio',
        }}
      />

      {/* Individual composition previews for Remotion Studio */}
      <Composition
        id="TitleSlate"
        component={TitleSlate as unknown as React.ComponentType<Record<string, unknown>>}
        durationInFrames={5 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{
          sessionNumber: 23,
          title: 'Client Journey — Making Learning Visible',
          topic: 'Client Journey Optimization',
        }}
      />

      <Composition
        id="DecisionCard"
        component={DecisionCard as unknown as React.ComponentType<Record<string, unknown>>}
        durationInFrames={4 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{
          content: 'Here is the decision.',
        }}
      />

      <Composition
        id="EndScreen"
        component={EndScreen as unknown as React.ComponentType<Record<string, unknown>>}
        durationInFrames={8 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{
          sessionNumber: 23,
          title: 'Client Journey — Making Learning Visible',
        }}
      />
    </>
  );
};
