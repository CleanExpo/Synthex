'use client';

/**
 * Composition bindings for the admin Remotion Studio preview — SYN-1113.
 *
 * The Studio builds its selector from every `COMPOSITION_REGISTRY` entry but
 * renders `{Component && <Player …/>}`, so a registry entry with no binding here
 * produces an empty black panel with no error. Only `SocialReel` and
 * `ExplainerVideo` were ever bound, which left the other 23 compositions
 * selectable and silently blank.
 *
 * Extracted from the page so `__tests__/remotion/composition-contract.test.ts`
 * can assert the coverage that the runtime cannot.
 *
 * Every binding is lazy: the ~128 KB of Remotion core these pull in stays out of
 * the page's initial JS and arrives with the dynamically imported `<Player>`,
 * which is the only thing that ever renders them.
 */

import dynamic from 'next/dynamic';
import type React from 'react';

/** `ssr: false` throughout — Remotion compositions need browser APIs. */
function lazyComposition(
  loader: () => Promise<{ default: React.ComponentType<any> }>
): React.ComponentType<any> {
  return dynamic(loader, { ssr: false });
}

export const STUDIO_PREVIEW_COMPONENTS: Record<
  string,
  React.ComponentType<any>
> = {
  SocialReel: lazyComposition(() =>
    import('./compositions/SocialReel').then(m => ({ default: m.SocialReel }))
  ),
  ExplainerVideo: lazyComposition(() =>
    import('./compositions/ExplainerVideo').then(m => ({
      default: m.ExplainerVideo,
    }))
  ),
  BrandShowcase: lazyComposition(() =>
    import('./compositions/BrandShowcase').then(m => ({
      default: m.BrandShowcase,
    }))
  ),
  BrandReel: lazyComposition(() =>
    import('./compositions/BrandReel').then(m => ({ default: m.BrandReel }))
  ),
  BrandSquare: lazyComposition(() =>
    import('./compositions/BrandSquare').then(m => ({ default: m.BrandSquare }))
  ),
  HowToVideo: lazyComposition(() =>
    import('./compositions/HowToVideo').then(m => ({ default: m.HowToVideo }))
  ),
  SchematicExplainer: lazyComposition(() =>
    import('./compositions/SchematicExplainer').then(m => ({
      default: m.SchematicExplainer,
    }))
  ),

  // Educational compositions (SYN-429).
  TipCard: lazyComposition(() =>
    import('./compositions/TipCard').then(m => ({ default: m.TipCard }))
  ),
  StatReveal: lazyComposition(() =>
    import('./compositions/StatReveal').then(m => ({ default: m.StatReveal }))
  ),
  ComparisonSlide: lazyComposition(() =>
    import('./compositions/ComparisonSlide').then(m => ({
      default: m.ComparisonSlide,
    }))
  ),
  ListicleVideo: lazyComposition(() =>
    import('./compositions/ListicleVideo').then(m => ({
      default: m.ListicleVideo,
    }))
  ),
  CaseStudyVideo: lazyComposition(() =>
    import('./compositions/CaseStudyVideo').then(m => ({
      default: m.CaseStudyVideo,
    }))
  ),
  QuoteCard: lazyComposition(() =>
    import('./compositions/QuoteCard').then(m => ({ default: m.QuoteCard }))
  ),
  CountdownCTA: lazyComposition(() =>
    import('./compositions/CountdownCTA').then(m => ({
      default: m.CountdownCTA,
    }))
  ),
  DefinitionCard: lazyComposition(() =>
    import('./compositions/DefinitionCard').then(m => ({
      default: m.DefinitionCard,
    }))
  ),

  // BTS series (SYN-572).
  GitCommitTimeline: lazyComposition(() =>
    import('./compositions/GitCommitTimeline').then(m => ({
      default: m.GitCommitTimeline,
    }))
  ),
  BoardDecisionCard: lazyComposition(() =>
    import('./compositions/BoardDecisionCard').then(m => ({
      default: m.BoardDecisionCard,
    }))
  ),
  SynthexLandingVideo: lazyComposition(() =>
    import('./compositions/SynthexLandingVideo').then(m => ({
      default: m.SynthexLandingVideo,
    }))
  ),

  // One component drives all five Marketing Extender IDs, switching on `mode`.
  MarketingExtenderIntro: lazyComposition(() =>
    import('./compositions/MarketingExtenderVideo').then(m => ({
      default: m.MarketingExtenderVideo,
    }))
  ),
  MarketingExtenderContext: lazyComposition(() =>
    import('./compositions/MarketingExtenderVideo').then(m => ({
      default: m.MarketingExtenderVideo,
    }))
  ),
  MarketingExtenderExpand: lazyComposition(() =>
    import('./compositions/MarketingExtenderVideo').then(m => ({
      default: m.MarketingExtenderVideo,
    }))
  ),
  MarketingExtenderDecision: lazyComposition(() =>
    import('./compositions/MarketingExtenderVideo').then(m => ({
      default: m.MarketingExtenderVideo,
    }))
  ),
  MarketingExtenderHandoff: lazyComposition(() =>
    import('./compositions/MarketingExtenderVideo').then(m => ({
      default: m.MarketingExtenderVideo,
    }))
  ),

  // The Invisible Line campaign (SYN-971).
  InvisibleLineOutro: lazyComposition(() =>
    import('./compositions/InvisibleLineOutro').then(m => ({
      default: m.InvisibleLineOutro,
    }))
  ),
  InvisibleLineAnthem: lazyComposition(() =>
    import('./compositions/InvisibleLineAnthem').then(m => ({
      default: m.InvisibleLineAnthem,
    }))
  ),
};
