/**
 * Prompt Generator (Phase 96)
 *
 * Generates natural language AI prompt templates from entity context.
 * Pure TypeScript — no external API calls needed.
 *
 * Produces 20–30 prompts across all 6 categories covering:
 * - brand-awareness
 * - competitor-comparison
 * - local-discovery
 * - use-case
 * - how-to
 * - product-feature
 *
 * @module lib/prompts/prompt-generator
 */

import type { PromptCategory, PromptTemplate } from './types';

// ─── Template Definitions ────────────────────────────────────────────────────

interface RawTemplate {
  category: PromptCategory
  template: string  // uses {entityName}, {entityType}, {topic}, {location} placeholders
  variables: string[]
}

const RAW_TEMPLATES: RawTemplate[] = [
  // Brand Awareness
  { category: 'brand-awareness', template: 'What is {entityName}?', variables: ['entityName'] },
  { category: 'brand-awareness', template: 'Tell me about {entityName}', variables: ['entityName'] },
  { category: 'brand-awareness', template: 'Is {entityName} a good {entityType}?', variables: ['entityName', 'entityType'] },
  { category: 'brand-awareness', template: 'Who is behind {entityName}?', variables: ['entityName'] },
  { category: 'brand-awareness', template: 'What does {entityName} do?', variables: ['entityName'] },
  { category: 'brand-awareness', template: 'Can you explain {entityName} to me?', variables: ['entityName'] },

  // Competitor Comparison
  { category: 'competitor-comparison', template: 'What are alternatives to {entityName}?', variables: ['entityName'] },
  { category: 'competitor-comparison', template: '{entityName} vs competitors — which is better?', variables: ['entityName'] },
  { category: 'competitor-comparison', template: 'Best {topic} tools in {topic} — top recommendations', variables: ['topic'] },
  { category: 'competitor-comparison', template: 'Which {entityType} is better than {entityName}?', variables: ['entityType', 'entityName'] },
  { category: 'competitor-comparison', template: 'Top {topic} {entityType}s compared', variables: ['topic', 'entityType'] },

  // Local Discovery
  { category: 'local-discovery', template: 'Best {topic} services in {location}', variables: ['topic', 'location'] },
  { category: 'local-discovery', template: 'Who provides {topic} in {location}?', variables: ['topic', 'location'] },
  { category: 'local-discovery', template: 'Top {entityType}s for {topic} near {location}', variables: ['entityType', 'topic', 'location'] },
  { category: 'local-discovery', template: 'Recommended {topic} {entityType} in {location}', variables: ['topic', 'entityType', 'location'] },
  { category: 'local-discovery', template: 'Where can I find {topic} help in {location}?', variables: ['topic', 'location'] },

  // Use Case
  { category: 'use-case', template: 'What tool should I use for {topic}?', variables: ['topic'] },
  { category: 'use-case', template: 'How do I solve {topic} problems?', variables: ['topic'] },
  { category: 'use-case', template: 'Best software for {topic} management', variables: ['topic'] },
  { category: 'use-case', template: 'Which {entityType} helps with {topic}?', variables: ['entityType', 'topic'] },
  { category: 'use-case', template: 'I need help with {topic} — what should I use?', variables: ['topic'] },

  // How-To
  { category: 'how-to', template: 'How to get started with {topic}?', variables: ['topic'] },
  { category: 'how-to', template: 'Step by step guide for {topic}', variables: ['topic'] },
  { category: 'how-to', template: 'How to improve my {topic} strategy?', variables: ['topic'] },
  { category: 'how-to', template: 'Best practices for {topic} in {location}', variables: ['topic', 'location'] },
  { category: 'how-to', template: 'How do {entityType}s help with {topic}?', variables: ['entityType', 'topic'] },

  // Product Feature
  { category: 'product-feature', template: 'Does {entityName} have automation features?', variables: ['entityName'] },
  { category: 'product-feature', template: 'Can {entityName} help with {topic}?', variables: ['entityName', 'topic'] },
  { category: 'product-feature', template: 'What integrations does {entityName} support?', variables: ['entityName'] },
  { category: 'product-feature', template: 'Does {entityName} offer analytics?', variables: ['entityName'] },
  { category: 'product-feature', template: 'Is {entityName} suitable for small businesses?', variables: ['entityName'] },
];

// ─── Template Renderer ───────────────────────────────────────────────────────

function renderTemplate(
  template: string,
  vars: {
    entityName: string
    entityType: string
    topic: string
    location: string
  }
): string {
  return template
    .replace(/\{entityName\}/g, vars.entityName)
    .replace(/\{entityType\}/g, vars.entityType)
    .replace(/\{topic\}/g, vars.topic)
    .replace(/\{location\}/g, vars.location || 'Australia');
}

// ─── Main Generator ──────────────────────────────────────────────────────────

/**
 * Generate prompt templates for a given entity.
 *
 * @param entityName  - Brand/product name, e.g. "Synthex"
 * @param entityType  - Entity category: brand|product|service|person|location
 * @param topic       - Domain/industry, e.g. "marketing automation"
 * @param location    - Optional location context, e.g. "Sydney"
 * @returns Array of rendered PromptTemplates (20–30 items)
 */
export function generatePrompts(
  entityName: string,
  entityType: string,
  topic: string,
  location?: string
): PromptTemplate[] {
  const resolvedLocation = location || 'Australia';

  const vars = {
    entityName: entityName.trim(),
    entityType: entityType.trim(),
    topic: topic.trim(),
    location: resolvedLocation.trim(),
  };

  const templates: PromptTemplate[] = [];

  for (const raw of RAW_TEMPLATES) {
    // Skip location-dependent templates when no location provided and entity is not location-specific
    if (raw.variables.includes('location') && !location && entityType !== 'location') {
      // Still include but use "Australia" as default — already handled in vars
    }

    const text = renderTemplate(raw.template, vars);

    templates.push({
      category: raw.category,
      text,
      template: raw.template,
      variables: raw.variables,
    });
  }

  return templates;
}

/**
 * Filter templates by category.
 */
export function filterByCategory(
  templates: PromptTemplate[],
  category: PromptCategory
): PromptTemplate[] {
  return templates.filter((t) => t.category === category);
}
