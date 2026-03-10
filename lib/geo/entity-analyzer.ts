/**
 * GEO Entity Coherence Analyser
 *
 * Extracts named entities from content and scores entity density + coherence.
 * Research basis: Princeton KDD 2024 — 15+ entities = 4.8x higher citation rate.
 * Optimal proper noun density: ~20.6% of total words.
 *
 * Uses regex-based extraction only — no external NLP libraries.
 *
 * @module lib/geo/entity-analyzer
 */

import type { EntityAnalysisResult, EntityMention, EntityType } from './types';

// --- Constants ---

const ORG_SUFFIXES = /\b(Inc|Ltd|LLC|Corp|Corporation|Foundation|Institute|University|Association|Agency|Group|Holdings|Technologies|Solutions|Services|Systems|Labs|Studio|Studios|Media|Partners|Ventures|Capital|Fund)\b/;

const ACRONYM_PATTERN = /\b[A-Z]{3,}\b/g;

// Matches "John Smith" or "John D Smith" — two or three capitalised word sequences
const PERSON_PATTERN = /\b([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g;

// Known locations and major tech companies treated as seed entities
const LOCATION_SEEDS = new Set([
  // Countries
  'Australia', 'United States', 'United Kingdom', 'Canada', 'Germany', 'France',
  'Japan', 'China', 'India', 'Brazil', 'Italy', 'Spain', 'Mexico', 'Russia',
  'South Korea', 'Netherlands', 'Sweden', 'Norway', 'Denmark', 'Finland',
  'Switzerland', 'Austria', 'Belgium', 'Portugal', 'Poland', 'Argentina',
  'Chile', 'Colombia', 'Singapore', 'New Zealand', 'Ireland', 'Israel',
  'UAE', 'Saudi Arabia', 'Indonesia', 'Thailand', 'Vietnam', 'Philippines',
  // Major cities
  'Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'London', 'New York',
  'San Francisco', 'Los Angeles', 'Chicago', 'Seattle', 'Boston', 'Austin',
  'Tokyo', 'Beijing', 'Shanghai', 'Berlin', 'Paris', 'Toronto', 'Vancouver',
  'Singapore', 'Dubai', 'Amsterdam', 'Dublin', 'Zurich', 'Stockholm',
  'Mumbai', 'Bangalore', 'Seoul', 'Hong Kong', 'Taipei', 'Bangkok',
  // Major tech companies (treated as known entities for seed matching)
  'Google', 'Microsoft', 'Apple', 'Meta', 'Amazon', 'OpenAI', 'Anthropic',
  'Tesla', 'Netflix', 'Spotify', 'Uber', 'Airbnb', 'Twitter', 'LinkedIn',
  'Salesforce', 'Oracle', 'SAP', 'IBM', 'Intel', 'NVIDIA', 'Adobe',
]);

// Ambiguous reference pronouns/phrases near org mentions
const AMBIGUOUS_ORG_REFS = /\b(it|they|them|their|the company|the organisation|the organization|the firm|the startup|the brand)\b/gi;

// Sentence boundary — used to filter out sentence-starting false positives for PERSON
const SENTENCE_END_PATTERN = /[.!?]\s+$/;

// --- Main Export ---

export function analyzeEntities(text: string): EntityAnalysisResult {
  // Strip HTML tags before processing
  const cleanText = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const wordCount = cleanText.split(/\s+/).filter(Boolean).length;

  // Extract each entity type
  const persons = extractPersons(cleanText);
  const organisations = extractOrganisations(cleanText);
  const locations = extractLocations(cleanText);

  // Concepts are capitalised single nouns not already captured, repeating 2+ times
  const alreadyCaptured = new Set([
    ...persons.map(e => e.text.toLowerCase()),
    ...organisations.map(e => e.text.toLowerCase()),
    ...locations.map(e => e.text.toLowerCase()),
  ]);
  const concepts = extractConcepts(cleanText, alreadyCaptured);

  // Merge and deduplicate — prefer the first type found for a given surface form
  const allEntities = mergeEntities([...persons, ...organisations, ...locations, ...concepts]);

  // Sort by count DESC
  allEntities.sort((a, b) => b.count - a.count);

  // Detect coherence issues
  const coherenceIssues = detectCoherenceIssues(allEntities, cleanText);

  // Score
  const score = calculateEntityScore(allEntities, wordCount, coherenceIssues);

  // Compute type breakdown
  const entityTypes: Record<EntityType, number> = {
    PERSON: 0,
    ORGANISATION: 0,
    LOCATION: 0,
    CONCEPT: 0,
  };
  for (const entity of allEntities) {
    entityTypes[entity.type]++;
  }

  const properNounDensity = wordCount > 0
    ? Math.round((allEntities.reduce((sum, e) => sum + e.count, 0) / wordCount) * 1000) / 10
    : 0;

  return {
    entities: allEntities,
    entityCount: allEntities.reduce((sum, e) => sum + e.count, 0),
    uniqueEntityCount: allEntities.length,
    properNounDensity,
    entityTypes,
    coherenceIssues,
    score,
  };
}

// --- Private Helpers ---

function extractPersons(text: string): EntityMention[] {
  const mentions: Map<string, EntityMention> = new Map();
  const pattern = new RegExp(PERSON_PATTERN.source, PERSON_PATTERN.flags);
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const matchText = match[1];
    const matchIndex = match.index;

    // Filter out sentence-starting matches — check char immediately before match
    // If the match is at position 0 or immediately follows ". ", "! ", "? ", skip it
    if (matchIndex === 0) continue;

    const preceding = text.slice(Math.max(0, matchIndex - 3), matchIndex);
    if (SENTENCE_END_PATTERN.test(preceding)) continue;

    // Filter out very common false-positive two-word capitalisations (e.g. heading words)
    // A simple heuristic: skip if immediately preceded by a newline or "#"
    const charBefore = text[matchIndex - 1] || '';
    if (charBefore === '\n' || charBefore === '#') continue;

    // Skip location seeds to avoid double-counting
    if (LOCATION_SEEDS.has(matchText)) continue;

    const key = matchText.toLowerCase();
    if (mentions.has(key)) {
      const existing = mentions.get(key)!;
      existing.count++;
      if (!existing.variants.includes(matchText)) {
        existing.variants.push(matchText);
      }
    } else {
      mentions.set(key, {
        text: matchText,
        type: 'PERSON',
        count: 1,
        firstIndex: matchIndex,
        variants: [matchText],
      });
    }
  }

  // Only return persons found 1+ times (single occurrence is fine for PERSON)
  return Array.from(mentions.values());
}

function extractOrganisations(text: string): EntityMention[] {
  const mentions: Map<string, EntityMention> = new Map();

  // Pattern 1: Word(s) immediately preceding a known org suffix
  const orgWithSuffix = /\b([A-Z][A-Za-z]*(?: [A-Z][A-Za-z]*)*)\s+(Inc|Ltd|LLC|Corp|Corporation|Foundation|Institute|University|Association|Agency|Group|Holdings|Technologies|Solutions|Services|Systems|Labs|Studio|Studios|Media|Partners|Ventures|Capital|Fund)\b/g;
  let match: RegExpExecArray | null;

  while ((match = orgWithSuffix.exec(text)) !== null) {
    const fullName = `${match[1]} ${match[2]}`;
    const baseName = match[1];
    const matchIndex = match.index;

    // Register full name
    addOrUpdateMention(mentions, fullName, 'ORGANISATION', matchIndex);

    // Also check if base name exists as a variant
    const baseKey = baseName.toLowerCase();
    if (mentions.has(baseKey)) {
      const existing = mentions.get(baseKey)!;
      if (!existing.variants.includes(fullName)) {
        existing.variants.push(fullName);
      }
    }
  }

  // Pattern 2: Acronyms (3+ uppercase letters)
  const acronymPat = new RegExp(ACRONYM_PATTERN.source, ACRONYM_PATTERN.flags);
  while ((match = acronymPat.exec(text)) !== null) {
    const acronym = match[0];
    // Skip pure-number acronyms and very generic ones
    if (/^\d+$/.test(acronym)) continue;
    if (['USA', 'UK', 'CEO', 'CFO', 'COO', 'CTO', 'API', 'URL', 'SEO', 'GEO', 'FAQ', 'HTML', 'CSS', 'SQL', 'PHP', 'PDF', 'JSON', 'XML', 'RSS', 'CRM', 'ERP'].includes(acronym)) {
      // Still capture well-known industry acronyms but flag as ORGANISATION only if context supports it
      // Skip generic tech acronyms that aren't org names
      if (!['NASA', 'WHO', 'UNESCO', 'UNICEF', 'NATO', 'OPEC', 'ASEAN', 'OECD'].includes(acronym)) continue;
    }
    addOrUpdateMention(mentions, acronym, 'ORGANISATION', match.index);
  }

  // Pattern 3: Location seeds that are tech companies
  const techCompanies = ['Google', 'Microsoft', 'Apple', 'Meta', 'Amazon', 'OpenAI', 'Anthropic',
    'Tesla', 'Netflix', 'Spotify', 'Uber', 'Airbnb', 'Twitter', 'LinkedIn',
    'Salesforce', 'Oracle', 'SAP', 'IBM', 'Intel', 'NVIDIA', 'Adobe'];

  for (const company of techCompanies) {
    const companyPat = new RegExp(`\\b${escapeRegex(company)}\\b`, 'g');
    while ((match = companyPat.exec(text)) !== null) {
      addOrUpdateMention(mentions, company, 'ORGANISATION', match.index);
    }
  }

  // Only keep orgs that appear at least once (they're named, so count = 1 is fine)
  return Array.from(mentions.values());
}

function extractLocations(text: string): EntityMention[] {
  const mentions: Map<string, EntityMention> = new Map();

  // Check against location seeds (countries and cities only — exclude tech companies)
  const locationOnlySeeds = new Set([
    'Australia', 'United States', 'United Kingdom', 'Canada', 'Germany', 'France',
    'Japan', 'China', 'India', 'Brazil', 'Italy', 'Spain', 'Mexico', 'Russia',
    'South Korea', 'Netherlands', 'Sweden', 'Norway', 'Denmark', 'Finland',
    'Switzerland', 'Austria', 'Belgium', 'Portugal', 'Poland', 'Argentina',
    'Chile', 'Colombia', 'Singapore', 'New Zealand', 'Ireland', 'Israel',
    'UAE', 'Saudi Arabia', 'Indonesia', 'Thailand', 'Vietnam', 'Philippines',
    'Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'London', 'New York',
    'San Francisco', 'Los Angeles', 'Chicago', 'Seattle', 'Boston', 'Austin',
    'Tokyo', 'Beijing', 'Shanghai', 'Berlin', 'Paris', 'Toronto', 'Vancouver',
    'Dubai', 'Amsterdam', 'Dublin', 'Zurich', 'Stockholm',
    'Mumbai', 'Bangalore', 'Seoul', 'Hong Kong', 'Taipei', 'Bangkok',
  ]);

  for (const location of locationOnlySeeds) {
    const locationPat = new RegExp(`\\b${escapeRegex(location)}\\b`, 'g');
    let match: RegExpExecArray | null;
    while ((match = locationPat.exec(text)) !== null) {
      addOrUpdateMention(mentions, location, 'LOCATION', match.index);
    }
  }

  // Also detect "in [Capitalised]" and "at [Capitalised]" patterns for unknown locations
  const contextLocationPat = /\b(?:in|at|from|near|to)\s+([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\b/g;
  let match: RegExpExecArray | null;
  while ((match = contextLocationPat.exec(text)) !== null) {
    const locationName = match[1];
    // Skip if already captured as person or org, or if it's too generic
    if (locationName.split(' ').length > 3) continue;
    // Only add if not already in location seeds (avoid double-counting)
    if (!locationOnlySeeds.has(locationName)) {
      addOrUpdateMention(mentions, locationName, 'LOCATION', match.index);
    }
  }

  return Array.from(mentions.values());
}

function extractConcepts(text: string, alreadyCaptured: Set<string>): EntityMention[] {
  const mentions: Map<string, EntityMention> = new Map();

  // Find all capitalised single nouns that aren't at sentence boundaries
  // Match capitalised words that are not the first word of a sentence
  const conceptPat = /(?<![.!?\n])\s([A-Z][a-z]{2,})\b/g;
  let match: RegExpExecArray | null;

  while ((match = conceptPat.exec(text)) !== null) {
    const word = match[1];
    const key = word.toLowerCase();

    // Skip if already captured as another entity type
    if (alreadyCaptured.has(key)) continue;

    // Skip common English words that happen to be capitalised in context
    if (COMMON_WORDS.has(key)) continue;

    if (mentions.has(key)) {
      mentions.get(key)!.count++;
    } else {
      mentions.set(key, {
        text: word,
        type: 'CONCEPT',
        count: 1,
        firstIndex: match.index + 1, // +1 to skip the whitespace
        variants: [word],
      });
    }
  }

  // Only return concepts that appear 2+ times (single-occurrence capitalised words are likely noise)
  return Array.from(mentions.values()).filter(e => e.count >= 2);
}

function detectCoherenceIssues(entities: EntityMention[], text: string): string[] {
  const issues: string[] = [];

  // Issue 1: Entities with 2+ different variant forms (inconsistent naming)
  for (const entity of entities) {
    if (entity.variants.length >= 2) {
      issues.push(
        `Entity '${entity.text}' appears in ${entity.variants.length} variant forms (${entity.variants.slice(0, 3).join(', ')}) — use a consistent name throughout`
      );
    }
  }

  // Issue 2: Ambiguous pronouns near organisation mentions
  const orgEntities = entities.filter(e => e.type === 'ORGANISATION');
  for (const org of orgEntities.slice(0, 10)) { // Check top 10 orgs for performance
    const orgPat = new RegExp(`\\b${escapeRegex(org.text)}\\b`, 'gi');
    let orgMatch: RegExpExecArray | null;

    while ((orgMatch = orgPat.exec(text)) !== null) {
      const surroundingText = text.slice(orgMatch.index, orgMatch.index + 200);
      if (AMBIGUOUS_ORG_REFS.test(surroundingText)) {
        // Reset lastIndex on the global regex after test()
        AMBIGUOUS_ORG_REFS.lastIndex = 0;
        issues.push(
          `Organisation '${org.text}' followed by ambiguous pronoun (e.g., 'it', 'they', 'the company') — AI engines may lose entity context`
        );
        break; // Only report once per entity
      }
      AMBIGUOUS_ORG_REFS.lastIndex = 0;
    }
  }

  return issues;
}

function calculateEntityScore(entities: EntityMention[], wordCount: number, issues: string[]): number {
  // Density component (0-50): target is 15+ unique entities
  const densityScore = Math.min(entities.length / 15, 1) * 50;

  // Diversity component (0-25): variety of entity types
  const uniqueTypes = new Set(entities.map(e => e.type)).size;
  const diversityScore = Math.min(uniqueTypes / 3, 1) * 25;

  // Consistency component (0-25): penalise naming issues
  const consistencyScore = Math.max(0, 1 - issues.length * 0.15) * 25;

  return Math.round(densityScore + diversityScore + consistencyScore);
}

// --- Utilities ---

function addOrUpdateMention(
  mentions: Map<string, EntityMention>,
  text: string,
  type: EntityType,
  index: number
): void {
  const key = text.toLowerCase();
  if (mentions.has(key)) {
    const existing = mentions.get(key)!;
    existing.count++;
    if (!existing.variants.includes(text)) {
      existing.variants.push(text);
    }
  } else {
    mentions.set(key, {
      text,
      type,
      count: 1,
      firstIndex: index,
      variants: [text],
    });
  }
}

function mergeEntities(entities: EntityMention[]): EntityMention[] {
  const merged: Map<string, EntityMention> = new Map();

  for (const entity of entities) {
    const key = entity.text.toLowerCase();
    if (merged.has(key)) {
      const existing = merged.get(key)!;
      existing.count += entity.count;
      for (const variant of entity.variants) {
        if (!existing.variants.includes(variant)) {
          existing.variants.push(variant);
        }
      }
    } else {
      merged.set(key, { ...entity, variants: [...entity.variants] });
    }
  }

  return Array.from(merged.values());
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Common English words that appear capitalised mid-sentence (false positive concepts)
const COMMON_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'not', 'no', 'yes',
  'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their',
  'we', 'our', 'you', 'your', 'he', 'she', 'his', 'her', 'who', 'which',
  'what', 'when', 'where', 'why', 'how', 'all', 'any', 'each', 'every',
  'both', 'few', 'more', 'most', 'other', 'some', 'such', 'than', 'too',
  'very', 'just', 'also', 'only', 'even', 'now', 'then', 'here', 'there',
  'so', 'yet', 'nor', 'whether', 'while', 'after', 'before', 'since',
  'as', 'if', 'although', 'though', 'because', 'unless', 'until', 'while',
  'however', 'therefore', 'thus', 'hence', 'moreover', 'furthermore',
  'january', 'february', 'march', 'april', 'june', 'july', 'august',
  'september', 'october', 'november', 'december', 'monday', 'tuesday',
  'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'new', 'first', 'last', 'next', 'many', 'second', 'third', 'one', 'two',
  'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
]);
