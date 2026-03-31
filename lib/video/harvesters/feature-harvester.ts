/**
 * Feature Harvester — lib/video/harvesters/feature-harvester.ts
 *
 * Extracts CLIENT series video topics by crawling the dashboard route tree
 * and mapping each section to a benefit-focused tutorial topic.
 *
 * Two discovery modes:
 *  1. Route-tree scan   — reads app/dashboard/ to find all page.tsx files
 *  2. Workflow registry — enriches topics that have capture sequences defined
 *
 * Output feeds topic-seeder.ts → VideoTopicQueue (CLIENT series).
 *
 * @task SYN-577
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@/lib/logger';
import type { HarvestedTopic } from './board-memo-harvester';
import { ALL_WORKFLOWS } from '../playwright-capture-service';

// ── Dashboard route → benefit mapping ────────────────────────────────────────

/**
 * Hand-authored mapping of dashboard route segments to SMB-facing benefit language.
 * Used to enrich auto-discovered routes with meaningful titles and descriptions.
 */
const ROUTE_BENEFIT_MAP: Record<
  string,
  { title: string; description: string; priority: number; tags: string[] }
> = {
  analytics: {
    title: 'Your Numbers at a Glance — The Synthex Analytics Dashboard',
    description:
      'Walk through real engagement data across all platforms in one view. ' +
      'See which posts are driving traffic and why.',
    priority: 5,
    tags: ['analytics', 'reporting', 'roi'],
  },
  schedule: {
    title: 'Never Miss a Post — How the Content Calendar Works',
    description:
      'Show how Synthex auto-fills your weekly content calendar with AI-generated ' +
      "slots timed to your audience's peak activity windows.",
    priority: 8,
    tags: ['scheduling', 'content-calendar', 'automation'],
  },
  content: {
    title:
      'From Blank Page to Published — AI Content Creation in Under 60 Seconds',
    description:
      'Demonstrate the full path from content brief to multi-platform post, ' +
      'including tone matching, hashtag suggestions, and one-click publishing.',
    priority: 3,
    tags: ['content-creation', 'ai', 'publishing'],
  },
  campaigns: {
    title: 'Run a Marketing Campaign Without a Marketing Team',
    description:
      'Create and manage a content campaign from scratch — budget, schedule, ' +
      'platform selection, and performance tracking all in one place.',
    priority: 10,
    tags: ['campaigns', 'marketing', 'automation'],
  },
  brand: {
    title: 'Your Brand Voice on Autopilot — Brand DNA Configuration',
    description:
      "Set up your brand's tone, language, and style once. Every AI-generated " +
      'post then matches your voice without manual editing.',
    priority: 12,
    tags: ['brand-dna', 'voice', 'consistency'],
  },
  'ai-chat': {
    title: 'Ask Synthex Anything — Your Always-On Marketing Advisor',
    description:
      'Use the AI chat assistant to get instant answers about your content performance, ' +
      'campaign ideas, or competitor analysis.',
    priority: 15,
    tags: ['ai-chat', 'advisor', 'support'],
  },
  personas: {
    title: 'Who Are You Talking To? Building Customer Personas in Synthex',
    description:
      'Create detailed buyer personas that inform every piece of content Synthex generates, ' +
      'keeping your messaging targeted and relevant.',
    priority: 20,
    tags: ['personas', 'targeting', 'strategy'],
  },
  seo: {
    title: 'Get Found on Google — Synthex SEO Audit and Optimisation',
    description:
      'Run a live SEO audit, check your technical health score, and see ' +
      'actionable fixes ranked by impact.',
    priority: 18,
    tags: ['seo', 'organic', 'google'],
  },
  reports: {
    title: 'Reports Your Clients Actually Want to See',
    description:
      'Build, schedule, and auto-deliver performance reports branded to your business. ' +
      'White-label ready.',
    priority: 22,
    tags: ['reporting', 'client-reports', 'white-label'],
  },
  audience: {
    title: 'Understanding Your Audience — Data-Driven Targeting',
    description:
      'See a demographic breakdown of who is engaging with your content ' +
      'and use it to refine your posting strategy.',
    priority: 25,
    tags: ['audience', 'demographics', 'targeting'],
  },
  integrations: {
    title: 'Connect Everything — Synthex Platform Integrations',
    description:
      'Link your social accounts, Google Analytics, and CRM in minutes. ' +
      'All your data flows into one dashboard.',
    priority: 28,
    tags: ['integrations', 'setup', 'connections'],
  },
  billing: {
    title: 'Transparent Pricing — What You Get With Each Synthex Plan',
    description:
      'Walk through the subscription tiers, feature gates, and what each plan ' +
      'delivers for different business sizes.',
    priority: 90,
    tags: ['billing', 'pricing', 'plans'],
  },
  roi: {
    title: 'Proving the Value — ROI Tracking for Your Marketing Spend',
    description:
      'Show how Synthex tracks return on investment per campaign, per post, ' +
      'and across platforms — with real numbers.',
    priority: 7,
    tags: ['roi', 'value', 'reporting'],
  },
  geo: {
    title: 'Rank in AI Search — GEO (Generative Engine Optimisation) Dashboard',
    description:
      'Understand your visibility in ChatGPT, Perplexity, and Google AI Overviews. ' +
      'See which tactics to apply for better AI search presence.',
    priority: 35,
    tags: ['geo', 'ai-search', 'seo'],
  },
  'ai-images': {
    title: 'Never Pay for Stock Photos Again — AI Image Generation in Synthex',
    description:
      'Generate on-brand visuals for every post in seconds. No design skills required.',
    priority: 40,
    tags: ['ai-images', 'visuals', 'design'],
  },
  research: {
    title: 'Know Before You Post — Market Research Built Into Your Workflow',
    description:
      'Run competitor analysis and trend research without leaving Synthex. ' +
      'Find gaps your content can fill.',
    priority: 45,
    tags: ['research', 'competitor-analysis', 'strategy'],
  },
  video: {
    title: 'Video Content Made Simple — Synthex Video Studio',
    description:
      'Create, edit, and publish short-form videos directly from your content brief. ' +
      'No video editing experience needed.',
    priority: 50,
    tags: ['video', 'short-form', 'content'],
  },
};

