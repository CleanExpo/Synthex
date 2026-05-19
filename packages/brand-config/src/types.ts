export type BrandSlug =
  | 'dr'           // Disaster Recovery
  | 'nrpg'         // National Restoration Practitioners Group
  | 'ra'           // RestoreAssist
  | 'carsi'        // CARSI
  | 'synthex'      // Synthex
  | 'unite'        // Unite Group
  | 'john-coutis'; // John Coutis OAM — NRPG/industry-association spokesman

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
  | 'human'
  // john-coutis brand (2026-05-11) — registers unique to a single-person
  // spokesman whose authority is lived experience, not credentials.
  // 'humorous' = uses humour as the lead instrument, not garnish.
  // 'vulnerable' = leads with what is hard, then the lesson — never reversed.
  | 'humorous'
  | 'vulnerable';

export interface BrandVoice {
  // readonly arrays per [[board-deliberation-code-patterns-2026-05-15]] PR3 —
  // enables `as const satisfies BrandConfig` literal-narrowing on brand
  // files without breaking the type contract. Grep-verified no downstream
  // mutators (.push/.pop/.sort/.splice/.reverse) across the repo as of
  // 2026-05-15. All consumers use read-only operations (.map, .length,
  // .join, .includes, for...of, spread).
  tone: readonly BrandTone[];
  forbiddenWords: readonly string[];
  requiredCadence?: 'short' | 'medium' | 'long';
}

/// HER-1a / SYN-909 — Unite-Group portfolio-level pillars.
/// Optional. Populated for RestoreAssist at H-1; remaining brands fill in
/// progressively as their pilots come online.
export interface BrandPillars {
  values: readonly string[]; // e.g. ['Honest', 'Reliable', 'Informed']
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
  doNot: readonly string[];
  audience: { primary: string; secondary?: string };
  defaultChannel: 'linkedin' | 'youtube' | 'instagram' | 'training';
  pillars?: BrandPillars;
}

export const FORBIDDEN_PRONOUNS = ['we', 'our', 'i', 'us', 'my'];

// --- Pilot V1 ADR 002: TenantConfig envelope + PilotConfig ---

export interface PilotConfig {
  semantic_dedup_enabled: boolean;
}

export interface BrandConfigWithPilot extends BrandConfig {
  pilotConfig: PilotConfig;
}

export interface TenantConfig<TBrand extends BrandConfig = BrandConfig> {
  tenant_slug: string;
  billing_tier: 'pro' | 'enterprise';
  brands: Record<string, TBrand>;
}

export function assertSingleTenantBrand(t: TenantConfig): void {
  const keys = Object.keys(t.brands);
  if (keys.length !== 1) {
    throw new Error(`v1 enforces 1 brand per tenant; got ${keys.length}`);
  }
  if (keys[0] !== t.tenant_slug) {
    throw new Error(
      `v1 enforces tenant_slug === brand_slug; got "${keys[0]}" !== "${t.tenant_slug}"`,
    );
  }
}
