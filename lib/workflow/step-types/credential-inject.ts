/**
 * Credential-Inject Step — Vault Integration for Workflow Engine
 *
 * Fetches secrets from the vault by slug list and injects them into
 * the workflow context's `credentials` channel.
 *
 * SECURITY:
 *   - Credentials are NEVER included in priorOutputs (prevents AI prompt leakage)
 *   - Actor tracking: actorId = "workflow:<executionId>"
 *   - Every access is logged in VaultAccessLog
 *   - Returns slug count only in output (no values)
 */

import type { WorkflowStepDefinition, StepContext, StepResult } from '../types'
import { VaultService } from '@/lib/vault'
import type { VaultActor } from '@/lib/vault'
import { logger } from '@/lib/logger'

interface CredentialInjectConfig {
  /** Vault slugs to fetch (e.g., ["openrouter-api-key", "twitter-oauth-token"]) */
  slugs: string[]
  /** Workflow execution ID for audit trail */
  executionId?: string
}

export async function execute(
  stepDef: WorkflowStepDefinition,
  context: StepContext
): Promise<StepResult> {
  try {
    const config = stepDef.config as CredentialInjectConfig | undefined

    if (!config?.slugs || config.slugs.length === 0) {
      return {
        success: false,
        error: 'credential-inject: no slugs specified in step config',
        terminal: true,
      }
    }

    if (!context.organizationId) {
      return {
        success: false,
        error: 'credential-inject: organizationId missing from context',
        terminal: true,
      }
    }

    const actor: VaultActor = {
      id: `workflow:${config.executionId ?? 'unknown'}`,
      type: 'workflow',
    }

    const credentials: Record<string, string> = {}
    const failures: string[] = []

    for (const slug of config.slugs) {
      try {
        const value = await VaultService.getSecret(
          context.organizationId,
          slug,
          actor
        )

        if (value !== null) {
          credentials[slug] = value
        } else {
          failures.push(slug)
          logger.warn('credential-inject: secret not found or inactive', {
            slug,
            orgId: context.organizationId,
          })
        }
      } catch (err) {
        failures.push(slug)
        logger.error('credential-inject: failed to decrypt secret', {
          slug,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    // Inject into context credentials channel (caller must thread this)
    if (context.credentials) {
      Object.assign(context.credentials, credentials)
    } else {
      context.credentials = credentials
    }

    // Return metadata only — NEVER return actual credential values in output
    return {
      success: true,
      output: {
        injected: Object.keys(credentials).length,
        failed: failures,
        slugsRequested: config.slugs.length,
      },
      confidenceScore: 1.0, // Deterministic step
    }
  } catch (err) {
    logger.error('credential-inject step failed', {
      error: err,
      stepName: stepDef.name,
    })
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Credential injection failed',
      terminal: false,
    }
  }
}
