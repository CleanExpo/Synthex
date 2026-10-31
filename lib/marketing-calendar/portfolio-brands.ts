/**
 * Unite Group portfolio brand profiles for Synthex (founder, 31/10/2026).
 *
 * Sources (read 31/10/2026; re-check before changing a value):
 *   - Approved logos: ~/.claude/CLAUDE.md "Brand logos" (NRPG "The Reveal",
 *     Trade Hall "The Floor"); outlined SVGs copied to public/brand-logos/.
 *   - Business Card: unite-group.in/cards (live), 2nd Brain
 *     living-business-cards-offer-2026-10-23.md, Harbourside film README.
 *   - Unite-Group: Unite-Group apps/web/DESIGN.md, nexus-human-voice-2026-05-11.md.
 *   - CARSI: CARSI CLAUDE.md (IICRC CEC wording rules), src/lib/design-tokens.ts.
 *   - Disaster Recovery / NRPG: Disaster-Recovery .claude/rules/compliance.md,
 *     public/manifest.json, UBIQUITOUS_LANGUAGE.md; NRPG live at nrpg.business.
 *   - RestoreAssist: RestoreAssist .claude/DESIGN.md. Held: not released.
 *   - Trade Hall: TradeHall PRODUCT.md, marketing-packages.md. Held: preview only.
 *
 * Themes are briefs for the short-form engine, not finished copy. They name
 * only what each live site already shows.
 */

import type { PortfolioBrandSchedule } from './portfolio-plan';

export const PORTFOLIO_PARENT_SLUG = 'unite-group';

/** Four Mondays from 02/11/2026 (Sydney). */
export const PORTFOLIO_WEEK_STARTS = [
  '2026-11-02',
  '2026-11-09',
  '2026-11-16',
  '2026-11-23',
];

export interface PortfolioBrandProfile extends PortfolioBrandSchedule {
  name: string;
  description: string;
  website: string;
  industry: string;
  vertical: string;
  /** Null when no approved logo is hosted yet. */
  logoUrl: string | null;
  logoNote: string;
  colours: {
    primary: string;
    secondary: string | null;
    neutral: string | null;
  };
  voice: {
    formality: string;
    boldness: string;
    tone: string[];
    samplePhrases: string[];
  };
  audience: { description: string; painPoints: string[]; values: string[] };
  offerings: string[];
  socialProfiles: Array<{ platform: string; url: string }>;
  forbiddenWords: string[];
  preferredWords: string[];
  antiPatterns: string[];
  brandRules: string[];
  liveStatus: { live: boolean; evidence: string };
}

// Nexus voice bans that apply to every Unite Group brand.
const NEXUS_FORBIDDEN = [
  'harness',
  'unleash',
  'leverage',
  'transformative',
  'holistic',
  'synergy',
  'ecosystem',
  'journey',
  'paradigm',
  "in today's fast-paced world",
  "it's important to note",
];
const SHARED_RULES = [
  'Australian English (-ise spelling), AUD, DD/MM/YYYY.',
  'No emoji anywhere.',
  'No invented numbers or claims; advertise only what the live site shows working.',
  'One real story and one real number per post, cited.',
  'Margot (HeyGen) presents short-form video; no model-generated text or logos in frame, composite the real logo in post.',
];
const SHARED_ANTI = [
  'Parallel "not just X, but Y" triplets',
  'Rhetorical questions to the audience',
  'Generic office or sunset-gradient stock look',
  'Website slideshows built from site images',
];

/**
 * Words Unite-Group content must never carry (founder hard rule, 26/10/2026):
 * Phill's own businesses and restoration or training content.
 */
export const UNITE_GROUP_BANNED = [
  'restoration',
  'CARSI',
  'Disaster Recovery',
  'NRPG',
  'RestoreAssist',
  'IICRC',
  'CEC',
  'training',
  'course',
];

