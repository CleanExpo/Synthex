#!/usr/bin/env tsx
/**
 * Seed BrandDNA rows for the Unite-Group brands.
 *
 * IDEMPOTENT: BrandDNA has @unique on organizationId, so re-running upserts.
 *
 * USAGE:
 *   npx tsx --env-file=.env scripts/seed-brand-dna.ts
 *
 * REQUIRES:
 *   - Workspace + child orgs already seeded (scripts/seed-unite-group-workspace.ts)
 *   - DATABASE_URL pointing at the Synthex Supabase
 *
 * SOURCE OF TRUTH:
 *   - .claude/memory/ceo-foundation.md Briefs 1–4 (DR/NRPG · CARSI · RA)
 *   - Q2.5.5 voice tag matrix
 *   - 2026-04-30 RA spine amendment
 *
 * RE-RUN any time the foundation amends a brand's voice / persona / offerings.
 */

import { prisma } from '../lib/prisma';

interface BrandDNASpec {
  /** Organization slug (must already exist) */
  orgSlug: string;
  businessName: string;
  vertical: string;
  industry: string;
  primaryColour?: string;
  secondaryColour?: string;
  neutralColour?: string;
  brandVoice: {
    voiceTag: string;
    formality: number; // 1-5 (1=casual, 5=formal)
    boldness: number; // 1-5 (1=hedged, 5=assertive)
    tone: string;
    samplePhrases: string[];
  };
  persona: {
    description: string;
    audienceSegments: string[];
    painPoints: string[];
    values: string[];
  };
  offerings: string[];
  socialProfiles: { platform: string; url: string; verified: boolean }[];
  sourceUrl: string;
}

// ─── 5 brand specs (from ceo-foundation.md Briefs 1–4) ────────────────────────

