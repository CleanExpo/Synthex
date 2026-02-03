/**
 * Persona Training API Route
 *
 * @description Train a persona with writing samples:
 * - POST: Start training with provided sources
 * - GET: Check training status/progress
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { PersonaTrainingPipeline, TrainingSource } from '@/src/services/ai/persona-training-pipeline';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const trainingSourceSchema = z.object({
  type: z.enum(['text', 'social_post', 'document', 'website', 'conversation']),
  content: z.string().min(50, 'Content must be at least 50 characters'),
  metadata: z.object({
    platform: z.string().optional(),
    engagement: z.number().optional(),
    date: z.string().optional(),
    url: z.string().optional(),
  }).optional(),
});

const trainRequestSchema = z.object({
  sources: z.array(trainingSourceSchema).min(1, 'At least one training source required'),
});

// ============================================================================
// Training state storage (in-memory for now, could use Redis)
// ============================================================================

const trainingJobs = new Map<string, {
  pipeline: PersonaTrainingPipeline;
  startedAt: Date;
  status: 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
}>();

// ============================================================================
// POST /api/personas/[id]/train
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: personaId } = await params;

    // Security check
    const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_WRITE);

    if (!security.allowed || !security.context.userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = security.context.userId;

    // Verify persona exists and belongs to user
    const persona = await prisma.persona.findFirst({
      where: { id: personaId, userId },
    });

    if (!persona) {
      return NextResponse.json(
        { error: 'Persona not found' },
        { status: 404 }
      );
    }

    // Check if already training
    if (persona.status === 'training') {
      return NextResponse.json(
        { error: 'Persona is already being trained' },
        { status: 409 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = trainRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { sources } = validation.data;

    // Create training sources with IDs
    const trainingSources: TrainingSource[] = sources.map((s, i) => ({
      id: `source-${i}`,
      ...s,
    }));

    // Create training pipeline
    const pipeline = new PersonaTrainingPipeline((progress) => {
      // Update job state on progress
      const job = trainingJobs.get(personaId);
      if (job) {
        job.pipeline = pipeline;
      }
    });

    // Store job
    trainingJobs.set(personaId, {
      pipeline,
      startedAt: new Date(),
      status: 'running',
    });

    // Start training asynchronously
    pipeline.train(personaId, trainingSources)
      .then((result) => {
        const job = trainingJobs.get(personaId);
        if (job) {
          job.status = 'completed';
          job.result = result;
        }
      })
      .catch((error) => {
        const job = trainingJobs.get(personaId);
        if (job) {
          job.status = 'failed';
          job.error = error.message;
        }
      });

    return NextResponse.json({
      success: true,
      message: 'Training started',
      personaId,
      sourcesCount: sources.length,
    });
  } catch (error) {
    console.error('Training start error:', error);
    return NextResponse.json(
      { error: 'Failed to start training' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET /api/personas/[id]/train (Check status)
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: personaId } = await params;

    // Security check
    const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_READ);

    if (!security.allowed || !security.context.userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = security.context.userId;

    // Verify persona exists and belongs to user
    const persona = await prisma.persona.findFirst({
      where: { id: personaId, userId },
    });

    if (!persona) {
      return NextResponse.json(
        { error: 'Persona not found' },
        { status: 404 }
      );
    }

    // Check for active training job
    const job = trainingJobs.get(personaId);

    if (!job) {
      // No active job - return persona training stats
      return NextResponse.json({
        status: 'idle',
        persona: {
          id: persona.id,
          name: persona.name,
          status: persona.status,
          lastTrained: persona.lastTrained,
          trainingStats: {
            sourcesCount: persona.trainingSourcesCount,
            wordsCount: persona.trainingWordsCount,
            samplesCount: persona.trainingSamplesCount,
            accuracy: persona.accuracy,
          },
        },
      });
    }

    // Return active job progress
    const progress = job.pipeline.getProgress();

    return NextResponse.json({
      status: job.status,
      progress: {
        phase: progress.phase,
        percent: progress.progress,
        sourcesProcessed: progress.sourcesProcessed,
        totalSources: progress.totalSources,
        currentStep: progress.currentStep,
        errors: progress.errors,
        startedAt: job.startedAt,
      },
      result: job.status === 'completed' ? job.result : undefined,
      error: job.status === 'failed' ? job.error : undefined,
    });
  } catch (error) {
    console.error('Training status error:', error);
    return NextResponse.json(
      { error: 'Failed to get training status' },
      { status: 500 }
    );
  }
}

// Cleanup completed jobs periodically (after 1 hour)
setInterval(() => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  for (const [personaId, job] of trainingJobs.entries()) {
    if (job.status !== 'running' && job.startedAt < oneHourAgo) {
      trainingJobs.delete(personaId);
    }
  }
}, 15 * 60 * 1000); // Run every 15 minutes

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
