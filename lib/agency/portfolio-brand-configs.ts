/**
 * Portfolio tenant definitions for in-house Unite brands (SYN-973).
 * CCW is documented as carve-out — not auto-seeded (Phase 3.4 boundary).
 */

export interface PortfolioBrandConfig {
  slug: string;
  name: string;
  website: string;
  industry: string;
  vertical: string;
  voiceTag: string;
  flywheel:
    | 'primary-flywheel: DR/NRPG'
    | 'secondary-flywheel: RestoreAssist'
    | 'feeder: CARSI'
    | 'feeder: CCW';
  adminEmail: string;
  brandVoice: {
    voiceTag: string;
    formality: number;
    boldness: number;
    tone: string;
    samplePhrases: string[];
    antiPatterns?: string[];
  };
}

export const UNITE_WORKSPACE_SLUG = 'unite-group';

/** CCW carve-out: marketing boundary — do not seed without explicit CEO flag */
export const CCW_CARVE_OUT_SLUG = 'ccwarehouse';

export const PORTFOLIO_BRANDS: PortfolioBrandConfig[] = [
  {
    slug: 'disaster-recovery',
    name: 'Disaster Recovery',
    website: 'https://www.disasterrecovery.com.au',
    industry: 'restoration',
    vertical: 'emergency-response',
    voiceTag: 'hybrid_phill_strategic',
    flywheel: 'primary-flywheel: DR/NRPG',
    adminEmail: 'portfolio-admin@disasterrecovery.com.au',
    brandVoice: {
      voiceTag: 'hybrid_phill_strategic',
      formality: 4,
      boldness: 3,
      tone: 'calm authority under pressure',
      samplePhrases: [
        'When disaster strikes, timing matters.',
        'Insurance-approved restoration, coordinated fast.',
      ],
      antiPatterns: ['game-changing', 'revolutionary', 'leverage'],
    },
  },
  {
    slug: 'nrpg',
    name: 'National Recovery Platform Group',
    website: 'https://www.disasterrecovery.com.au',
    industry: 'restoration',
    vertical: 'contractor-network',
    voiceTag: 'hybrid_phill_strategic',
    flywheel: 'primary-flywheel: DR/NRPG',
    adminEmail: 'portfolio-admin@nrpg.com.au',
    brandVoice: {
      voiceTag: 'hybrid_phill_strategic',
      formality: 4,
      boldness: 3,
      tone: 'peer-to-peer contractor trust',
      samplePhrases: [
        'Built for IICRC-certified contractors.',
        'Claims flow in — your crew stays busy.',
      ],
    },
  },
  {
    slug: 'restoreassist',
    name: 'RestoreAssist',
    website: 'https://restoreassist.app',
    industry: 'restoration',
    vertical: 'saas',
    voiceTag: 'hybrid_phill_strategic_brand_routine',
    flywheel: 'secondary-flywheel: RestoreAssist',
    adminEmail: 'portfolio-admin@restoreassist.app',
    brandVoice: {
      voiceTag: 'hybrid_phill_strategic_brand_routine',
      formality: 3,
      boldness: 4,
      tone: 'founder strategic + product clarity',
      samplePhrases: [
        'Australian-designed restoration CRM for the field.',
        'Inspection to scope to estimate — IICRC S500 aligned.',
      ],
      antiPatterns: ['projected earnings', 'guaranteed revenue'],
    },
  },
  {
    slug: 'carsi',
    name: 'CARSI',
    website: 'https://www.carsi.com.au',
    industry: 'education',
    vertical: 'iicrc-training',
    voiceTag: 'brand_anonymous',
    flywheel: 'feeder: CARSI',
    adminEmail: 'portfolio-admin@carsi.com.au',
    brandVoice: {
      voiceTag: 'brand_anonymous',
      formality: 4,
      boldness: 2,
      tone: 'outcomes-focused training authority',
      samplePhrases: [
        'Maintain your IICRC CEC online.',
        'Structured learning for restoration technicians.',
      ],
    },
  },
];
