/**
 * Trust Analyzer
 *
 * Analyzes trustworthiness signals: contact info, privacy policy, HTTPS,
 * transparency, reviews, correction history.
 * Weight: 30% of overall E-E-A-T (highest dimension).
 *
 * @module lib/eeat/trust-analyzer
 */

import type { TrustSignals } from './types';

export function analyzeTrust(content: string, url?: string): TrustSignals {
  const signals: string[] = [];

  // Contact information
  const contactInfo = /\b(contact us|email:|phone:|address:|tel:|mailto:|support@|info@|help@|\d{3}[-.\s]\d{3}[-.\s]\d{4})\b/i.test(content);
  if (contactInfo) signals.push('Contact information present');

  // Privacy policy
  const privacyPolicy = /\b(privacy policy|privacy statement|data protection|GDPR|cookie policy|terms of service|terms and conditions|terms of use)\b/i.test(content);
  if (privacyPolicy) signals.push('Privacy/terms references found');

  // HTTPS (check URL if provided)
  const httpsValid = url ? url.startsWith('https://') : /https:\/\//i.test(content);
  if (httpsValid) signals.push('HTTPS detected');

  // Transparency statement
  const transparencyStatement = /\b(disclosure|disclaimer|affiliate|sponsored|paid partnership|editorial policy|fact.check|correction policy|our methodology|how we (?:rate|review|test|evaluate)|transparency|updated on|last (?:updated|reviewed|modified))\b/i.test(content);
  if (transparencyStatement) signals.push('Transparency/disclosure statement detected');

  // Reviews and testimonials
  const reviewsPresent = /\b(review|testimonial|rating|customer feedback|client feedback|\d+(?:\.\d+)?\s*(?:out of|\/)\s*\d+\s*stars?|★|⭐)\b/i.test(content);
  if (reviewsPresent) signals.push('Reviews/testimonials detected');

  // Corrections and update history
  const correctionsHistory = /\b(correction:|update:|editor's note:|previously stated|we have updated|this article was (?:updated|corrected|revised)|errata|retraction|clarification)\b/i.test(content);
  if (correctionsHistory) signals.push('Correction/update history detected');

  return {
    contactInfo,
    privacyPolicy,
    httpsValid,
    transparencyStatement,
    reviewsPresent,
    correctionsHistory,
    signals,
  };
}
