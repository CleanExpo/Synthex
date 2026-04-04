/**
 * E-E-A-T Content Scorer (Phase 90)
 *
 * 20-point automated audit from content text. Pure TypeScript, no external dependencies.
 * Scores 4 pillars of 5 signals × up to 5 points each = 25 max per pillar = 100 total.
 *
 * Usage: scoreEEATContent(text: string): EEATAuditResult
 *
 * @module lib/eeat/content-scorer
 */

import type { EEATAuditResult, EEATDimension, EEATSignal } from './audit-types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function countWords(text: string): number {
  return (text.match(/\b\w+\b/g) ?? []).length;
}

function detectSignal(text: string, pattern: RegExp, name: string, weight: number): EEATSignal {
  const match = pattern.exec(text);
  return {
    name,
    detected: match !== null,
    weight,
    evidence: match ? match[0].substring(0, 100) : undefined,
  };
}

function buildDimension(signals: EEATSignal[], missingDescriptions: Record<string, string>): EEATDimension {
  const score = Math.min(25, signals.filter(s => s.detected).reduce((sum, s) => sum + s.weight, 0));
  const missing = signals
    .filter(s => !s.detected)
    .map(s => missingDescriptions[s.name] ?? `Add ${s.name}`);
  return { score, maxScore: 25, signals, missing };
}

function getGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

// ─── Main scorer ─────────────────────────────────────────────────────────────

