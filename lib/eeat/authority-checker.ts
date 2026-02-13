/**
 * Authority Checker
 *
 * Checks authoritativeness signals: external citations, industry recognition,
 * publication history, brand mentions, sameAs entity links.
 *
 * @module lib/eeat/authority-checker
 */

import type { AuthoritySignals, AuthorInfo } from './types';

export function checkAuthority(content: string, authorInfo?: AuthorInfo): AuthoritySignals {
  const signals: string[] = [];

  // External citations (references to this content from others)
  const citationPatterns = /\b(cited by|referenced by|as reported by|according to|featured in|published in|appeared in|mentioned in)\b/gi;
  const externalCitations = (content.match(citationPatterns) || []).length;
  if (externalCitations > 0) signals.push(`${externalCitations} external citation reference(s)`);

  // Industry recognition
  const recognitionPatterns = /\b(award|recognized|accredited|certified|endorsed|approved|top\s+\d+|best\s+(?:of|in)|industry leader|thought leader|expert panel|advisory board|keynote|speaker at|conference|summit)\b/gi;
  const industryRecognition = (content.match(recognitionPatterns) || []).length >= 2;
  if (industryRecognition) signals.push('Industry recognition signals detected');

  // Publication history
  const publicationPatterns = /\b(published|peer.reviewed|journal|conference paper|proceedings|white paper|research paper|working paper|preprint|DOI:|ISBN:|ISSN:)\b/gi;
  const publicationHistory = (content.match(publicationPatterns) || []).length >= 1;
  if (publicationHistory) signals.push('Publication history references found');

  // Brand mentions (mentions of established brands/orgs as sources)
  const brandPatterns = /\b(Google|Microsoft|Amazon|Meta|Apple|McKinsey|Harvard|Stanford|MIT|Oxford|Gartner|Forrester|Deloitte|PwC|Reuters|Bloomberg|Nature|Science|Lancet|IEEE|ACM)\b/g;
  const brandMentions = new Set((content.match(brandPatterns) || []).map(b => b.toLowerCase())).size;
  if (brandMentions > 0) signals.push(`${brandMentions} authoritative brand mention(s)`);

  // SameAs entity links (from author profile)
  const socialLinkCount = authorInfo?.socialLinks ? Object.keys(authorInfo.socialLinks).length : 0;
  const contentSameAs = (content.match(/(?:linkedin|twitter|youtube|scholar\.google|wikipedia|orcid|researchgate)\.(?:com|org)/gi) || []).length;
  const sameAsLinks = Math.max(socialLinkCount, contentSameAs);
  if (sameAsLinks > 0) signals.push(`${sameAsLinks} entity/sameAs link(s)`);

  return {
    externalCitations,
    industryRecognition,
    publicationHistory,
    brandMentions,
    sameAsLinks,
    signals,
  };
}
