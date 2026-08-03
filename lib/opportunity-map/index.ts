import { z } from 'zod';
import type { PipelineResult } from '@/lib/ai/onboarding-pipeline';

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>()\[\]{}"']+/gi;
const SOCIAL_HOSTS: Record<string, string> = {
  'instagram.com': 'Instagram',
  'facebook.com': 'Facebook',
  'linkedin.com': 'LinkedIn',
  'youtube.com': 'YouTube',
  'youtu.be': 'YouTube',
  'tiktok.com': 'TikTok',
  'x.com': 'X',
  'twitter.com': 'X',
  'pinterest.com': 'Pinterest',
  'reddit.com': 'Reddit',
  'threads.net': 'Threads',
};

export const opportunityMapIntakeSchema = z
  .object({
    businessName: z.string().trim().max(200).optional(),
    context: z.string().trim().min(8).max(8_000),
    source: z.string().trim().max(100).optional(),
    medium: z.string().trim().max(100).optional(),
    campaign: z.string().trim().max(100).optional(),
  })
  .strict();

export type OpportunityMapIntakeRequest = z.infer<
  typeof opportunityMapIntakeSchema
>;

export type EvidenceKind = 'website' | 'social' | 'document' | 'note';

export interface OpportunityMapEvidence {
  id: string;
  kind: EvidenceKind;
  label: string;
  value: string;
  state: 'observed' | 'provided';
}

export interface ParsedOpportunityMapIntake {
  businessName: string;
  website: string;
  evidence: OpportunityMapEvidence[];
  contextNote: string | null;
  attribution: {
    source?: string;
    medium?: string;
    campaign?: string;
  };
}

export interface OpportunityDirection {
  id: string;
  rank: number;
  title: string;
  direction: string;
  whyNow: string;
  score: number;
  value: 'high' | 'medium';
  effort: 'low' | 'medium' | 'high';
  evidence: string[];
  assumptions: string[];
  outcome: string;
}

export interface OpportunityMap {
  version: '1.0';
  generatedAt: string;
  brandContext: {
    businessName: string;
    website: string;
    industry: string | null;
    description: string | null;
    audience: string | null;
    tone: string | null;
    topics: string[];
    confidence: number;
  };
  evidence: OpportunityMapEvidence[];
  signals: Array<{
    label: string;
    value: string;
    state: 'observed' | 'missing' | 'inferred';
  }>;
  gaps: Array<{
    label: string;
    detail: string;
    state: 'observed' | 'unknown';
  }>;
  opportunities: OpportunityDirection[];
  fit: {
    score: number;
    state: 'qualified' | 'developing' | 'needs-context';
    explanation: string;
  };
  recommendedNextMove: string;
  serviceRecommendation: {
    title: string;
    summary: string;
    included: string[];
    boundaries: string[];
  };
}

function cleanUrlToken(value: string): string {
  return value.replace(/[),.;!?]+$/, '');
}

function normalizeUrl(value: string): string {
  const cleaned = cleanUrlToken(value);
  return cleaned.startsWith('http') ? cleaned : `https://${cleaned}`;
}

function socialPlatform(url: string): string | null {
  const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  for (const [host, platform] of Object.entries(SOCIAL_HOSTS)) {
    if (hostname === host || hostname.endsWith(`.${host}`)) return platform;
  }
  return null;
}

function isDocumentUrl(url: string): boolean {
  const parsed = new URL(url);
  return (
    /\.(pdf|docx?|pptx?|txt|md)$/i.test(parsed.pathname) ||
    ['docs.google.com', 'drive.google.com', 'dropbox.com'].some(host =>
      parsed.hostname.endsWith(host)
    )
  );
}