export const PORTFOLIO_BRANDS: PortfolioBrandProfile[] = [
  {
    orgSlug: 'business-card',
    label: 'Business Card',
    name: 'Unite Group Business Cards',
    description:
      'Video business cards from Unite Group: one link or QR that opens on a short film and ends on your logo.',
    website: 'https://unite-group.in/cards',
    industry: 'marketing',
    vertical: 'professional-services',
    logoUrl: 'https://unite-group.in/logos/unite-group-nexus-logo.png',
    logoNote:
      'Unite-Group cracked-U logo (made current 22/10/2026), served by unite-group.in.',
    colours: { primary: '#e55a2b', secondary: '#ff8a5c', neutral: '#0b0d10' },
    voice: {
      formality: 'casual',
      boldness: 'confident',
      tone: ['plain', 'short', 'second person', 'answer-first'],
      samplePhrases: [
        'Pick an opener.',
        'Send your details.',
        'Approve a proof.',
      ],
    },
    audience: {
      description:
        'Australian small business owners who hand out their details in person and online.',
      painPoints: [
        'Paper cards get lost',
        'Their details are spread across several links',
      ],
      values: [
        'Looking professional',
        'Quick to share',
        'One-off price, GST included',
      ],
    },
    offerings: [
      'Ready-made card (from $249, GST included)',
      'Made-for-you card ($449, GST included)',
    ],
    socialProfiles: [],
    forbiddenWords: [...NEXUS_FORBIDDEN, 'guaranteed', 'NFC'],
    preferredWords: ['video business card', 'digital business card'],
    antiPatterns: [
      ...SHARED_ANTI,
      'Implying the Harbourside sample is a real customer',
      'Showing placeholder phone numbers or domains as real',
      'Claiming save-to-contacts or NFC before it is shown working',
    ],
    brandRules: [
      ...SHARED_RULES,
      'The Harbourside film is always called a "sample card".',
      'Prices only as shown on unite-group.in/cards (GST included).',
      'Every video ends on the real card logo, composited in post.',
    ],
    liveStatus: {
      live: true,
      evidence:
        'https://unite-group.in/cards returned 200 on 31/10/2026; order links live.',
    },
    videosPerWeek: 4,
    videoPlatforms: ['instagram', 'tiktok', 'youtube'],
    channelPosts: [],
    themes: [
      'Sample card walk-through: the Harbourside sample from opener to logo',
      'How ordering works: pick an opener, send your details, approve a proof',
      'Ready-made or made for you: what each card includes',
      'One link or QR: handing your card over at a job, event or counter',
      'What happens after you order: proof, approval, delivery',
      'Your businesses in one place: linking every site from one card',
    ],
  },
  {
    orgSlug: 'carsi',
    label: 'CARSI',
    name: 'CARSI',
    description:
      'Australian online training (LMS) for cleaning, restoration and indoor-air-quality professionals maintaining their IICRC certifications.',
    website: 'https://carsi.com.au',
    industry: 'education',
    vertical: 'training',
    logoUrl: 'https://carsi.com.au/logo.png',
    logoNote:
      'Logo served by carsi.com.au. No founder-approved CARSI logo is recorded; confirm.',
    colours: { primary: '#146FC2', secondary: '#15803D', neutral: '#0F172A' },
    voice: {
      formality: 'professional',
      boldness: 'measured',
      tone: [
        'practical',
        'Australian-produced',
        'practitioner to practitioner',
      ],
      samplePhrases: [
        'Free courses you can start today.',
        'Built for Australian sites: 230V, AS/NZS, AUD.',
      ],
    },
    audience: {
      description:
        'Cleaning, restoration and indoor-air-quality professionals in Australia keeping their IICRC certification current.',
      painPoints: [
        'Finding CEC learning that fits a working week',
        'US-centric course content',
      ],
      values: [
        'Australian context',
        'Online and self-paced',
        'Clear pricing in AUD',
      ],
    },
    offerings: ['Free courses', 'Premium courses', 'Annual subscription'],
    socialProfiles: [
      { platform: 'facebook', url: 'https://www.facebook.com/CARSIaus' },
      {
        platform: 'linkedin',
        url: 'https://www.linkedin.com/company/carsiaus',
      },
      {
        platform: 'youtube',
        url: 'https://www.youtube.com/channel/UC3HpNvGJXivLGoPo4m7Qleg',
      },
    ],
    forbiddenWords: [
      ...NEXUS_FORBIDDEN,
      'IICRC accredited courses',
      'IICRC Accredited',
      'IICRC Course Accredited',
      'IICRC-accredited course',
      'IICRC courses',
      'IICRC certification course',
      'IICRC-certified course',
      'get IICRC certified with CARSI',
      'IICRC-approved',
      'certified with CARSI',
      'COACH8',
    ],
    preferredWords: [
      'IICRC CEC Accredited',
      'Continuing Education Credit (CEC) courses',
      'earns IICRC CECs',
    ],
    antiPatterns: [
      ...SHARED_ANTI,
      'Showing CEC hours for a course the IICRC has not approved',
      'Branding a course with an IICRC discipline (WRT, ASD, AMRT, FSRT, CCT, TCST)',
      'IICRC or CEC framing on a non-IICRC course',
      'CCW branding inside marketing for a CEC-approved course',
      'Unverified claims about what an IICRC standard says',
    ],
    brandRules: [
      ...SHARED_RULES,
      'Follow the IICRC CEC wording rules in the CARSI repo CLAUDE.md; "Accredited" only ever appears with "CEC".',
      'CEC hours only for courses the founder has confirmed as IICRC-approved.',
      'No CCW brand in marketing for CEC-approved courses.',
      'Run the CARSI humanizer pass before publish.',
    ],
    liveStatus: {
      live: true,
      evidence: 'https://carsi.com.au returned 200 on 31/10/2026.',
    },
    videosPerWeek: 3,
    videoPlatforms: ['youtube', 'facebook', 'linkedin'],
    channelPosts: [{ platform: 'linkedin', perWeek: 1 }],
    themes: [
      'Free CARSI courses you can start today',
      'Australian context in every lesson: 230V, AS/NZS, AUD',
      'Fitting CEC learning into a working week',
      'Inside a CARSI lesson: what the course player looks like',
      'Keeping your IICRC certification current with CECs',
      'Subscription or single course: which suits you',
    ],
  },
  {
    orgSlug: 'unite-group',
    label: 'Unite-Group Nexus',
    name: 'Unite-Group',
    description:
      'Unite-Group Nexus: Australian-owned, building video business cards and AI marketing for small businesses of any niche.',
    website: 'https://unite-group.in',
    industry: 'technology',
    vertical: 'professional-services',
    logoUrl: 'https://unite-group.in/logos/unite-group-nexus-logo.png',
    logoNote:
      'Unite-Group cracked-U logo (made current 22/10/2026), served by unite-group.in.',
    colours: { primary: '#00F5FF', secondary: '#22C55E', neutral: '#050505' },
    voice: {
      formality: 'professional',
      boldness: 'measured',
      tone: ['calm', 'precise', 'senior', 'evidence-led'],
      samplePhrases: [
        'Open on a named person in their own context, then show the evidence.',
      ],
    },
    audience: {
      description:
        'Australian small-business owners in any niche (cafe, accountant, clinic, salon, retail) who want to be found and remembered.',
      painPoints: [
        'Too many disconnected tools',
        'Marketing that sounds like everyone else',
      ],
      values: ['Evidence on screen', 'Plain answers', 'Australian-owned'],
    },
    offerings: ['Video business cards', 'AI marketing for small businesses'],
    socialProfiles: [],
    // Founder hard rule, 26/10/2026: Unite-Group content never shows or
    // mentions Phill's own businesses or restoration/training content.
    forbiddenWords: [...NEXUS_FORBIDDEN, ...UNITE_GROUP_BANNED],
    preferredWords: [],
    antiPatterns: [
      ...SHARED_ANTI,
      'Purple gradients and decorative blobs',
      'Fake integration polish',
    ],
    brandRules: [
      ...SHARED_RULES,
      'Unite-Group content never shows or mentions CARSI, Disaster Recovery, NRPG, RestoreAssist or any restoration or training content; use any-niche small businesses (cafe, accountant, clinic, salon, retail) and hold shots 3 to 5 seconds (founder, 26/10/2026).',
      'Never mention COACH8.',
    ],
    liveStatus: {
      live: true,
      evidence: 'https://unite-group.in returned 200 on 31/10/2026.',
    },
    videosPerWeek: 1,
    videoPlatforms: ['youtube', 'linkedin'],
    channelPosts: [{ platform: 'linkedin', perWeek: 1 }],
    themes: [
      'Meet Margot, the Unite Group brand ambassador',
      'A cafe owner’s video business card, start to finish',
      'From brief to film: how a video business card is made',
      'One week inside Nexus: what got built',
    ],
  },
  {
    orgSlug: 'disaster-recovery',
    label: 'Disaster Recovery',
    name: 'Disaster Recovery',
    description:
      'National network connecting Australian property owners with vetted restoration contractors, 24/7. Not a direct service provider.',
    website: 'https://disasterrecovery.com.au',
    industry: 'restoration',
    vertical: 'home-services',
    logoUrl: 'https://disasterrecovery.com.au/logos/disaster-recovery-logo.png',
    logoNote:
      'Logo served by disasterrecovery.com.au. No founder-approved DR logo is recorded; confirm.',
    colours: { primary: '#0052CC', secondary: '#0D9488', neutral: '#0F172A' },
    voice: {
      formality: 'professional',
      boldness: 'calm',
      tone: [
        'plain language',
        'short sentences',
        'one decision at a time',
        'reassuring',
      ],
      samplePhrases: [
        'Here is what to do in the first hour.',
        'Lodge it online and a contractor is matched.',
      ],
    },
    audience: {
      description:
        'Australian property owners dealing with water, fire, mould or storm damage.',
      painPoints: [
        'Not knowing what to do first',
        'Finding a qualified contractor fast',
      ],
      values: ['Clear next steps', 'Vetted contractors', '24/7 response'],
    },
    offerings: [
      'Online claim lodgement',
      'Contractor matching for water, fire, mould and storm damage',
    ],
    socialProfiles: [
      {
        platform: 'linkedin',
        url: 'https://linkedin.com/company/disaster-recovery-au',
      },
      { platform: 'facebook', url: 'https://facebook.com/DisasterRecoveryAU' },
      {
        platform: 'instagram',
        url: 'https://instagram.com/disasterrecoveryau',
      },
      { platform: 'youtube', url: 'https://youtube.com/@DisasterRecoveryAU' },
    ],
    forbiddenWords: [
      ...NEXUS_FORBIDDEN,
      'Insurance approved',
      'Bill your insurer',
      'Guaranteed approval',
      'Every insurer',
      'Fastest response',
      'Lowest prices',
      'All insurers accept our quotes',
      'Fully accredited by',
      '100% insurance coverage',
      'Same-day guarantee',
      'Free inspection',
      'Partner contractor',
    ],
    preferredWords: ['Contractor'],
    antiPatterns: [
      ...SHARED_ANTI,
      'Hard-coded star ratings',
      'Unsourced prices',
      'Urgency or fear copy',
    ],
    brandRules: [
      ...SHARED_RULES,
      'Say "Contractor" in public copy; never imply DR does the work itself.',
      'Follow Disaster-Recovery .claude/rules/compliance.md banned phrases.',
    ],
    liveStatus: {
      live: true,
      evidence: 'https://disasterrecovery.com.au returned 200 on 31/10/2026.',
    },
    videosPerWeek: 1,
    videoPlatforms: ['youtube', 'instagram', 'facebook'],
    channelPosts: [{ platform: 'linkedin', perWeek: 1 }],
    themes: [
      'What to do in the first hour after water damage',
      'How a claim is lodged online with Disaster Recovery',
      'Storm season: getting your property ready',
      'Mould after a leak: when to call a contractor',
    ],
  },
  {
    orgSlug: 'nrpg',
    label: 'NRPG',
    name: 'NRPG (National Restoration Professionals Group)',
    description:
      'National Restoration Professionals Group: the contractor network behind Disaster Recovery.',
    website: 'https://nrpg.business',
    industry: 'restoration',
    vertical: 'professional-services',
    logoUrl: 'https://synthex.social/brand-logos/nrpg-reveal-lockup-light.svg',
    logoNote:
      'Approved "The Reveal" lockup (Phill, 25/10/2026). Retired: blue/navy shield, gold "NRP Restoration" badge.',
    colours: { primary: '#1F5BFF', secondary: '#0F2742', neutral: '#0F172A' },
    voice: {
      formality: 'professional',
      boldness: 'direct',
      tone: ['contractor to contractor', 'plain', 'practical'],
      samplePhrases: ['Apply online. No phone tag.'],
    },
    audience: {
      description:
        'Australian restoration contractors and business owners looking for jobs and a professional network.',
      painPoints: ['Inconsistent job flow', 'Chasing leads by phone'],
      values: [
        'Steady, vetted work',
        'Training pathway through CARSI',
        'Online process',
      ],
    },
    offerings: [
      'Contractor network membership',
      'Jobs from the Disaster Recovery platform',
    ],
    socialProfiles: [],
    forbiddenWords: [
      ...NEXUS_FORBIDDEN,
      'Partner contractor',
      'guaranteed leads',
      'guaranteed income',
    ],
    preferredWords: ['Contractor', 'Member (membership agreement only)'],
    antiPatterns: [
      ...SHARED_ANTI,
      'Phone call-to-actions for NRPG enquiries',
      'Earnings claims',
    ],
    brandRules: [
      ...SHARED_RULES,
      'Approved logo only: "The Reveal". Never the shield or the gold badge.',
      'Enquiry calls-to-action go to online forms, not phone.',
    ],
    liveStatus: {
      live: true,
      evidence:
        'https://nrpg.business returned 200 on 31/10/2026; nrpg.com.au does not resolve.',
    },
    videosPerWeek: 1,
    videoPlatforms: ['youtube', 'linkedin'],
    channelPosts: [{ platform: 'linkedin', perWeek: 1 }],
    themes: [
      'Joining the NRPG contractor network: how the online application works',
      'How jobs reach NRPG contractors through Disaster Recovery',
      'CARSI training as part of the NRPG onboarding pathway',
      'Online enquiries, no phone tag',
    ],
  },
  {
    orgSlug: 'restoreassist',
    label: 'RestoreAssist',
    name: 'RestoreAssist',
    description:
      'Job system for Australian and New Zealand restoration contractors: one job carries site capture, evidence, sketch, report, scope and invoice.',
    website: 'https://restoreassist.app',
    industry: 'software',
    vertical: 'saas',
    logoUrl: 'https://restoreassist.app/logo.png',
    logoNote:
      'Logo served by restoreassist.app. No founder-approved RestoreAssist logo is recorded; confirm.',
    colours: { primary: '#1c2e47', secondary: '#8a6b4e', neutral: '#5a6a7b' },
    voice: {
      formality: 'professional',
      boldness: 'grounded',
      tone: ['direct', 'grounded', 'informed', 'human'],
      samplePhrases: ['Office and Field. One System.'],
    },
    audience: {
      description:
        'Restoration company owners and field technicians in Australia and New Zealand; insurer claims teams second.',
      painPoints: [
        'Evidence and reports spread across apps',
        'Rework between site and office',
      ],
      values: ['One job record', 'Fewer gaps', 'Reports insurers accept'],
    },
    offerings: ['Restoration job management software'],
    socialProfiles: [],
    forbiddenWords: [
      ...NEXUS_FORBIDDEN,
      'game-changer',
      'seamless',
      'robust',
      'cutting-edge',
      'delve into',
      'empower',
      'unlock',
      'best-in-class',
      'utilise',
      'world-class',
      'revolutionary',
      'powerful',
      'excited',
      'thrilled',
      'delighted',
    ],
    preferredWords: [],
    antiPatterns: [
      ...SHARED_ANTI,
      'Abbreviating to "RA" in voiceover or titles',
      'Urgency copy',
      'Passive voice',
      'Brand before the reader’s problem',
    ],
    brandRules: [
      ...SHARED_RULES,
      'Reading grade target 4, hard fail 8.',
      'No public content until the founder confirms launch.',
    ],
    liveStatus: {
      live: false,
      evidence:
        'Not released yet (founder brief 31/10/2026); site is up but public content is held.',
    },
    publicContentHeldReason: 'not released yet',
    videosPerWeek: 0,
    videoPlatforms: [],
    channelPosts: [],
    themes: [
      'One job record from site to invoice',
      'Evidence captured once, used in the report and the scope',
    ],
  },
  {
    orgSlug: 'trade-hall',
    label: 'Trade Hall',
    name: 'Trade Hall',
    description:
      'A 3D trade expo you can walk from any device: visit supplier booths and watch product videos.',
    website: 'https://cleanexpo247-hall.vercel.app/trade-hall',
    industry: 'events',
    vertical: 'professional-services',
    logoUrl:
      'https://synthex.social/brand-logos/trade-hall-floor-lockup-light.svg',
    logoNote:
      'Approved "The Floor" lockup (Phill, 25/10/2026). Retired: three-arches logo.',
    colours: { primary: '#0F2742', secondary: '#F26B1D', neutral: '#0F172A' },
    voice: {
      formality: 'professional',
      boldness: 'measured',
      tone: ['concrete', 'honest about what is ready', 'online journeys'],
      samplePhrases: ['Walk a 3D trade expo from any device, any time.'],
    },
    audience: {
      description:
        'Suppliers and visitors in the Australian cleaning and indoor-environment trades.',
      painPoints: ['Expos are once a year and in one city'],
      values: ['Any time, any device', 'Genuine equipment discovery'],
    },
    offerings: ['Supplier booths (coming)', 'Product videos in the hall'],
    socialProfiles: [],
    forbiddenWords: [
      ...NEXUS_FORBIDDEN,
      'restoration',
      'guaranteed leads',
      'guaranteed audience',
    ],
    preferredWords: [],
    antiPatterns: [
      ...SHARED_ANTI,
      'Promoting bookings before they work',
      'Audience-size or earnings claims',
    ],
    brandRules: [
      ...SHARED_RULES,
      'Approved logo only: "The Floor". Never the three-arches logo.',
      'The hall is a preview; booking is "coming". Label unpaid exhibitors "ORIGINAL SPONSOR PREVIEW".',
    ],
    liveStatus: {
      live: false,
      evidence:
        'Preview deploy only (cleanexpo247-hall.vercel.app); PRODUCT.md says signup and persistence are not done.',
    },
    publicContentHeldReason: 'preview build, not in production',
    videosPerWeek: 0,
    videoPlatforms: [],
    channelPosts: [],
    themes: [
      'Walk the hall: a 3D trade expo from any device',
      'Watching product videos at a supplier booth',
    ],
  },
];
