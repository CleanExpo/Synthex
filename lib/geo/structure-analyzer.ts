/**
 * Structure Analyzer
 *
 * Analyzes content structure: headings, lists, tables, FAQ patterns, schema.
 * Evaluates readability for AI search engine consumption.
 *
 * @module lib/geo/structure-analyzer
 */

import type { StructureAnalysis } from './types';

export function analyzeStructure(content: string): StructureAnalysis {
  // Heading analysis
  const h1Matches = content.match(/^#\s+.+$/gm) || content.match(/<h1[^>]*>.*?<\/h1>/gi) || [];
  const allHeadings = content.match(/^#{1,6}\s+.+$/gm) || content.match(/<h[1-6][^>]*>.*?<\/h[1-6]>/gi) || [];
  const hasH1 = h1Matches.length > 0;

  // Check heading hierarchy (h1 -> h2 -> h3, no skipping)
  const headingLevels = allHeadings.map(h => {
    const mdMatch = h.match(/^(#{1,6})\s/);
    if (mdMatch) return mdMatch[1].length;
    const htmlMatch = h.match(/<h(\d)/i);
    if (htmlMatch) return parseInt(htmlMatch[1]);
    return 0;
  }).filter(Boolean);

  let headingHierarchy = true;
  for (let i = 1; i < headingLevels.length; i++) {
    if (headingLevels[i] > headingLevels[i - 1] + 1) {
      headingHierarchy = false;
      break;
    }
  }

  // Lists
  const hasLists = /^[-*+]\s|^\d+\.\s|<[ou]l>/im.test(content);

  // Tables
  const hasTables = /\|[-:]+\||<table/i.test(content);

  // Schema markup
  const hasSchema = /application\/ld\+json|"@context"|"@type"/i.test(content);

  // FAQ pattern
  const hasFAQ = /FAQ|frequently asked|<details|<summary|\?\s*$/im.test(content) ||
    (content.match(/\?\s*\n/g)?.length || 0) >= 3;

  // Readability score
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 5);
  const words = content.split(/\s+/).filter(Boolean);
  const avgSentenceLength = sentences.length > 0 ? words.length / sentences.length : 0;

  // Sections with answer-first
  const sections = content.split(/^#{1,3}\s+/m).filter(Boolean);
  const totalSections = sections.length;
  let answerFirstSections = 0;
  for (const section of sections) {
    const firstSentence = section.trim().split(/[.!?]/)[0] || '';
    if (/^[A-Z].*(?:is|are|was|has|have|provides?|shows?|reveals?)\b/i.test(firstSentence.trim())) {
      answerFirstSections++;
    }
  }

  // Calculate readability (0-100) — lower sentence length = higher score, with bonus for structural elements
  let readabilityScore = 50;

  // Sentence length scoring (ideal: 15-20 words)
  if (avgSentenceLength >= 12 && avgSentenceLength <= 22) {
    readabilityScore += 20;
  } else if (avgSentenceLength < 30) {
    readabilityScore += 10;
  }

  // Structure bonuses
  if (hasH1) readabilityScore += 5;
  if (headingHierarchy) readabilityScore += 5;
  if (hasLists) readabilityScore += 5;
  if (hasTables) readabilityScore += 5;
  if (hasSchema) readabilityScore += 5;
  if (hasFAQ) readabilityScore += 5;

  return {
    hasH1,
    headingHierarchy,
    hasLists,
    hasTables,
    hasSchema,
    hasFAQ,
    readabilityScore: Math.min(100, readabilityScore),
    answerFirstSections,
    totalSections,
  };
}
