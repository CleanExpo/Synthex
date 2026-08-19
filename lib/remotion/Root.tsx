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
import { SchematicExplainer } from './compositions/SchematicExplainer';
import { GitCommitTimeline } from './compositions/GitCommitTimeline';
import { BoardDecisionCard } from './compositions/BoardDecisionCard';
import { SynthexLandingVideo } from './compositions/SynthexLandingVideo';
import { MarketingExtenderVideo } from './compositions/MarketingExtenderVideo';
import { InvisibleLineOutro } from './compositions/InvisibleLineOutro';
import { InvisibleLineAnthem } from './compositions/InvisibleLineAnthem';
import { TipCard } from './compositions/TipCard';
import { StatReveal } from './compositions/StatReveal';
import { ComparisonSlide } from './compositions/ComparisonSlide';
import { ListicleVideo } from './compositions/ListicleVideo';
import { CaseStudyVideo } from './compositions/CaseStudyVideo';
import { QuoteCard } from './compositions/QuoteCard';
import { CountdownCTA } from './compositions/CountdownCTA';
import { DefinitionCard } from './compositions/DefinitionCard';
import { COMPOSITION_REGISTRY } from './registry';

export { COMPOSITION_REGISTRY };

/**
 * Exported so the contract test can prove it covers COMPOSITION_REGISTRY. An
 * unbound registry entry is invisible at runtime — see the render guard below.
 */
export const COMPOSITION_COMPONENTS: Record<
  string,
  React.ComponentType<any>
> = {
  SocialReel,
  ExplainerVideo,
  BrandShowcase,
  BrandReel,
  BrandSquare,
  HowToVideo,
  SchematicExplainer,
  // Educational compositions (SYN-429) — 80 EDUCATIONAL_VIDEOS entries name
  // these, and none could be rendered until SYN-1113 registered them.
  TipCard,
  StatReveal,
  ComparisonSlide,
  ListicleVideo,
  CaseStudyVideo,
  QuoteCard,
  CountdownCTA,
  DefinitionCard,
  // BTS series compositions (SYN-572)
  GitCommitTimeline,
  BoardDecisionCard,
  SynthexLandingVideo,
  MarketingExtenderIntro: MarketingExtenderVideo,
  MarketingExtenderContext: MarketingExtenderVideo,
  MarketingExtenderExpand: MarketingExtenderVideo,
  MarketingExtenderDecision: MarketingExtenderVideo,
  MarketingExtenderHandoff: MarketingExtenderVideo,
  // The Invisible Line campaign (SYN-971)
  InvisibleLineOutro,
  InvisibleLineAnthem,
};

// ── Root Component ───────────────────────────────────────────────────────────

export function RemotionRoot() {
  return (
    <>
      {COMPOSITION_REGISTRY.map(comp => {
        const Component = COMPOSITION_COMPONENTS[comp.id];
        if (!Component) {
          // Previously `return null`, which dropped the composition from the
          // bundle without a trace: the Studio still offered it and the render
          // script only failed later, inside selectComposition.
          throw new Error(
            `Composition "${comp.id}" is in COMPOSITION_REGISTRY but has no ` +
              `entry in COMPOSITION_COMPONENTS, so it cannot be rendered.`
          );
        }
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
