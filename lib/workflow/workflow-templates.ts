/**
 * Standard content-campaign workflow template — UNI-1650
 *
 * Implements the Planner→Generator→Evaluator harness pattern from:
 * https://www.anthropic.com/engineering/harness-design-long-running-apps
 *
 * Step flow:
 *   0  credential-inject  — decrypt org API keys into context (secure channel)
 *   1  ai-plan            — Planner: expand goal → ContentBrief
 *   2  ai                 — Generator: ContentBrief → GeneratedContent
 *   3  ai-evaluate        — Evaluator: score content against brief (4-axis)
 *   4  approval           — Human gate if evaluator score < 0.85
 *   5  action (publish)   — Publish to platform
 *
 * Usage:
 *   import { contentCampaignWorkflow } from '@/lib/workflow/templates/content-campaign'
 *   const def = contentCampaignWorkflow({ autoPublish: false })
 *   // Pass def to WorkflowExecution.create()
 */

import type { WorkflowDefinition } from './types';

export interface ContentCampaignOptions {
  /**
   * If true, skip the human-approval gate and auto-publish when evaluator
   * score >= autoApproveThreshold. Defaults to false (always gate).
   */
  autoPublish?: boolean;
  /**
   * Confidence threshold for auto-approval (0.0–1.0).
   * Defaults to 0.85 (= evaluator score of 85+).
   */
  autoApproveThreshold?: number;
}

export function contentCampaignWorkflow(
  options: ContentCampaignOptions = {}
): WorkflowDefinition {
  const { autoPublish = false, autoApproveThreshold = 0.85 } = options;

  return {
    title: 'Content Campaign — Planner→Generator→Evaluator',
    autoApproveThreshold,
    steps: [
      // -----------------------------------------------------------------------
      // Step 0: Inject credentials securely (separate from AI prompt context)
      // -----------------------------------------------------------------------
      {
        name: 'Inject credentials',
        type: 'credential-inject',
        config: { vaultScope: 'ai' },
      },

      // -----------------------------------------------------------------------
      // Step 1: Planner — expand campaign goal into a structured ContentBrief
      // -----------------------------------------------------------------------
      {
        name: 'Plan content brief',
        type: 'ai-plan',
        // No promptTemplate needed — ai-plan reads workflowInput directly
      },

      // -----------------------------------------------------------------------
      // Step 2: Generator — produce content from the ContentBrief
      // -----------------------------------------------------------------------
      {
        name: 'Generate content',
        type: 'ai',
        promptTemplate: [
          'You are a professional content creator.',
          'Write content based on this brief:',
          '',
          '{{workflowInput}}',
          '',
          'The planner has prepared these details:',
          '{{priorOutputs}}',
          '',
          'Produce a single, polished piece of content ready for publishing.',
          'Do not add explanations or meta-commentary — output the content only.',
        ].join('\n'),
        config: {
          subType: undefined, // uses default ai-generate handler
        },
        // Generator runs at 60s — content generation can be slow
        autoApproveThreshold: 0.0, // never auto-approve generator — evaluator decides
      },

      // -----------------------------------------------------------------------
      // Step 3: Evaluator — score content against the brief (4-axis, skeptical)
      // -----------------------------------------------------------------------
      {
        name: 'Evaluate content quality',
        type: 'ai-evaluate',
        // Evaluator handles its own input resolution from priorOutputs
      },

      // -----------------------------------------------------------------------
      // Step 4: Human approval gate
      // Skipped when autoPublish=true AND evaluator score >= threshold
      // -----------------------------------------------------------------------
      {
        name: 'Human review',
        type: 'approval',
        config: {
          message:
            'Please review the generated content and evaluator feedback before publishing.',
          skipWhenAutoApproved: autoPublish,
        },
      },

      // -----------------------------------------------------------------------
      // Step 5: Publish
      // -----------------------------------------------------------------------
      {
        name: 'Publish to platform',
        type: 'action',
        actionType: 'publish',
      },
    ],
  };
}
