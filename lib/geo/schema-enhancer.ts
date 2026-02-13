/**
 * Schema Enhancer
 *
 * Analyzes content for schema markup issues and recommends GEO-specific schemas.
 * Checks for Dataset, SpeakableSpecification, ClaimReview, and Article schemas.
 *
 * @module lib/geo/schema-enhancer
 */

import type { SchemaIssue } from './types';

const GEO_REQUIRED_SCHEMAS = [
  { type: 'Article', description: 'Article schema with author attribution' },
  { type: 'FAQPage', description: 'FAQ schema for question-based content' },
  { type: 'HowTo', description: 'HowTo schema for process content' },
  { type: 'Dataset', description: 'Dataset schema for first-party data' },
  { type: 'SpeakableSpecification', description: 'Speakable schema for voice search' },
  { type: 'ClaimReview', description: 'ClaimReview for fact-checking content' },
];

export function analyzeSchema(content: string, url?: string): SchemaIssue[] {
  const issues: SchemaIssue[] = [];

  // Check if any JSON-LD exists
  const hasJsonLd = /application\/ld\+json/i.test(content) || /"@context"\s*:\s*"https?:\/\/schema\.org"/i.test(content);

  if (!hasJsonLd) {
    issues.push({
      type: 'missing_schema',
      severity: 'error',
      message: 'No JSON-LD schema markup detected',
      recommendation: 'Add Article schema with author attribution as minimum for GEO compliance',
    });
    return issues; // No point checking further
  }

  // Check for Article schema
  if (!/"@type"\s*:\s*"Article"/i.test(content) && !/"@type"\s*:\s*"NewsArticle"/i.test(content) && !/"@type"\s*:\s*"BlogPosting"/i.test(content)) {
    issues.push({
      type: 'missing_article_schema',
      severity: 'error',
      message: 'No Article/BlogPosting schema detected',
      recommendation: 'Add Article schema with author, datePublished, and dateModified',
    });
  }

  // Check for author in schema
  if (hasJsonLd && !/"author"\s*:/i.test(content)) {
    issues.push({
      type: 'missing_author',
      severity: 'warning',
      message: 'Schema lacks author attribution',
      recommendation: 'Add author property with Person schema and sameAs links',
    });
  }

  // Check for SpeakableSpecification
  if (!/"SpeakableSpecification"/i.test(content)) {
    issues.push({
      type: 'missing_speakable',
      severity: 'info',
      message: 'No SpeakableSpecification schema — reduces voice search/AI reading eligibility',
      recommendation: 'Add SpeakableSpecification pointing to key passages for AI voice extraction',
    });
  }

  // Check for Dataset schema if content has data
  const hasDataContent = /\d+%|\d+\.\d+|survey|benchmark|report|study|findings/i.test(content);
  if (hasDataContent && !/"Dataset"/i.test(content)) {
    issues.push({
      type: 'missing_dataset',
      severity: 'info',
      message: 'Content appears data-rich but lacks Dataset schema',
      recommendation: 'Add Dataset schema for Google Dataset Search discoverability',
    });
  }

  // Check for FAQ if content has questions
  const questionCount = (content.match(/\?\s*$/gm) || []).length;
  if (questionCount >= 3 && !/"FAQPage"/i.test(content)) {
    issues.push({
      type: 'missing_faq',
      severity: 'warning',
      message: `Content has ${questionCount} questions but no FAQPage schema`,
      recommendation: 'Add FAQPage schema for each Q&A pair',
    });
  }

  return issues;
}

/**
 * Generate recommended schema markup for content
 */
export function generateSchemaRecommendations(content: string): string[] {
  const recommendations: string[] = [];

  if (/\d+%|\btable\b|data|findings|results/i.test(content)) {
    recommendations.push('Dataset');
  }
  if (/\?/g.test(content)) {
    recommendations.push('FAQPage');
  }
  if (/step|how to|guide|tutorial/i.test(content)) {
    recommendations.push('HowTo');
  }
  recommendations.push('Article', 'SpeakableSpecification');

  return [...new Set(recommendations)];
}
