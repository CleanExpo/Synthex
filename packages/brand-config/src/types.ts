export type BrandSlug =
  | 'dr'        // Disaster Recovery
  | 'nrpg'      // National Restoration Practitioners Group
  | 'ra'        // RestoreAssist
  | 'carsi'     // CARSI
  | 'ccw'       // Carpet Cleaners Warehouse (customer)
  | 'synthex'   // Synthex
  | 'unite';    // Unite Group

export type ColourFamily =
  | 'restoration'
  | 'safety'
  | 'industrial'
  | 'consumer'
  | 'training';

export type SignatureMotion = 'rise' | 'sweep' | 'pulse' | 'iris' | 'whip';

export interface BrandColour {
  primary: string;
  secondary: string;
  accent: string;
  neutral: { 50: string; 100: string; 500: string; 900: string };
  semantic: { success: string; warning: string; danger: string };
  family: ColourFamily;
  darkVariant?: Partial<Omit<BrandColour, 'family' | 'darkVariant'>>;
}

export interface BrandTypography {
  display: { family: string; weight: number; src: string };
  body: { family: string; weight: number; src: string };
  mono?: { family: string; weight: number; src: string };
}

export interface BrandLogo {
  primary: string;
  inverted: string;
  icon: string;
  safeAreaPx: number;
}

export interface BrandMotion {
  durations: { fast: number; base: number; slow: number };
  easing: { in: string; out: string; inOut: string };
  signature: SignatureMotion;
  transitionFrames: number;
}

export interface BrandVoiceover {
  elevenLabsVoiceId: string;
  style: 'narration' | 'conversational' | 'urgent';
  locale: 'en-AU' | 'en-GB' | 'en-US';
}

export type BrandTone =
  | 'authoritative'
  | 'reassuring'
  | 'urgent'
  | 'expert'
  | 'warm'
  // HER-1a / SYN-909 — added for RestoreAssist disaster-recovery audience.
  // 'direct' = one idea per sentence, no wasted words.
  // 'grounded' = no hype, no pressure, no superlatives.
  // 'informed' = leads with data and fact, not opinion.
  // 'human' = written for a person in a hard situation, not a persona.
  | 'direct'
  | 'grounded'
  | 'informed'
  | 'human';

export interface BrandVoice {
  tone: BrandTone[];
  forbiddenWords: string[];
  requiredCadence?: 'short' | 'medium' | 'long';
}

/// HER-1a / SYN-909 — Unite-Group portfolio-level pillars.
/// Optional. Populated for RestoreAssist at H-1; remaining brands fill in
/// progressively as their pilots come online.
export interface BrandPillars {
  values: string[]; // e.g. ['Honest', 'Reliable', 'Informed']
  readingLevel?: {
    target: number;    // Flesch-Kincaid grade target (aim for this)
    tolerance: number; // warn above this grade
    hardFail: number;  // voice gate hard-fails above this grade
  };
}

export interface BrandConfig {
  slug: BrandSlug;
  legalName: string;
  displayName: string;
  tagline: string;
  voice: BrandVoice;
  colour: BrandColour;
  typography: BrandTypography;
  logo: BrandLogo;
  motion: BrandMotion;
  voiceover: BrandVoiceover;
  doNot: string[];
  audience: { primary: string; secondary?: string };
  defaultChannel: 'linkedin' | 'youtube' | 'instagram' | 'training';
  pillars?: BrandPillars;
}

export const FORBIDDEN_PRONOUNS = ['we', 'our', 'i', 'us', 'my'];
