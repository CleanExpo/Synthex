/**
 * Remotion Composition Types
 *
 * Shared types for all Remotion video compositions.
 * Props map to the existing VideoGeneration.scriptContent JSON structure.
 */

/** A single scene in a video composition. */
export interface SceneProps {
  text: string;
  subtitle?: string;
  backgroundColour?: string;
  imageUrl?: string;
  /** Duration in frames (at 30fps, 30 frames = 1 second). */
  duration: number;
}

/** Base props shared by all compositions. */
export interface BaseCompositionProps {
  title: string;
  scenes: SceneProps[];
  brandColour?: string;
  logoUrl?: string;
}

/** Props for the SocialReel composition. */
export interface SocialReelProps extends BaseCompositionProps {
  /** Aspect ratio — defaults to 9:16 (portrait for social). */
  aspectRatio?: '9:16' | '1:1' | '16:9';
  /** Show animated progress bar at bottom. */
  showProgress?: boolean;
}

/** Props for the ExplainerVideo composition. */
export interface ExplainerVideoProps extends BaseCompositionProps {
  /** Voiceover script displayed as captions. */
  voiceoverScript?: string;
  /** Transition style between scenes. */
  transition?: 'fade' | 'slide' | 'zoom';
}

/** Props for the BrandShowcase composition (16:9 landscape). */
export interface BrandShowcaseProps extends BaseCompositionProps {
  tagline: string;
  valueProps: string[];
  websiteUrl?: string;
  industry?: string;
  /** Transition style between scenes. */
  transition?: 'fade' | 'slide' | 'zoom';
}

/** Props for the BrandReel composition (9:16 portrait). */
export interface BrandReelProps extends BaseCompositionProps {
  hookText: string;
  benefit: string;
  ctaText?: string;
}

/** Props for the BrandSquare composition (1:1 square). */
export interface BrandSquareProps extends BaseCompositionProps {
  problem: string;
  solution: string;
  ctaText?: string;
}

/** Registry entry describing a composition. */
export interface CompositionMeta {
  id: string;
  name: string;
  description: string;
  defaultProps: BaseCompositionProps;
  /** Composition dimensions. */
  width: number;
  height: number;
  fps: number;
  /** Duration in frames. */
  durationInFrames: number;
}
