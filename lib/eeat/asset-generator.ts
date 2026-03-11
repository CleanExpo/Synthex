/**
 * E-E-A-T Asset Generator (Phase 90)
 *
 * Generates ready-to-use templates to fill identified E-E-A-T gaps.
 * Input: EEATAuditResult (from scoreEEATContent)
 * Output: EEATAssetPlan with prioritised, actionable templates.
 *
 * @module lib/eeat/asset-generator
 */

import type { EEATAuditResult, EEATAsset, EEATAssetPlan, EEATAssetPriority } from './audit-types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getPriority(score: number): EEATAssetPriority {
  if (score < 10) return 'high';
  if (score < 18) return 'medium';
  return 'low';
}

// ─── Main generator ───────────────────────────────────────────────────────────

export function generateEEATAssets(result: EEATAuditResult): EEATAssetPlan {
  const assets: EEATAsset[] = [];

  const { experience, expertise, authority, trust } = result;

  // ── Experience assets ─────────────────────────────────────────────────────
  if (experience.score < 20) {
    assets.push({
      type: 'author-bio',
      title: 'Author Experience Bio',
      content: [
        '[NAME] has [X] years of hands-on experience in [FIELD].',
        'In that time, [he/she/they] has personally [tested/implemented/managed] [SPECIFIC_THING],',
        'working with [TYPE_OF_CLIENTS/PROJECTS].',
        'This article draws on [his/her/their] direct experience [SPECIFIC_CONTEXT].',
      ].join(' '),
      priority: getPriority(experience.score),
    });
    assets.push({
      type: 'citation-template',
      title: 'First-Hand Experience Statement',
      content: [
        "I've personally tested [PRODUCT/METHOD/APPROACH] over [TIME_PERIOD] and found that [SPECIFIC_FINDING].",
        'When I [SPECIFIC_ACTION], the result was [SPECIFIC_MEASURABLE_OUTCOME].',
      ].join(' '),
      priority: getPriority(experience.score),
    });
  }

  // ── Expertise assets ─────────────────────────────────────────────────────
  if (expertise.score < 20) {
    assets.push({
      type: 'credential-checklist',
      title: 'Expertise Credential Checklist',
      content: [
        'To strengthen your expertise signals, add the following to your content or author page:',
        '',
        '☐ Formal qualifications: [Degree, Certification, Professional Membership]',
        '☐ Source citation format: "According to [Source Name] (Source: [URL])"',
        '☐ Research reference: "A [YEAR] study by [Institution] found that..."',
        '☐ Specific data: "[X]% of [population] [finding] (Source: [citation])"',
        '☐ Technical specification: "[Product] achieves [X] [unit] under [conditions]"',
      ].join('\n'),
      priority: getPriority(expertise.score),
    });
    assets.push({
      type: 'schema-template',
      title: 'Person Schema (Author Credentials)',
      content: [
        '<script type="application/ld+json">',
        '{',
        '  "@context": "https://schema.org",',
        '  "@type": "Person",',
        '  "name": "[AUTHOR NAME]",',
        '  "jobTitle": "[JOB TITLE]",',
        '  "description": "[1-2 sentence bio with credentials]",',
        '  "hasCredential": {',
        '    "@type": "EducationalOccupationalCredential",',
        '    "name": "[QUALIFICATION NAME]",',
        '    "credentialCategory": "degree"',
        '  },',
        '  "knowsAbout": ["[TOPIC 1]", "[TOPIC 2]"],',
        '  "sameAs": ["[LinkedIn URL]", "[Professional profile URL]"]',
        '}',
        '</script>',
      ].join('\n'),
      priority: getPriority(expertise.score),
    });
  }

  // ── Authority assets ─────────────────────────────────────────────────────
  if (authority.score < 20) {
    assets.push({
      type: 'trust-signal',
      title: 'Authority Trust Bar',
      content: [
        'As featured in: [Publication 1] | [Publication 2] | [Publication 3]',
        'Trusted by [X,000]+ [customers/businesses/professionals]',
        '[X] years serving [industry/market]',
      ].join('\n'),
      priority: getPriority(authority.score),
    });
    assets.push({
      type: 'citation-template',
      title: 'Expert Quote Template',
      content: [
        '"[SPECIFIC QUOTE THAT SUPPORTS YOUR POINT]" — [Full Name], [Title] at [Organisation]',
        '',
        'To use: Reach out to [relevant expert] for a quote on [topic].',
        'Include their full name, title, and organisation for maximum authority signal.',
      ].join('\n'),
      priority: getPriority(authority.score),
    });
  }

  // ── Trust assets ─────────────────────────────────────────────────────────
  if (trust.score < 20) {
    assets.push({
      type: 'trust-signal',
      title: 'Content Transparency Footer',
      content: [
        'Written by [NAME] | Updated: [DD/MM/YYYY] | Reviewed by [REVIEWER NAME], [CREDENTIAL]',
        '[X] citations | Fact-checked against [source]',
        '*This article is for informational purposes only. [Appropriate disclaimer for your topic.]*',
      ].join('\n'),
      priority: getPriority(trust.score),
    });
    assets.push({
      type: 'schema-template',
      title: 'Article Schema (Trust Signals)',
      content: [
        '<script type="application/ld+json">',
        '{',
        '  "@context": "https://schema.org",',
        '  "@type": "Article",',
        '  "headline": "[ARTICLE TITLE]",',
        '  "author": {',
        '    "@type": "Person",',
        '    "name": "[AUTHOR NAME]",',
        '    "url": "[AUTHOR PROFILE URL]"',
        '  },',
        '  "datePublished": "[YYYY-MM-DD]",',
        '  "dateModified": "[YYYY-MM-DD]",',
        '  "publisher": {',
        '    "@type": "Organization",',
        '    "name": "[BRAND NAME]",',
        '    "url": "[WEBSITE URL]"',
        '  },',
        '  "reviewedBy": {',
        '    "@type": "Person",',
        '    "name": "[REVIEWER NAME]"',
        '  }',
        '}',
        '</script>',
      ].join('\n'),
      priority: getPriority(trust.score),
    });
  }

  const quickWins = assets.filter(a => a.priority === 'high' && a.content.length < 500);
  const totalImpact = Math.min(100 - result.overallScore, assets.length * 8);

  return { assets, totalImpact, quickWins };
}