// ── Route tree scanner ────────────────────────────────────────────────────────

interface DiscoveredRoute {
  routePath: string; // e.g. /dashboard/analytics
  segment: string; // e.g. analytics
  filePath: string; // absolute path to page.tsx
}

function scanDashboardRoutes(repoRoot: string): DiscoveredRoute[] {
  const dashboardDir = path.join(repoRoot, 'app', 'dashboard');
  if (!fs.existsSync(dashboardDir)) {
    logger.warn('FeatureHarvester: app/dashboard not found', { dashboardDir });
    return [];
  }

  const routes: DiscoveredRoute[] = [];
  const pageFiles = walkForPageFiles(dashboardDir);

  for (const filePath of pageFiles) {
    // Convert file path to route path
    const relative = path.relative(dashboardDir, filePath).replace(/\\/g, '/');
    // Strip trailing /page.tsx
    const routeSuffix = relative
      .replace(/\/page\.tsx$/, '')
      .replace(/^page\.tsx$/, '');
    const routePath = `/dashboard${routeSuffix ? `/${routeSuffix}` : ''}`;

    // Get top-level segment (first path component after /dashboard/)
    const parts = routeSuffix.split('/').filter(Boolean);
    const segment = parts[0] ?? 'overview';

    // Skip dynamic routes ([id], [slug]) and deeply nested routes
    if (segment.startsWith('[') || parts.length > 2) continue;

    routes.push({ routePath, segment, filePath });
  }

  return routes;
}

function walkForPageFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip special Next.js directories
      if (!entry.name.startsWith('_') && !entry.name.startsWith('.')) {
        results.push(...walkForPageFiles(full));
      }
    } else if (entry.name === 'page.tsx') {
      results.push(full);
    }
  }
  return results;
}

// ── Map routes to topics ──────────────────────────────────────────────────────

