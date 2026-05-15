/**
 * Brand Content Definitions
 *
 * Video script content, SEO metadata, and brand assets for all 6 businesses.
 * Used by the render pipeline to generate BrandShowcase, BrandReel, and BrandSquare videos.
 */

import type {
  BrandShowcaseProps,
  BrandReelProps,
  BrandSquareProps,
} from './types';

// ── Brand Content Type ───────────────────────────────────────────────────────

export interface BrandContent {
  id: string;
  brandName: string;
  tagline: string;
  industry: string;
  brandColour: string;
  websiteUrl: string;
  logoUrl?: string;

  /** 3 key value propositions */
  valueProps: [string, string, string];

  /** Attention-grabbing hook for reels */
  hookText: string;

  /** Primary benefit statement */
  benefit: string;

  /** Problem statement for square format */
  problem: string;

  /** Solution statement for square format */
  solution: string;

  /** CTA text */
  ctaText: string;

  // ── SEO Metadata ─────────────────────────────────────────────────────────

  /** YouTube description (SEO-optimised, max 2000 chars) */
  youtubeDescription: string;

  /** YouTube tags (15-20 relevant keywords) */
  youtubeTags: string[];

  /** Platform hashtags */
  hashtags: string[];

  /** YouTube category ID */
  youtubeCategory: string;

  // ── Social Copy ──────────────────────────────────────────────────────────

  /** X/Twitter post text (max 280 chars) */
  twitterText: string;

  /** LinkedIn post text */
  linkedinText: string;

  /** Whether this business has active YouTube/X accounts */
  active: boolean;
}

// ── Composition Props Builders ───────────────────────────────────────────────

export function toBrandShowcaseProps(brand: BrandContent): BrandShowcaseProps {
  return {
    title: brand.brandName,
    tagline: brand.tagline,
    valueProps: brand.valueProps,
    scenes: [],
    brandColour: brand.brandColour,
    logoUrl: brand.logoUrl,
    websiteUrl: brand.websiteUrl,
    industry: brand.industry,
  };
}

export function toBrandReelProps(brand: BrandContent): BrandReelProps {
  return {
    title: brand.brandName,
    hookText: brand.hookText,
    benefit: brand.benefit,
    scenes: [],
    brandColour: brand.brandColour,
    logoUrl: brand.logoUrl,
    ctaText: brand.ctaText,
  };
}

export function toBrandSquareProps(brand: BrandContent): BrandSquareProps {
  return {
    title: brand.brandName,
    problem: brand.problem,
    solution: brand.solution,
    scenes: [],
    brandColour: brand.brandColour,
    logoUrl: brand.logoUrl,
    ctaText: brand.ctaText,
  };
}

// ── Brand Definitions ────────────────────────────────────────────────────────