function businessNameFromUrl(url: string): string {
  const label = new URL(url).hostname.replace(/^www\./, '').split('.')[0];
  return label
    .split(/[-_]/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function parseOpportunityMapIntake(
  request: OpportunityMapIntakeRequest
): ParsedOpportunityMapIntake {
  const matches = request.context.match(URL_PATTERN) ?? [];
  const urls = [...new Set(matches.map(normalizeUrl))];
  const classified = urls.map(url => ({
    url,
    social: socialPlatform(url),
    document: isDocumentUrl(url),
  }));
  const website = classified.find(item => !item.social && !item.document)?.url;

  if (!website) {
    throw new Error(
      'Add your website as a full link, for example https://yourbusiness.com.au.'
    );
  }

  const contextNote = request.context
    .replace(URL_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const evidence: OpportunityMapEvidence[] = classified.map((item, index) => {
    if (item.social) {
      return {
        id: `source-${index + 1}`,
        kind: 'social',
        label: item.social,
        value: item.url,
        state: 'provided',
      };
    }
    if (item.document) {
      return {
        id: `source-${index + 1}`,
        kind: 'document',
        label: 'Reference document',
        value: item.url,
        state: 'provided',
      };
    }
    return {
      id: `source-${index + 1}`,
      kind: 'website',
      label: item.url === website ? 'Primary website' : 'Reference website',
      value: item.url,
      state: 'provided',
    };
  });

  if (contextNote) {
    evidence.push({
      id: `source-${evidence.length + 1}`,
      kind: 'note',
      label: 'Your context',
      value: contextNote.slice(0, 1_000),
      state: 'provided',
    });
  }

  return {
    businessName: request.businessName?.trim() || businessNameFromUrl(website),
    website,
    evidence,
    contextNote: contextNote || null,
    attribution: {
      source: request.source,
      medium: request.medium,
      campaign: request.campaign,
    },
  };
}

interface Candidate extends Omit<OpportunityDirection, 'rank'> {}

function average(values: Array<number | null | undefined>): number | null {
  const present = values.filter((value): value is number => value != null);
  if (present.length === 0) return null;
  return present.reduce((sum, value) => sum + value, 0) / present.length;
}

function buildCandidates(
  input: ParsedOpportunityMapIntake,
  analysis: PipelineResult
): Candidate[] {
  const seo = analysis.seoSignals;
  const speed = average([
    analysis.pageSpeed.mobile?.score,
    analysis.pageSpeed.desktop?.score,
  ]);
  const socialCount = new Set([
    ...input.evidence
      .filter(item => item.kind === 'social')
      .map(item => item.label),
    ...analysis.socialProfiles.map(item => item.platform),
  ]).size;
  const wordCount = seo?.wordCount ?? 0;
  const hasAudience = Boolean(analysis.targetAudience);
  const hasOfferStory = Boolean(analysis.description && hasAudience);

  return [
    {
      id: 'search-demand',
      title: 'Capture existing search demand',
      direction:
        'Build one evidence-led search cluster around the strongest customer problem, then connect each page to a clear service path.',
      whyNow:
        analysis.seoScore < 70
          ? `The observed on-page search foundation scored ${analysis.seoScore}/100.`
          : 'The site has a workable technical base; the next leverage is topic depth and conversion intent.',
      score: Math.round(Math.max(54, 92 - analysis.seoScore * 0.42)),
      value: 'high',
      effort: analysis.seoScore < 40 ? 'medium' : 'low',
      evidence: [
        `Observed SEO foundation: ${analysis.seoScore}/100`,
        seo?.h1
          ? `Primary page heading observed: “${seo.h1.slice(0, 90)}”`
          : 'No primary page heading was observed',
      ],
      assumptions: [
        'Search demand and keyword difficulty still require market research before production.',
      ],
      outcome:
        'More qualified discovery traffic reaching a measurable service action.',
    },
    {
      id: 'offer-clarity',
      title: 'Make the buying path unmistakable',
      direction:
        'Translate the offer into one audience-specific promise, one proof path and one next action across the highest-intent pages.',
      whyNow: hasOfferStory
        ? 'The site communicates an offer and audience; the opportunity is to tighten the path from interest to action.'
        : 'The scan could not verify both a clear offer description and target audience.',
      score: hasOfferStory ? 64 : 88,
      value: 'high',
      effort: 'low',
      evidence: [
        analysis.description
          ? `Observed description: “${analysis.description.slice(0, 120)}”`
          : 'No reliable offer description was extracted',
        hasAudience
          ? `Inferred audience: ${analysis.targetAudience}`
          : 'Target audience needs confirmation',
      ],
      assumptions: [
        'Customer interviews or conversion data may change the recommended promise.',
      ],
      outcome: 'A shorter, attributable path from visit to qualified enquiry.',
    },
    {
      id: 'authority-system',
      title: 'Turn expertise into an authority system',
      direction:
        'Create a repeatable answer library from real customer questions, proof and practitioner knowledge, then adapt it for owned channels.',
      whyNow:
        wordCount < 700 || analysis.keyTopics.length < 3
          ? 'The website exposes limited depth for customers and search systems to evaluate.'
          : 'The site has useful subject matter that can be repackaged into a consistent authority rhythm.',
      score: Math.round(
        Math.max(
          58,
          86 - Math.min(20, wordCount / 80) - analysis.keyTopics.length * 2
        )
      ),
      value: 'high',
      effort: 'medium',
      evidence: [
        `${wordCount.toLocaleString()} words observed on the primary page`,
        analysis.keyTopics.length
          ? `Detected topics: ${analysis.keyTopics.slice(0, 3).join(', ')}`
          : 'No dependable topic set was extracted',
      ],
      assumptions: [
        'Subject-matter evidence and customer questions must be supplied or researched.',
      ],
      outcome:
        'Reusable, evidence-backed content that compounds trust and discovery.',
    },
    {
      id: 'channel-focus',
      title: 'Concentrate channel effort',
      direction:
        'Choose one primary distribution channel from audience evidence and build a measured publishing rhythm before expanding.',
      whyNow:
        socialCount < 2
          ? `Only ${socialCount} connected or supplied social channel${socialCount === 1 ? ' was' : 's were'} visible in the scan.`
          : `${socialCount} social channels are visible; focus will reduce duplicated, low-signal production.`,
      score: socialCount < 2 ? 76 : 62,
      value: 'medium',
      effort: 'medium',
      evidence: [
        `${socialCount} social channel${socialCount === 1 ? '' : 's'} observed or supplied`,
      ],
      assumptions: [
        'Channel selection requires audience presence and current performance data.',
        'No unattended publishing is included without platform authorization.',
      ],
      outcome:
        'A sustainable channel cadence with attributable engagement signals.',
    },
    {
      id: 'site-experience',
      title: 'Remove experience friction',
      direction:
        'Prioritise the highest-impact mobile speed and page-structure fixes before adding more campaign traffic.',
      whyNow:
        speed == null
          ? 'Page-speed evidence was unavailable, so experience risk remains unresolved.'
          : `Observed average performance was ${Math.round(speed)}/100 across available tests.`,
      score: speed == null ? 60 : Math.round(Math.max(50, 95 - speed * 0.45)),
      value: speed != null && speed < 55 ? 'high' : 'medium',
      effort: 'medium',
      evidence: [
        speed == null
          ? 'Performance measurement unavailable'
          : `Observed performance average: ${Math.round(speed)}/100`,
      ],
      assumptions: [
        'A technical audit is required before estimating remediation effort.',
      ],
      outcome:
        'More visitors reach the offer without avoidable experience loss.',
    },
  ];
}

function missingLabel(path: string): string {
  const labels: Record<string, string> = {
    industry: 'Industry',
    description: 'Offer description',
    'brandColors.primary': 'Primary brand colour',
    logo: 'Logo',
    logoUrl: 'Logo',
    keyTopics: 'Core topics',
    targetAudience: 'Target audience',
    socialHandles: 'Social channels',
    abn: 'Business identifier',
  };
  return labels[path] ?? path.replace(/([A-Z])/g, ' $1');
}

export function buildOpportunityMap(
  input: ParsedOpportunityMapIntake,
  analysis: PipelineResult,
  now: Date = new Date()
): OpportunityMap {
  const candidates = buildCandidates(input, analysis)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));

  const socialCount = new Set([
    ...input.evidence
      .filter(item => item.kind === 'social')
      .map(item => item.label),
    ...analysis.socialProfiles.map(item => item.platform),
  ]).size;
  const evidenceScore = Math.min(
    50,
    (analysis.seoSignals ? 12 : 0) +
      (analysis.description ? 10 : 0) +
      Math.min(10, Math.round(analysis.confidence / 10)) +
      Math.min(8, socialCount * 3) +
      (input.contextNote ? 5 : 0) +
      (Object.values(analysis.structuredData).some(Boolean) ? 5 : 0)
  );
  const needScore = Math.round(
    candidates.reduce((sum, item) => sum + item.score, 0) /
      candidates.length /
      2
  );
  const criticalMissing = analysis.dataRequired.filter(path =>
    ['industry', 'description', 'targetAudience'].includes(path)
  ).length;
  const fitScore = Math.max(
    0,
    Math.min(100, evidenceScore + needScore - criticalMissing * 4)
  );
  const fitState =
    fitScore >= 65
      ? 'qualified'
      : fitScore >= 45
        ? 'developing'
        : 'needs-context';

  const fitExplanation =
    fitState === 'qualified'
      ? 'There is enough observed context and commercial headroom to shape a Unite-Group service recommendation.'
      : fitState === 'developing'
        ? 'The direction is promising, but the missing context should be resolved before production is scoped.'
        : 'The scan found useful signals, but not enough reliable context to recommend production yet.';

  return {
    version: '1.0',
    generatedAt: now.toISOString(),
    brandContext: {
      businessName: input.businessName,
      website: input.website,
      industry: analysis.industry === 'other' ? null : analysis.industry,
      description: analysis.description || null,
      audience: analysis.targetAudience || null,
      tone: analysis.suggestedTone || null,
      topics: analysis.keyTopics,
      confidence: analysis.confidence,
    },
    evidence: input.evidence,
    signals: [
      {
        label: 'Search foundation',
        value: `${analysis.seoScore}/100`,
        state: analysis.seoSignals ? 'observed' : 'missing',
      },
      {
        label: 'Website health',
        value: analysis.overallHealth.replace('-', ' '),
        state: analysis.seoSignals ? 'observed' : 'inferred',
      },
      {
        label: 'Visible channels',
        value: String(socialCount),
        state: 'observed',
      },
      {
        label: 'Context confidence',
        value: `${analysis.confidence}/100`,
        state: 'inferred',
      },
    ],
    gaps: analysis.dataRequired.slice(0, 6).map(path => ({
      label: missingLabel(path),
      detail:
        'This was not verified from the supplied evidence and remains editable context.',
      state: 'unknown',
    })),
    opportunities: candidates,
    fit: {
      score: fitScore,
      state: fitState,
      explanation: fitExplanation,
    },
    recommendedNextMove: candidates[0].direction,
    serviceRecommendation: {
      title:
        fitState === 'qualified'
          ? 'Shape an owned-channel growth sprint'
          : 'Complete the evidence map before production',
      summary:
        fitState === 'qualified'
          ? `Use ${candidates[0].title.toLowerCase()} as the first commercial workstream, with the map preserved as the starting Brand Context.`
          : 'Resolve the visible context gaps, then rescore the map before campaign work begins.',
      included: [
        'Evidence and customer-intent research',
        'Offer and owned-channel strategy',
        'One measurable campaign direction',
        'Claim, rights and cost gates before production',
      ],
      boundaries: [
        'No public publishing or paid spend is authorized by this map.',
        'Unverified claims remain omitted or blocked.',
        'Agreement, payment and account authorization remain explicit authority events.',
      ],
    },
  };
}

export function opportunityMapToMarkdown(map: OpportunityMap): string {
  const lines = [
    `# ${map.brandContext.businessName} — Nexus Marketing Opportunity Map`,
    '',
    `Generated: ${map.generatedAt}`,
    `Website: ${map.brandContext.website}`,
    `Commercial fit: ${map.fit.score}/100 (${map.fit.state})`,
    '',
    '## Brand context',
    '',
    map.brandContext.description || 'Description requires confirmation.',
    '',
    `Audience: ${map.brandContext.audience || 'Requires confirmation'}`,
    `Topics: ${map.brandContext.topics.join(', ') || 'Require confirmation'}`,
    '',
    '## Ranked directions',
    '',
    ...map.opportunities.flatMap(item => [
      `### ${item.rank}. ${item.title} — ${item.score}/100`,
      '',
      item.direction,
      '',
      `Why now: ${item.whyNow}`,
      `Outcome: ${item.outcome}`,
      '',
      'Evidence:',
      ...item.evidence.map(value => `- ${value}`),
      '',
      'Assumptions:',
      ...item.assumptions.map(value => `- ${value}`),
      '',
    ]),
    '## Recommended next move',
    '',
    map.recommendedNextMove,
    '',
    '## Boundaries',
    '',
    ...map.serviceRecommendation.boundaries.map(value => `- ${value}`),
  ];
  return lines.join('\n');
}
