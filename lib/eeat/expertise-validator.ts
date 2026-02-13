/**
 * Expertise Validator
 *
 * Validates expertise signals in content and author profile.
 * Checks credentials, technical accuracy, vocabulary depth, currency.
 *
 * @module lib/eeat/expertise-validator
 */

import type { ExpertiseSignals, AuthorInfo } from './types';

export function validateExpertise(content: string, authorInfo?: AuthorInfo): ExpertiseSignals {
  const signals: string[] = [];

  // Author credentials
  const authorCredentials = !!(authorInfo?.credentials && authorInfo.credentials.length > 0);
  if (authorCredentials) {
    signals.push(`Author has ${authorInfo!.credentials!.length} credential(s)`);
  }

  // Relevant qualifications
  const qualificationPatterns = /\b(Ph\.?D|M\.?D|MBA|CPA|CFA|LCSW|RN|BSc|MSc|certified|licensed|board.certified|registered|accredited|fellowship)/gi;
  const contentQualifications = (content.match(qualificationPatterns) || []).length;
  const authorQualifications = authorInfo?.credentials?.length || 0;
  const relevantQualifications = Math.max(contentQualifications, authorQualifications);
  if (relevantQualifications > 0) signals.push(`${relevantQualifications} qualification(s) found`);

  // Technical accuracy indicators
  const technicalPatterns = /\b(according to .{5,50}(?:\d{4})?|research (?:shows|indicates|suggests|found)|(?:peer.reviewed|published in)|data from|statistical(?:ly)? significant|p\s*[<=]\s*0\.\d+|confidence interval|correlation|regression)/gi;
  const technicalAccuracy = (content.match(technicalPatterns) || []).length >= 2;
  if (technicalAccuracy) signals.push('Technical accuracy indicators present');

  // Specialized vocabulary density
  const specializedPatterns = /\b(algorithm|optimization|methodology|implementation|architecture|framework|infrastructure|protocol|specification|throughput|latency|scalability|deployment|containerization|microservices|regression|coefficient|variance|distribution|benchmark|compliance|governance|regulatory|fiduciary|amortization|depreciation)\b/gi;
  const specializedVocabulary = new Set((content.match(specializedPatterns) || []).map(w => w.toLowerCase())).size;
  if (specializedVocabulary > 3) signals.push(`${specializedVocabulary} specialized terms used`);

  // Up-to-date (references recent dates)
  const currentYear = new Date().getFullYear();
  const recentYears = [currentYear, currentYear - 1].map(String);
  const upToDate = recentYears.some(year => content.includes(year));
  if (upToDate) signals.push('Content references recent data');

  // Byline visible
  const bylineVisible = /\b(by\s+[A-Z][a-z]+\s+[A-Z][a-z]+|written by|author:|byline)/i.test(content) || !!(authorInfo?.name);
  if (bylineVisible) signals.push('Author byline present');

  return {
    authorCredentials,
    relevantQualifications,
    technicalAccuracy,
    specializedVocabulary,
    upToDate,
    bylineVisible,
    signals,
  };
}