export const BRAND_CONTENT: BrandContent[] = [
  // ── 1. Disaster Recovery ─────────────────────────────────────────────────
  {
    id: 'disaster-recovery',
    brandName: 'Disaster Recovery',
    tagline: '24/7 Emergency Restoration. When Disaster Strikes, We Respond.',
    industry: 'Emergency Restoration Services',
    brandColour: '#DC2626', // red-600
    websiteUrl: 'disasterrecovery.com.au',
    valueProps: [
      'Rapid 24/7 Emergency Response',
      'Direct Insurance Liaison & Claims Support',
      'IICRC-Certified Restoration Technicians',
    ],
    hookText: 'Disaster just struck. Who do you call?',
    benefit:
      '24/7 emergency response with certified technicians on-site within hours',
    problem:
      'When flood, fire, or storm damage hits, every hour of delay costs thousands',
    solution:
      'Disaster Recovery provides immediate 24/7 response with IICRC-certified technicians and direct insurance liaison',
    logoUrl: '/brands/disaster-recovery/logo.jpg',
    ctaText: 'Call Now — 24/7 Response',
    youtubeDescription: `Disaster Recovery — Australia's trusted emergency restoration service. When flood, fire, storm, or mould damage strikes your property, our IICRC-certified technicians respond 24/7 to minimise damage and restore your home or business.

Why Choose Disaster Recovery?
- Rapid emergency response — on-site within hours, any time of day
- Direct insurance liaison — we handle your claim from start to finish
- Certified technicians — IICRC-trained professionals using industry-leading equipment
- Full-service restoration — water extraction, structural drying, fire damage cleanup, mould remediation

Our Process:
00:00 — Emergency Response
00:05 — Assessment & Documentation
00:14 — Restoration in Action
00:29 — Your Property Restored

Disaster Recovery serves residential and commercial properties across Australia. Whether it's water damage from a burst pipe, fire and smoke restoration, storm damage cleanup, or mould remediation — we're here when you need us most.

Contact us today for immediate assistance.

#DisasterRecovery #EmergencyRestoration #WaterDamage #FireRestoration #MouldRemediation #Australia #IICRC #PropertyRestoration #24HourService #InsuranceClaims`,
    youtubeTags: [
      'disaster recovery',
      'emergency restoration',
      'water damage restoration',
      'fire damage cleanup',
      'mould remediation',
      'storm damage repair',
      'IICRC certified',
      'property restoration Australia',
      'flood cleanup',
      'insurance restoration',
      '24 hour emergency service',
      'water extraction',
      'structural drying',
      'smoke damage',
      'restoration company Australia',
      'commercial restoration',
      'residential restoration',
    ],
    hashtags: [
      '#DisasterRecovery',
      '#EmergencyRestoration',
      '#WaterDamage',
      '#IICRC',
      '#Australia',
    ],
    youtubeCategory: '27', // Education
    twitterText: `When disaster strikes, every minute counts. Our IICRC-certified team responds 24/7 with rapid water, fire & storm restoration across Australia. #DisasterRecovery #EmergencyRestoration #Australia`,
    linkedinText: `When property damage strikes, the speed of response determines the outcome.

Disaster Recovery provides 24/7 emergency restoration services across Australia — from water extraction and structural drying to fire damage cleanup and mould remediation.

Our IICRC-certified technicians handle everything, including direct insurance liaison, so you can focus on what matters.

#DisasterRecovery #EmergencyRestoration #PropertyManagement #Australia #IICRC`,
    active: true,
  },

  // ── 2. CARSI ─────────────────────────────────────────────────────────────
  {
    id: 'carsi',
    brandName: 'CARSI',
    tagline: 'Advancing Restoration Science in Australia',
    industry: 'Cleaning & Restoration Science Institute',
    brandColour: '#2563EB', // blue-600
    websiteUrl: 'carsi.com.au',
    valueProps: [
      '40+ Years of Restoration Science Expertise',
      'IICRC-Aligned Standards & Certification',
      'Professional Training & Industry Development',
    ],
    hookText: 'The science behind restoration excellence',
    benefit:
      'Industry-leading training and standards that set the benchmark for restoration in Australia',
    problem:
      'The restoration industry lacks standardised training and scientific methodology',
    solution:
      'CARSI delivers 40+ years of restoration science expertise through IICRC-aligned training and professional development',
    ctaText: 'Explore Our Programs',
    youtubeDescription: `CARSI — The Cleaning & Restoration Science Institute. For over 40 years, CARSI has been at the forefront of restoration science in Australia, delivering professional training, industry standards, and scientific methodology to the cleaning and restoration sector.

What CARSI Offers:
- Professional certification programs aligned with IICRC standards (International Institute of Inspection, Cleaning and Restoration Certification)
- Science-based restoration methodology and best practices developed over 40+ years of Australian industry experience
- Industry development and advocacy at national and international levels
- Continuing education for restoration professionals — certified courses since 1985

Our Impact:
00:00 — The Science of Restoration
00:05 — 40+ Years of Excellence
00:14 — Our Training Programs
00:29 — Join the CARSI Network

CARSI sets the benchmark for restoration professionalism in Australia. Whether you're a practitioner seeking certification, a company wanting to upskill your team, or an industry professional looking for the latest in restoration science — CARSI is your partner in excellence.

Founded in Australia, CARSI has trained thousands of certified restoration professionals since 1985. Our methodology is referenced by industry bodies across the Asia-Pacific region.

Visit carsi.com.au to explore our training programs and industry resources.

#CARSI #RestorationScience #IICRC #ProfessionalTraining #CleaningIndustry #Australia #Certification #RestorationProfessionals`,
    youtubeTags: [
      'CARSI',
      'restoration science',
      'cleaning institute',
      'IICRC certification',
      'restoration training',
      'professional development',
      'cleaning industry Australia',
      'restoration standards',
      'water damage training',
      'mould remediation course',
      'restoration certification',
      'cleaning science',
      'industry training',
      'restoration professionals',
      'CARSI Australia',
      'restoration education',
    ],
    hashtags: [
      '#CARSI',
      '#RestorationScience',
      '#IICRC',
      '#ProfessionalTraining',
      '#Australia',
    ],
    youtubeCategory: '27', // Education
    twitterText: `40+ years advancing restoration science in Australia. CARSI delivers IICRC-aligned training, certification & industry standards for cleaning and restoration professionals. #CARSI #RestorationScience #IICRC`,
    linkedinText: `The restoration industry demands scientific rigour and professional excellence.

For over 40 years, CARSI (Cleaning & Restoration Science Institute) has led the way in Australia — delivering IICRC-aligned training, industry standards, and professional development programs.

Whether you're seeking certification or looking to elevate your team's capabilities, CARSI is your partner in restoration science.

#CARSI #RestorationScience #ProfessionalDevelopment #IICRC #Australia`,
    active: true,
  },

  // ── 3. NRPG ─────────────────────────────────────────────────────────────
  {
    id: 'nrpg',
    brandName: 'NRPG',
    tagline: "Australia's Restoration Professionals Network",
    industry: 'National Restoration Professional Group',
    brandColour: '#059669', // emerald-600
    websiteUrl: 'nrpg.com.au',
    valueProps: [
      'National Network of Certified Restoration Professionals',
      'Industry Standards & Best Practice Advocacy',
      'Peer Support & Professional Development',
    ],
    hookText: "Australia's restoration professionals, united",
    benefit:
      'A national network connecting certified restoration professionals for standards, support, and growth',
    problem:
      'Restoration professionals work in isolation without consistent standards or peer networks',
    solution:
      'NRPG unites restoration professionals across Australia with shared standards, peer support, and professional development',
    ctaText: 'Join the Network',
    youtubeDescription: `NRPG — National Restoration Professional Group. Australia's premier network connecting certified restoration professionals with industry standards, peer support, and professional development opportunities.

Why Join NRPG?
- Connect with certified restoration professionals across Australia
- Access industry standards and best practice guidelines
- Professional development events, workshops, and resources
- Advocacy for the restoration industry at a national level

Our Mission:
00:00 — Professionals, United
00:05 — National Standards
00:14 — Our Network
00:29 — Join NRPG Today

NRPG is building a stronger restoration industry by connecting professionals, establishing standards, and advocating for excellence. Whether you're an independent operator, a restoration company, or an industry supplier — NRPG is your national network.

Visit nrpg.com.au to learn more about membership and upcoming events.

#NRPG #RestorationProfessionals #Australia #IndustryNetwork #ProfessionalDevelopment #RestorationIndustry #Standards`,
    youtubeTags: [
      'NRPG',
      'restoration professionals',
      'professional network Australia',
      'restoration industry',
      'industry standards',
      'professional development',
      'restoration network',
      'peer support',
      'restoration advocacy',
      'cleaning and restoration',
      'national restoration group',
      'NRPG Australia',
      'restoration events',
      'industry association',
      'restoration certification',
    ],
    hashtags: [
      '#NRPG',
      '#RestorationProfessionals',
      '#IndustryNetwork',
      '#Australia',
    ],
    youtubeCategory: '27', // Education
    twitterText: `Australia's restoration professionals, united. NRPG connects certified professionals with industry standards, peer support & development opportunities. #NRPG #RestorationProfessionals #Australia`,
    linkedinText: `The strength of the restoration industry lies in its professionals.

NRPG (National Restoration Professional Group) connects certified restoration professionals across Australia — providing shared industry standards, peer support, and professional development opportunities.

Join the national network building a stronger restoration industry.

#NRPG #RestorationProfessionals #ProfessionalNetwork #IndustryStandards #Australia`,
    active: true,
  },

  // ── 4. Synthex ───────────────────────────────────────────────────────────
  {
    id: 'synthex',
    brandName: 'Synthex',
    tagline: 'AI-Powered Marketing Automation',
    industry: 'Marketing Technology',
    brandColour: '#FF6B35', // candy orange
    websiteUrl: 'synthex.social',
    valueProps: [
      'AI Content Generation Across 9 Platforms',
      'Automated Multi-Platform Publishing',
      'Analytics-Driven Campaign Optimisation',
    ],
    hookText: 'Your marketing team just got an AI upgrade',
    benefit:
      'Generate, schedule, and optimise content across 9 social platforms — all from one dashboard',
    problem:
      'Managing content across multiple social platforms is time-consuming and inconsistent',
    solution:
      'Synthex automates content generation, scheduling, and optimisation across 9 platforms with AI-powered intelligence',
    ctaText: 'Automate Your Marketing',
    youtubeDescription: `Synthex — AI-Powered Marketing Automation. Generate, schedule, and optimise content across 9 social media platforms from a single intelligent dashboard.

What Synthex Does:
- AI content generation tailored to each platform's algorithm — powered by certified AI models and proprietary scoring methodology
- Automated scheduling and cross-platform publishing across 9 social networks
- Real-time analytics and engagement optimisation with 6-dimension content scoring
- Campaign intelligence with A/B testing and Bayesian optimisation
- SEO, AEO, and GEO optimisation built-in — developed by Australian marketing technology researchers

How It Works:
00:00 — The AI Marketing Revolution
00:05 — One Dashboard, Nine Platforms
00:14 — AI Content Generation
00:29 — Analytics & Optimisation

Synthex eliminates the manual grind of social media management. Our AI generates platform-optimised content, schedules it at peak engagement times, and continuously learns from your analytics to improve results.

Built for businesses, agencies, and marketing teams who want to scale their social media presence without scaling their team. 100% Australian-owned and developed since 2024.

Visit synthex.social to see AI marketing in action — trusted by Australian businesses across multiple industries.

#Synthex #AIMarketing #MarketingAutomation #SocialMedia #ContentGeneration #Analytics #MarTech #AI`,
    youtubeTags: [
      'Synthex',
      'AI marketing',
      'marketing automation',
      'social media management',
      'content generation AI',
      'social media scheduling',
      'marketing platform',
      'AI content creation',
      'multi-platform publishing',
      'marketing analytics',
      'campaign optimisation',
      'social media tool',
      'MarTech',
      'AI social media',
      'content marketing AI',
      'automated marketing',
      'social media automation',
    ],
    hashtags: [
      '#Synthex',
      '#AIMarketing',
      '#MarketingAutomation',
      '#SocialMedia',
      '#MarTech',
    ],
    youtubeCategory: '28', // Science & Technology
    twitterText: `Your marketing team just got an AI upgrade. Synthex generates, schedules & optimises content across 9 platforms from one dashboard. #AIMarketing #MarketingAutomation #Synthex`,
    linkedinText: `Managing content across multiple social platforms shouldn't require a full team.

Synthex brings AI-powered marketing automation to your workflow — generating platform-optimised content, scheduling across 9 channels, and providing real-time analytics to drive engagement.

Built for businesses and agencies ready to scale their social presence intelligently.

#Synthex #AIMarketing #MarketingAutomation #SocialMediaManagement #MarTech`,
    active: true,
  },

  // ── 5. RestoreAssist ─────────────────────────────────────────────────────
  {
    id: 'restore-assist',
    brandName: 'RestoreAssist',
    tagline: 'AI-Powered Restoration Intelligence',
    industry: 'Restoration Technology',
    brandColour: '#1C2E47', // navy — RA Wave 1 launch codify, CLAUDE.md rule 17
    websiteUrl: 'restoreassist.com.au',
    valueProps: [
      'AI-Powered Job Estimation & Scoping',
      'Automated Documentation & Compliance',
      'Real-Time Project Intelligence',
    ],
    hookText: 'Restoration just got smarter',
    benefit:
      'AI that handles estimation, documentation, and compliance so you can focus on the restoration work',
    problem:
      'Restoration job estimation, documentation, and compliance reporting consume hours of productive time',
    solution:
      'RestoreAssist uses AI to automate job scoping, generate documentation, and ensure compliance — saving hours per job',
    ctaText: 'Try RestoreAssist',
    youtubeDescription: `RestoreAssist — AI-Powered Restoration Intelligence. Automate job estimation, documentation, and compliance reporting with AI designed specifically for the restoration industry.

Features:
- AI job estimation and scoping from site photos
- Automated moisture mapping and documentation
- Compliance report generation (IICRC standards)
- Real-time project tracking and intelligence
- Insurance documentation preparation

RestoreAssist is purpose-built for restoration professionals who want to spend less time on paperwork and more time restoring properties.

#RestoreAssist #RestorationTech #AI #Automation #IICRC #PropertyRestoration`,
    youtubeTags: [
      'RestoreAssist',
      'restoration AI',
      'job estimation',
      'restoration technology',
      'compliance automation',
      'documentation AI',
      'restoration software',
      'moisture mapping',
      'IICRC compliance',
      'restoration management',
      'AI restoration',
      'property restoration tech',
      'restoration intelligence',
    ],
    hashtags: [
      '#RestoreAssist',
      '#RestorationTech',
      '#AI',
      '#Automation',
      '#IICRC',
    ],
    youtubeCategory: '28', // Science & Technology
    twitterText: `Restoration just got smarter. RestoreAssist automates job estimation, documentation & compliance with purpose-built AI for restoration professionals. #RestoreAssist #RestorationTech #AI`,
    linkedinText: `Restoration professionals spend too many hours on estimation, documentation, and compliance paperwork.

RestoreAssist brings AI intelligence to the restoration workflow — automating job scoping, generating compliant documentation, and providing real-time project intelligence.

Purpose-built for the restoration industry. Less paperwork, more restoration.

#RestoreAssist #RestorationTechnology #AI #PropertyRestoration #IICRC`,
    active: false, // YouTube/X accounts blocked — email issue
  },

  // ── 6. Unite-Group ───────────────────────────────────────────────────────
  {
    id: 'unite-group',
    brandName: 'Unite Group',
    tagline: "Building Tomorrow's Technology Solutions",
    industry: 'Technology Holdings',
    brandColour: '#E55A2B', // candy orange dark
    websiteUrl: 'unite-group.in',
    valueProps: [
      'Innovation Portfolio Across Multiple Industries',
      '100% Australian-Owned Technology Company',
      'Cross-Industry Expertise & Integration',
    ],
    hookText: 'Innovation starts with unity',
    benefit:
      'A technology holding group driving innovation across industries — 100% Australian-owned',
    problem:
      'Australian businesses need homegrown technology solutions that understand local markets',
    solution:
      'Unite Group builds and invests in technology companies that solve real problems for Australian industries',
    ctaText: 'Discover Our Portfolio',
    youtubeDescription: `Unite Group — Building Tomorrow's Technology Solutions. An Australian-owned technology holding group driving innovation across multiple industries.

Our Portfolio:
- Synthex — AI-powered marketing automation
- RestoreAssist — AI restoration intelligence
- Disaster Recovery — Emergency restoration services
- CARSI — Restoration science education
- NRPG — Professional restoration network

Why Unite Group:
00:00 — Innovation Starts With Unity
00:05 — Our Vision
00:14 — The Portfolio
00:29 — Australian-Owned, Global Ambition

Unite Group believes great technology comes from understanding real problems. We build, invest in, and scale technology companies that serve Australian industries — from AI-powered marketing to emergency restoration services.

100% Australian-owned. Cross-industry expertise. Unified technology vision.

Visit unite-group.in to learn more about our portfolio and vision.

#UniteGroup #AustralianTech #Innovation #TechHolding #AI #Australia #Technology`,
    youtubeTags: [
      'Unite Group',
      'Australian technology',
      'tech holding group',
      'innovation portfolio',
      'Australian owned',
      'technology company',
      'AI technology',
      'startup portfolio',
      'tech investment',
      'Australian innovation',
      'cross-industry tech',
      'Unite Group Australia',
      'technology solutions',
      'digital transformation',
      'Australian business',
      'tech portfolio',
    ],
    hashtags: [
      '#UniteGroup',
      '#AustralianTech',
      '#Innovation',
      '#Technology',
      '#Australia',
    ],
    youtubeCategory: '28', // Science & Technology
    twitterText: `Innovation starts with unity. Unite Group is an Australian-owned tech holding company building solutions across AI, marketing, and restoration industries. #UniteGroup #AustralianTech #Innovation`,
    linkedinText: `Great technology comes from understanding real problems.

Unite Group is a 100% Australian-owned technology holding company driving innovation across multiple industries — from AI-powered marketing automation to emergency restoration services.

Our portfolio represents a unified vision: build technology that serves Australian businesses and communities.

#UniteGroup #AustralianTech #Innovation #TechnologyHoldings #Australia`,
    active: true,
  },
];

/** Get only active brands (those with YouTube/X accounts ready) */
export function getActiveBrands(): BrandContent[] {
  return BRAND_CONTENT.filter(b => b.active);
}

/** Get a brand by ID */
export function getBrandById(id: string): BrandContent | undefined {
  return BRAND_CONTENT.find(b => b.id === id);
}
