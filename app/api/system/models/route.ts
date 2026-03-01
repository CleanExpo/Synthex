/**
 * GET /api/system/models - Get current model registry status
 * POST /api/system/models/refresh - Force refresh models from registry
 * 
 * Admin endpoint for monitoring and managing LLM model selection
 */

import { NextRequest, NextResponse } from 'next/server';
import { modelManager, getLatestModelForProvider } from '@/lib/ai/model-manager';
import { getAllLatestModels } from '@/lib/ai/model-registry';
import { getAuthUser } from '@/lib/supabase-server';
import { isOwnerEmail } from '@/lib/auth/jwt-utils';

/**
 * GET - Return current model registry status
 */
export async function GET(request: NextRequest) {
  try {
    // Get current user (for audit logging)
    const user = await getAuthUser();

    // Get health report
    const healthReport = modelManager.getHealthReport();

    // Get all latest models
    const latestModels = getAllLatestModels();

    return NextResponse.json(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
        user: user?.id || 'anonymous',
        models: {
          openai: {
            model: latestModels.openai.id,
            name: latestModels.openai.name,
            tier: latestModels.openai.tier,
            releaseDate: latestModels.openai.releaseDate,
            capabilities: latestModels.openai.capabilities,
            contextWindow: latestModels.openai.contextWindow,
          },
          anthropic: {
            model: latestModels.anthropic.id,
            name: latestModels.anthropic.name,
            tier: latestModels.anthropic.tier,
            releaseDate: latestModels.anthropic.releaseDate,
            capabilities: latestModels.anthropic.capabilities,
            contextWindow: latestModels.anthropic.contextWindow,
          },
          google: {
            model: latestModels.google.id,
            name: latestModels.google.name,
            tier: latestModels.google.tier,
            releaseDate: latestModels.google.releaseDate,
            capabilities: latestModels.google.capabilities,
            contextWindow: latestModels.google.contextWindow,
          },
          openrouter: {
            model: latestModels.openrouter.id,
            name: latestModels.openrouter.name,
            tier: latestModels.openrouter.tier,
            releaseDate: latestModels.openrouter.releaseDate,
            capabilities: latestModels.openrouter.capabilities,
            contextWindow: latestModels.openrouter.contextWindow,
          },
        },
        health: healthReport,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Model API] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch model registry' },
      { status: 500 }
    );
  }
}

/**
 * POST - Force refresh models from registry
 * Requires admin authentication
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin role check — only platform owners can refresh models
    if (!isOwnerEmail(user.email)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Owner access required' },
        { status: 403 }
      );
    }

    // Force update
    modelManager.forceUpdate();

    // Get updated status
    const latestModels = getAllLatestModels();

    return NextResponse.json(
      {
        success: true,
        message: 'Models refreshed from registry',
        timestamp: new Date().toISOString(),
        models: {
          openai: latestModels.openai.id,
          anthropic: latestModels.anthropic.id,
          google: latestModels.google.id,
          openrouter: latestModels.openrouter.id,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Model API] POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh models' },
      { status: 500 }
    );
  }
}
