'use client';

/**
 * Remotion Root Component
 *
 * Registers all compositions with Remotion's <Composition> API.
 * This is the entry point for the Remotion Player and CLI.
 *
 * God Mode only — used by the admin Remotion Studio page.
 */

import React from 'react';
import { Composition } from 'remotion';
import { SocialReel } from './compositions/SocialReel';
import { ExplainerVideo } from './compositions/ExplainerVideo';
import type { SocialReelProps, ExplainerVideoProps, CompositionMeta } from './types';

// ── Default Props ────────────────────────────────────────────────────────────

const DEFAULT_SOCIAL_REEL_PROPS: SocialReelProps = {
  title: 'Your Brand Story',
  scenes: [
    { text: 'Engage your audience', subtitle: 'With powerful visuals', duration: 60 },
    { text: 'Tell your story', subtitle: 'In seconds', duration: 60 },
    { text: 'Drive action', subtitle: 'With every post', duration: 60 },
  ],
  brandColour: '#06B6D4',
  showProgress: true,
};

const DEFAULT_EXPLAINER_PROPS: ExplainerVideoProps = {
  title: 'How It Works',
  scenes: [
    { text: 'Step 1: Create your content', subtitle: 'AI generates platform-optimised posts', duration: 90 },
    { text: 'Step 2: Schedule & publish', subtitle: 'Automated cross-platform distribution', duration: 90 },
    { text: 'Step 3: Analyse results', subtitle: 'Real-time engagement analytics', duration: 90 },
  ],
  brandColour: '#06B6D4',
  transition: 'fade',
};

// ── Composition Registry ─────────────────────────────────────────────────────

export const COMPOSITION_REGISTRY: CompositionMeta[] = [
  {
    id: 'SocialReel',
    name: 'Social Reel',
    description: 'Portrait reel for Instagram, TikTok, and YouTube Shorts (9:16)',
    defaultProps: DEFAULT_SOCIAL_REEL_PROPS,
    width: 720,
    height: 1280,
    fps: 30,
    durationInFrames: 210, // 7 seconds
  },
  {
    id: 'ExplainerVideo',
    name: 'Explainer Video',
    description: 'Landscape explainer with scene transitions (16:9)',
    defaultProps: DEFAULT_EXPLAINER_PROPS,
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 330, // 11 seconds
  },
];

// ── Root Component ───────────────────────────────────────────────────────────

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="SocialReel"
        component={SocialReel as React.ComponentType<any>}
        durationInFrames={210}
        fps={30}
        width={720}
        height={1280}
        defaultProps={DEFAULT_SOCIAL_REEL_PROPS as unknown as Record<string, unknown>}
      />
      <Composition
        id="ExplainerVideo"
        component={ExplainerVideo as React.ComponentType<any>}
        durationInFrames={330}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={DEFAULT_EXPLAINER_PROPS as unknown as Record<string, unknown>}
      />
    </>
  );
}