export function scoreEEATContent(text: string): EEATAuditResult {
  const wordCount = countWords(text);

  // ── EXPERIENCE (5 signals × up to 5 pts each = 25 max) ───────────────────
  const experienceSignals: EEATSignal[] = [
    detectSignal(
      text,
      /\b(I (tested|tried|found|discovered|noticed|experienced)|we (found|observed|measured|tested|noticed))\b/i,
      'First-hand language',
      5,
    ),
    detectSignal(
      text,
      /\b(in (January|February|March|April|May|June|July|August|September|October|November|December)|in 20\d\d|last (month|year|week)|on (Monday|Tuesday|Wednesday|Thursday|Friday))\b/i,
      'Specific dates/times',
      5,
    ),
    detectSignal(
      text,
      /\b\d+(\.\d+)?%|\d+ (percent|respondents|participants|users|customers|cases)\b/i,
      'Original data/statistics',
      5,
    ),
    detectSignal(
      text,
      /\b(in my experience|from my own|when I|I'?ve personally)\b/i,
      'Personal examples',
      5,
    ),
    detectSignal(
      text,
      /\b(case stud(y|ies)|real example|actual client|our client|we helped)\b/i,
      'Case study language',
      5,
    ),
  ];
  const experience = buildDimension(experienceSignals, {
    'First-hand language': "Use first-person experience language (I tested, we found)",
    'Specific dates/times': 'Include specific dates and timeframes for your findings',
    'Original data/statistics': 'Add original data or statistics with percentages',
    'Personal examples': "Share personal experiences with 'in my experience' or 'I've personally'",
    'Case study language': 'Reference actual case studies or real client examples',
  });

  // ── EXPERTISE (5 signals) ─────────────────────────────────────────────────
  const expertiseSignals: EEATSignal[] = [
    detectSignal(
      text,
      /\b(PhD|MD|MBA|CPA|CISSP|certified|licensed|registered|accredited|Fellow of|member of|Chartered)\b/i,
      'Author credentials',
      5,
    ),
    detectSignal(
      text,
      /https?:\/\/\S+|\(Source:|\[\d+\]|according to [A-Z]|per [A-Z]|cited by/i,
      'Source citations',
      5,
    ),
    detectSignal(
      text,
      /\b\d+(\.\d+)?\s*(GHz|GB|TB|MB|mm|cm|kg|kg\/m|ISO \d+|RFC \d+|v\d+\.\d+)\b/i,
      'Precise specifications',
      5,
    ),
    detectSignal(
      text,
      /\b(research (shows|suggests|indicates|found|demonstrates)|stud(y|ies)|peer-reviewed|meta-analysis|systematic review|randomized)\b/i,
      'Research language',
      5,
    ),
    detectSignal(
      text,
      /\b(technical(ly)?|algorithm|methodology|framework|protocol|specification|implementation|architecture)\b/i,
      'Technical depth',
      5,
    ),
  ];
  const expertise = buildDimension(expertiseSignals, {
    'Author credentials': 'Add author credentials (PhD, certifications, professional memberships)',
    'Source citations': 'Include citations with URLs or named publications',
    'Precise specifications': 'Add precise technical specifications with units',
    'Research language': 'Reference research findings or studies',
    'Technical depth': 'Include technical terminology appropriate to the topic',
  });

  // ── AUTHORITY (5 signals) ─────────────────────────────────────────────────
  const authoritySignals: EEATSignal[] = [
    detectSignal(
      text,
      /\b(according to (Google|Apple|Microsoft|Amazon|Meta|the (ABS|ATO|ACCC|RBA)|[A-Z][a-z]+ (University|Institute|Foundation|Association|Government)))\b/i,
      'Named authority references',
      5,
    ),
    detectSignal(
      text,
      /\b(award(ed)?|recognised|ranked|#1|top (10|5|3)|industry leader|featured in|as seen in)\b/i,
      'Awards/recognition',
      5,
    ),
    detectSignal(
      text,
      /\b(\d+(,\d{3})* (customers|clients|users|downloads|subscribers|followers|businesses))\b/i,
      'Social proof numbers',
      5,
    ),
    detectSignal(
      text,
      /[A-Z][a-z]+ [A-Z][a-z]+,\s*[A-Z]|"[^"]{10,100}"\s*—\s*[A-Z]/,
      'Expert quotes with attribution',
      5,
    ),
    detectSignal(
      text,
      /\b(\d+ years? (of )?(experience|in the industry|in business|serving|helping))\b/i,
      'Years of experience',
      5,
    ),
  ];
  const authority = buildDimension(authoritySignals, {
    'Named authority references': 'Reference named authoritative organisations (e.g., "according to Google")',
    'Awards/recognition': 'Mention awards, rankings, or media features',
    'Social proof numbers': 'Include specific customer/client numbers',
    'Expert quotes with attribution': 'Add expert quotes with full name and title attribution',
    'Years of experience': 'State years of experience explicitly',
  });

  // ── TRUST (5 signals) ─────────────────────────────────────────────────────
  const trustSignals: EEATSignal[] = [
    detectSignal(
      text,
      /\b(written by|reviewed by|updated (on|by|:)|author:|by [A-Z][a-z]+ [A-Z][a-z]+)\b/i,
      'Author/review attribution',
      5,
    ),
    detectSignal(
      text,
      /\b(please consult|seek professional|note that|disclaimer|this (is|article) (not|intended|general)|not (financial|legal|medical) advice)\b/i,
      'Appropriate disclaimers',
      5,
    ),
    detectSignal(
      text,
      /\b(contact us|get in touch|about (us|me|the author)|our team|[a-z]+@[a-z]+\.[a-z]{2,})\b/i,
      'Contact/transparency',
      5,
    ),
    detectSignal(
      text,
      /\b(privacy policy|GDPR|data protection|secure|encrypted|SSL|TLS|certificate|ISO 27001)\b/i,
      'Security/privacy signals',
      5,
    ),
    detectSignal(
      text,
      /\b(\d{1,2}\/\d{1,2}\/20\d\d|20\d\d-\d{2}-\d{2}|version \d+\.\d+|v\d+\.\d+|changelog)\b/i,
      'Factual precision/dates',
      5,
    ),
  ];
  const trust = buildDimension(trustSignals, {
    'Author/review attribution': 'Add "Written by [Name]" or "Reviewed by [Credential]"',
    'Appropriate disclaimers': 'Include appropriate disclaimers for your topic (e.g., "please consult a professional")',
    'Contact/transparency': 'Add contact information or "About the author" reference',
    'Security/privacy signals': 'Reference privacy policy or security standards if applicable',
    'Factual precision/dates': 'Include specific dates (e.g., "Updated 15/03/2026") or version numbers',
  });

  const overallScore = experience.score + expertise.score + authority.score + trust.score;

  return {
    experience,
    expertise,
    authority,
    trust,
    overallScore,
    grade: getGrade(overallScore),
    wordCount,
    auditedAt: new Date().toISOString(),
  };
}
