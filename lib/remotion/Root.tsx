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
import { BrandShowcase } from './compositions/BrandShowcase';
import { BrandReel } from './compositions/BrandReel';
import { BrandSquare } from './compositions/BrandSquare';
import { HowToVideo } from './compositions/HowToVideo';
import { GitCommitTimeline } from './compositions/GitCommitTimeline';
import { BoardDecisionCard } from './compositions/BoardDecisionCard';
import { SynthexLandingVideo } from './compositions/SynthexLandingVideo';
import { COMPOSITION_REGISTRY } from './registry';

export { COMPOSITION_REGISTRY };

const COMPONENT_MAP: Record<string, React.ComponentType<any>> = {
  SocialReel,
  ExplainerVideo,
  BrandShowcase,
  BrandReel,
  BrandSquare,
  HowToVideo,
  // BTS series compositions (SYN-572)
  GitCommitTimeline,
  BoardDecisionCard,
  SynthexLandingVideo,
};

// ── Root Component ───────────────────────────────────────────────────────────

export function RemotionRoot() {
  return (
    <>
      {COMPOSITION_REGISTRY.map(comp => {
        const Component = COMPONENT_MAP[comp.id];
        if (!Component) return null;
        return (
          <Composition
            key={comp.id}
            id={comp.id}
            component={Component}
            durationInFrames={comp.durationInFrames}
            fps={comp.fps}
            width={comp.width}
            height={comp.height}
            defaultProps={
              comp.defaultProps as unknown as Record<string, unknown>
            }
          />
        );
      })}
    </>
  );
}
