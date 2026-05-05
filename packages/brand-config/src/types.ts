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

export interface BrandVoice {
  tone: Array<'authoritative' | 'reassuring' | 'urgent' | 'expert' | 'warm'>;
  forbiddenWords: string[];
  requiredCadence?: 'short' | 'medium' | 'long';
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
}

export const FORBIDDEN_PRONOUNS = ['we', 'our', 'i', 'us', 'my'];
