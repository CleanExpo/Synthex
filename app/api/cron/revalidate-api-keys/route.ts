/**
 * API Key Re-Validation Cron Job
 *
 * GET /api/cron/revalidate-api-keys
 * Runs daily at 4 AM UTC via Vercel Cron.
 * Re-validates all active API keys that haven't been validated in the last 24 hours.
 * Marks invalid keys so users are notified and can update them.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - CRON_SECRET: Vercel cron secret for authorization (SECRET)
 * - ENCRYPTION_KEY_V1: AES-256 encryption key for decrypting stored API keys (CRITICAL)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { decryptApiKey } from '@/lib/encryption/api-key-encryption';
import { validateAPIKey, type APIProvider } from '@/lib/encryption/api-key-validator';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

const REVALIDATION_INTERVAL_HOURS = 24;
const BATCH_SIZE = 10; // Process keys in batches to avoid rate limits
const BATCH_DELAY_MS = 2000; // 2-second delay between batches

/**
 * Sleep utility for rate-limiting between batches
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel passes this header for scheduled functions)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const startTime = Date.now();
    logger.info('cron:revalidate-api-keys:start', { timestamp: new Date().toISOString() });

    // Calculate the cutoff time (24 hours ago)
    const cutoffDate = new Date(Date.now() - REVALIDATION_INTERVAL_HOURS * 60 * 60 * 1000);

    // Find all active, non-revoked keys that need re-validation
    const credentials = await prisma.aPICredential.findMany({
      where: {
        isActive: true,
        revokedAt: null,
        OR: [
          { lastValidatedAt: null },
          { lastValidatedAt: { lt: cutoffDate } },
        ],
      },
      select: {
        id: true,
        provider: true,
        encryptedKey: true,
        userId: true,
        isValid: true,
      },
    });

    if (credentials.length === 0) {
      return NextResponse.json({
        success: true,
        total: 0,
        validated: 0,
        invalidated: 0,
        errors: 0,
        durationMs: Date.now() - startTime,
      });
    }

    let validated = 0;
    let invalidated = 0;
    let errors = 0;
    const unchanged = 0;

    // Process in batches to avoid hammering provider APIs
    for (let i = 0; i < credentials.length; i += BATCH_SIZE) {
      const batch = credentials.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (credential) => {
          try {
            // Decrypt the stored key
            const plainKey = decryptApiKey(credential.encryptedKey);

            // Validate against the provider
            const result = await validateAPIKey(
              credential.provider as APIProvider,
              plainKey
            );

            // Update the credential record
            await prisma.aPICredential.update({
              where: { id: credential.id },
              data: {
                isValid: result.isValid,
                lastValidatedAt: new Date(),
                validationError: result.isValid ? null : (result.error || 'Key validation failed'),
              },
            });

            return { id: credential.id, isValid: result.isValid, wasValid: credential.isValid };
          } catch (err) {
            logger.error(
              `[Revalidate API Keys] Error validating key ${credential.id}:`,
              err instanceof Error ? err.message : String(err)
            );

            // Mark validation attempt even on error to avoid re-trying broken keys every run
            await prisma.aPICredential.update({
              where: { id: credential.id },
              data: {
                lastValidatedAt: new Date(),
                validationError: `Validation error: ${err instanceof Error ? err.message : 'Unknown error'}`,
              },
            }).catch(() => {
              // If even the update fails, just log it
            });

            throw err;
          }
        })
      );

      // Tally results
      for (const result of results) {
        if (result.status === 'fulfilled') {
          if (result.value.isValid) {
            validated++;
          } else {
            invalidated++;
          }
        } else {
          errors++;
        }
      }

      // Delay between batches (skip after last batch)
      if (i + BATCH_SIZE < credentials.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    const duration = Date.now() - startTime;
    logger.info('cron:revalidate-api-keys:end', { timestamp: new Date().toISOString(), durationMs: duration, total: credentials.length, validated, invalidated, errors });

    return NextResponse.json({
      success: true,
      total: credentials.length,
      validated,
      invalidated,
      errors,
      durationMs: duration,
    });
  } catch (error) {
    logger.error('[Revalidate API Keys] Fatal error:', error);
    return NextResponse.json(
      { error: 'API key re-validation failed' },
      { status: 500 }
    );
  }
}