function routeToTopic(
  route: DiscoveredRoute,
  repoRoot: string,
  workflowKeys: Set<string>
): HarvestedTopic | null {
  const benefit = ROUTE_BENEFIT_MAP[route.segment];
  if (!benefit) {
    // Unknown segment — generate a fallback topic with lower priority
    const humanName = route.segment
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());

    return {
      title: `Synthex ${humanName} — What It Does and Why It Matters`,
      description: `Feature walkthrough of the ${humanName} section, showing real data and SMB use cases.`,
      sourceType: 'board-memo', // closest match; client-facing demo
      sourceRef: route.routePath,
      priority: 70,
      tags: ['client', 'feature-demo', route.segment],
    };
  }

  // Check if a capture workflow exists for this route
  const hasWorkflow =
    workflowKeys.has(route.segment) ||
    Object.values(ALL_WORKFLOWS).some(wf =>
      wf.steps.some(s => s.target?.includes(route.segment))
    );

  const relPath = path.relative(repoRoot, route.filePath).replace(/\\/g, '/');

  return {
    title: benefit.title,
    description: benefit.description,
    sourceType: 'board-memo' as const, // reuse type; client-facing
    sourceRef: route.routePath,
    priority: hasWorkflow
      ? Math.max(1, benefit.priority - 5)
      : benefit.priority,
    tags: [
      'client',
      'smb-benefit',
      ...(hasWorkflow ? ['has-workflow'] : []),
      ...benefit.tags,
    ],
    rawContent: `Route: ${route.routePath}\nFile: ${relPath}\nHas capture workflow: ${hasWorkflow}`,
  };
}

// ── Workflow-based topics ─────────────────────────────────────────────────────

/**
 * Create a topic for each capture workflow that doesn't already have a
 * matching dashboard route (avoids duplication).
 */
function workflowTopics(existingSourceRefs: Set<string>): HarvestedTopic[] {
  const topics: HarvestedTopic[] = [];

  for (const [key, workflow] of Object.entries(ALL_WORKFLOWS)) {
    // Skip BTS/legacy workflows (they appear in SYNTHEX_WORKFLOWS via capture-service)
    if (existingSourceRefs.has(key)) continue;

    // Check if this workflow already maps to a known route
    const routeRef =
      workflow.steps.find(s => s.action === 'navigate')?.target ?? `/${key}`;
    if (existingSourceRefs.has(routeRef)) continue;

    topics.push({
      title: `${workflow.name} — Step-by-Step Walkthrough`,
      description: workflow.description,
      sourceType: 'board-memo' as const,
      sourceRef: `workflow:${key}`,
      priority: 50,
      tags: ['client', 'walkthrough', 'has-workflow', key],
      rawContent: `Workflow: ${workflow.name}\nDuration: ${workflow.duration}s\nSteps: ${workflow.steps.length}`,
    });
  }

  return topics;
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface FeatureHarvestResult {
  topics: HarvestedTopic[];
  sources: {
    routePages: number;
    workflowsOnly: number;
  };
}

/**
 * Harvest all CLIENT series source material from the dashboard route tree
 * and the capture workflow registry.
 *
 * @param repoRoot  Absolute path to the repository root (default: process.cwd())
 */
export async function harvestDashboardFeatures(
  repoRoot: string = process.cwd()
): Promise<FeatureHarvestResult> {
  logger.info('FeatureHarvester: starting harvest', { repoRoot });

  const workflowKeys = new Set(Object.keys(ALL_WORKFLOWS));
  const routes = scanDashboardRoutes(repoRoot);
  const existingRefs = new Set<string>();
  const topics: HarvestedTopic[] = [];

  // Convert discovered routes to topics
  for (const route of routes) {
    const topic = routeToTopic(route, repoRoot, workflowKeys);
    if (topic) {
      topics.push(topic);
      existingRefs.add(route.routePath);
      existingRefs.add(route.segment);
    }
  }

  // Add workflow-specific topics not already covered by route discovery
  const wfTopics = workflowTopics(existingRefs);
  topics.push(...wfTopics);

  // Deduplicate by sourceRef
  const seen = new Set<string>();
  const unique = topics.filter(t => {
    if (seen.has(t.sourceRef)) return false;
    seen.add(t.sourceRef);
    return true;
  });

  logger.info('FeatureHarvester: harvest complete', {
    routePages: routes.length,
    workflowsOnly: wfTopics.length,
    totalTopics: unique.length,
  });

  return {
    topics: unique,
    sources: {
      routePages: routes.length,
      workflowsOnly: wfTopics.length,
    },
  };
}