const BRANDS: BrandDNASpec[] = [
  {
    orgSlug: 'disaster-recovery',
    businessName: 'Disaster Recovery',
    vertical: 'restoration',
    industry: 'professional-services',
    primaryColour: '#0F172A', // Authoritative navy
    secondaryColour: '#DC2626', // Emergency red
    neutralColour: '#F8FAFC',
    brandVoice: {
      voiceTag: 'brand_anonymous',
      formality: 4,
      boldness: 4,
      tone: 'Authoritative · urgent · control-focused. Insurance-trade vocabulary (claims, documentation, pre-loss, billing).',
      samplePhrases: [
        'Rapid Response. Resilient Future.',
        'Restore Your Property. Reclaim Your Life.',
        'Under 60 Mins Average Response Time',
        'IICRC S500/S520/FSRT certified',
      ],
    },
    persona: {
      description:
        'Insurance-approved emergency restoration brand serving ANZ. Trust signal IS the brand. Two-sided platform: consumers (property owners in crisis) + contractors (NRPG network).',
      audienceSegments: [
        'Property managers (2am tenant call)',
        'Strata managers (per-lot documentation)',
        'Business owners (revenue protection)',
        'Insurance adjusters (claims gatekeepers)',
      ],
      painPoints: [
        'Water/fire/mould damage triggering insurance claim',
        'Need IICRC-certified restoration with documented chain-of-evidence',
        'Property revenue loss while restoration in progress',
        'Coordination across trades + insurers + tenants',
      ],
      values: [
        'Speed (under 60 min response)',
        'Compliance (IICRC + insurer-approved)',
        'Documentation (claims defence)',
        'Scale (national coverage via NRPG)',
      ],
    },
    offerings: [
      'Water + Flood damage restoration',
      'Fire + Smoke damage restoration',
      'Mould remediation (S520)',
      'Storm damage response',
      'Biohazard + crime scene cleanup',
      'Sewage + black water remediation',
      'Precision Laser Cleaning (differentiator)',
    ],
    socialProfiles: [
      {
        platform: 'website',
        url: 'https://disasterrecovery.com.au',
        verified: true,
      },
    ],
    sourceUrl: 'https://disasterrecovery.com.au',
  },

  {
    orgSlug: 'nrpg',
    businessName: 'NRPG (National Restoration Professionals Group)',
    vertical: 'restoration',
    industry: 'professional-services',
    primaryColour: '#1E40AF', // Network blue
    secondaryColour: '#F59E0B', // Membership amber
    neutralColour: '#F8FAFC',
    brandVoice: {
      voiceTag: 'hybrid_phill_strategic',
      formality: 3,
      boldness: 5,
      tone: 'Peer-to-peer trade voice. Founder fronts contractor recruitment + thought leadership; brand voice on operational comms.',
      samplePhrases: [
        'Apply to Join Network',
        'IICRC cert + $1M liability + 2yr+ experience required',
        'Standards-led contractor network',
        'Built by restoration owners, for restoration owners',
      ],
    },
    persona: {
      description:
        'Australian restoration contractor network — recruitment + standards uplift + work distribution from Disaster Recovery pipeline.',
      audienceSegments: [
        'IICRC-certified independent restoration contractors',
        'Small restoration firms wanting national pipeline access',
        'Restoration techs upskilling toward business ownership',
      ],
      painPoints: [
        'Inconsistent work pipeline (feast/famine)',
        'Insurer compliance burden as solo operator',
        'Standards drift in regional markets',
        'Cost of certification + insurance solo',
      ],
      values: [
        'Trade peer respect (not corporate-style management)',
        'Standards integrity (IICRC frameworks)',
        'Pipeline reliability',
        'Liability protection via group',
      ],
    },
    offerings: [
      'Contractor network membership',
      'IICRC standards alignment programme',
      'Work distribution from DR consumer pipeline',
      'Group liability insurance access',
      'Peer-to-peer technical training',
    ],
    socialProfiles: [
      { platform: 'website', url: 'https://nrpg.com.au', verified: true },
    ],
    sourceUrl: 'https://nrpg.com.au',
  },

  {
    orgSlug: 'restoreassist',
    businessName: 'RestoreAssist',
    vertical: 'saas',
    industry: 'technology',
    primaryColour: '#0EA5E9', // Tech sky blue
    secondaryColour: '#10B981', // Compliance green
    neutralColour: '#F1F5F9',
    brandVoice: {
      voiceTag: 'hybrid_phill_strategic_brand_routine',
      formality: 4,
      boldness: 4,
      tone: 'B2B SaaS register — declarative, calm, productivity-promise · compliance-anchored. Founder voice on origin/why; brand voice on product/help.',
      samplePhrases: [
        // CEO-locked spine 2026-04-30
        "Australia's first Australian-designed full CRM — Office and Field Management System designed specifically for the Australian Restoration Industry",
        'One System. Fewer Gaps. More Confidence.',
        'AI does not replace the technician. AI assists administration and field technicians',
        'Remove double-handling',
        'Inbuilt IICRC frameworks · WHS policies · Australian Building Code references',
      ],
    },
    persona: {
      description:
        'Office + Field Management System for Australian restoration industry. AI assists (never replaces) the technician. Designed AU; deployed AU+NZ.',
      audienceSegments: [
        'Restoration Companies (primary buyer)',
        'Insurance Adjusters (gatekeeper)',
        'Property Managers (multi-property B2B)',
      ],
      painPoints: [
        'Double-handling between field capture + office admin',
        'Inbound US tools missing AU compliance language',
        'Documentation gaps that lose insurance claims',
        'Spreadsheet/PDF sprawl across job lifecycle',
      ],
      values: [
        'Australian-designed (compliance scaffold native)',
        'Office + Field unified (not field-only)',
        'AI as assistant (never autonomous)',
        'Compliance defensibility (audit-ready output)',
      ],
    },
    offerings: [
      'Inspection (mobile-first field capture: photos · measurements · damage details)',
      'AI Analysis (damage patterns · compliance requirements · scope identification)',
      'Scoping (compliance auto-insertion · real-time cost calc)',
      'Estimating (regional pricing · equipment + labour rates)',
      'Reporting (PDF/Excel export to insurers + clients)',
    ],
    socialProfiles: [
      {
        platform: 'website',
        url: 'https://restoreassist.app',
        verified: true,
      },
    ],
    sourceUrl: 'https://restoreassist.app',
  },

  {
    orgSlug: 'carsi',
    businessName: 'CARSI',
    vertical: 'education',
    industry: 'education',
    primaryColour: '#7C3AED', // Education violet
    secondaryColour: '#F59E0B', // Credential gold
    neutralColour: '#FAFAFA',
    brandVoice: {
      voiceTag: 'brand_anonymous',
      formality: 3,
      boldness: 4,
      tone: 'Practical, regional-Australia-aware, quantified value claims, plain trade voice. Sage-primary on standards content.',
      samplePhrases: [
        'the most cost-effective path to IICRC certification maintenance in Australia',
        'IICRC-approved CEC provider',
        '$20 to start a single course. $795 per year for all-access.',
        'No travel. 24/7 access. Any device. Verifiable credential.',
      ],
    },
    persona: {
      description:
        'IICRC-approved CEC training platform for Australian restoration techs. Removes the travel/cost barrier of face-to-face certification.',
      audienceSegments: [
        'IICRC-certified techs needing CEC maintenance',
        'Regional + remote techs (Cairns to Kalgoorlie)',
        'Shift workers + on-call responders',
        'NRPG contractor pipeline',
      ],
      painPoints: [
        '$2,000+ travel cost for a single face-to-face refresher',
        'Time off truck = lost billable day',
        'Course scheduling collides with on-call rotation',
        'Need verifiable credential employers + insurers recognise',
      ],
      values: [
        'IICRC standards integrity',
        'Cost transparency',
        'Regional access equity',
        'LinkedIn-shareable credential',
      ],
    },
    offerings: [
      '66 IICRC-approved courses (AMRT · OCT · WRT · ASD)',
      'Single-course entry at $20',
      'Annual all-access at $795',
      'Verifiable LinkedIn-shareable credentials',
      'Mobile/tablet/desktop delivery (no app install)',
    ],
    socialProfiles: [
      { platform: 'website', url: 'https://carsi.com.au', verified: true },
    ],
    sourceUrl: 'https://carsi.com.au',
  },

];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[seed] BrandDNA seed for ${BRANDS.length} brands`);

  let created = 0;
  let updated = 0;

  for (const spec of BRANDS) {
    const org = await prisma.organization.findUnique({
      where: { slug: spec.orgSlug },
      select: { id: true, name: true },
    });

    if (!org) {
      console.error(
        `[seed] SKIP: org ${spec.orgSlug} not found — run seed-unite-group-workspace.ts first`
      );
      continue;
    }

    const existing = await prisma.brandDNA.findUnique({
      where: { organizationId: org.id },
      select: { id: true },
    });

    const data = {
      businessName: spec.businessName,
      vertical: spec.vertical,
      industry: spec.industry,
      primaryColour: spec.primaryColour,
      secondaryColour: spec.secondaryColour,
      neutralColour: spec.neutralColour,
      brandVoice: spec.brandVoice as object,
      persona: spec.persona as object,
      offerings: spec.offerings,
      socialProfiles: spec.socialProfiles as object,
      sourceUrl: spec.sourceUrl,
      lastRefreshedAt: new Date(),
    };

    if (existing) {
      await prisma.brandDNA.update({
        where: { organizationId: org.id },
        data,
      });
      updated += 1;
      console.log(`[seed] ✓ updated: ${spec.orgSlug}`);
    } else {
      await prisma.brandDNA.create({
        data: { ...data, organizationId: org.id },
      });
      created += 1;
      console.log(`[seed] + created: ${spec.orgSlug}`);
    }
  }

  console.log(`\n[seed] Complete. created=${created} updated=${updated}`);

  // Verify
  const all = await prisma.brandDNA.findMany({
    where: {
      organization: {
        slug: { in: BRANDS.map(b => b.orgSlug) },
      },
    },
    select: {
      businessName: true,
      brandVoice: true,
      organization: { select: { slug: true } },
    },
    orderBy: { businessName: 'asc' },
  });

  console.log(`\n[seed] ─── BrandDNA verification ─────────────────────────`);
  for (const row of all) {
    const voice = (row.brandVoice as { voiceTag?: string })?.voiceTag ?? '?';
    console.log(
      `[seed]   ${row.organization.slug.padEnd(20)} ${row.businessName.padEnd(40)} voice=${voice}`
    );
  }
  console.log(
    `[seed] ────────────────────────────────────────────────────────\n`
  );
}

main()
  .catch(err => {
    console.error('[seed] FATAL:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
