/**
 * POST /api/onboarding/validate-key
 *
 * Validates an AI provider API key and, on success, marks the user's
 * apiKeyConfigured flag in the database.
 *
 * Request body:
 *   { provider: string, apiKey: string }
 *
 * Response:
 *   { valid: boolean, error?: string }
 *
 * Supported providers: openrouter, anthropic, google, gemini, openai
 *
 * Auth: JWT cookie (getUserIdFromRequestOrCookies)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { sanitizeErrorForResponse } from '@/lib/utils/error-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const ValidateKeySchema = z.object({
  provider: z.string().min(1, 'Provider is required'),
  apiKey: z.string().min(10, 'API key is too short'),
});

// ---------------------------------------------------------------------------
// Per-provider validation helpers
// ---------------------------------------------------------------------------

interface ProviderValidationResult {
  valid: boolean;
  error?: string;
}

async function validateOpenRouterKey(apiKey: string): Promise<ProviderValidationResult> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      return { valid: true };
    }

    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: 'Invalid API key' };
    }

    return {
      valid: false,
      error: `OpenRouter returned status ${response.status}`,
    };
  } catch (err) {
    return {
      valid: false,
      error: `Failed to reach OpenRouter: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function validateAnthropicKey(apiKey: string): Promise<ProviderValidationResult> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
      }),
    });

    // 200 = success, 400 = bad request but key was accepted (auth passed)
    // 401 = invalid key
    if (response.status === 200 || response.status === 400) {
      return { valid: true };
    }

    if (response.status === 401) {
      return { valid: false, error: 'Invalid API key' };
    }

    return {
      valid: false,
      error: `Anthropic returned status ${response.status}`,
    };
  } catch (err) {
    return {
      valid: false,
      error: `Failed to reach Anthropic: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function validateGoogleKey(apiKey: string): Promise<ProviderValidationResult> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
    );

    if (response.ok) {
      return { valid: true };
    }

    if (response.status === 400 || response.status === 401 || response.status === 403) {
      return { valid: false, error: 'Invalid API key' };
    }

    return {
      valid: false,
      error: `Google AI returned status ${response.status}`,
    };
  } catch (err) {
    return {
      valid: false,
      error: `Failed to reach Google AI: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function validateOpenAIKey(apiKey: string): Promise<ProviderValidationResult> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      return { valid: true };
    }

    if (response.status === 401) {
      return { valid: false, error: 'Invalid API key' };
    }

    return {
      valid: false,
      error: `OpenAI returned status ${response.status}`,
    };
  } catch (err) {
    return {
      valid: false,
      error: `Failed to reach OpenAI: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Route the raw provider string to the correct validation function.
 * Accepts "gemini" as an alias for "google".
 */
async function validateByProvider(
  provider: string,
  apiKey: string
): Promise<ProviderValidationResult> {
  const normalised = provider.toLowerCase().trim();

  switch (normalised) {
    case 'openrouter':
      return validateOpenRouterKey(apiKey);
    case 'anthropic':
      return validateAnthropicKey(apiKey);
    case 'google':
    case 'gemini':
      return validateGoogleKey(apiKey);
    case 'openai':
      return validateOpenAIKey(apiKey);
    default:
      return {
        valid: false,
        error: `Unsupported provider: ${provider}`,
      };
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // 1. Auth
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse + validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = ValidateKeySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { provider, apiKey } = parsed.data;

    // 3. Test the key against the provider
    const result = await validateByProvider(provider, apiKey);

    if (!result.valid) {
      return NextResponse.json(
        { valid: false, error: result.error ?? 'API key validation failed' },
        { status: 200 } // 200 — the endpoint succeeded; the key itself is invalid
      );
    }

    // 4. Key is valid — update user record
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          apiKeyConfigured: true,
          apiKeyLastValidated: new Date(),
        },
      });
    } catch (dbErr) {
      // Non-fatal: log and continue — validation still succeeded
      console.error('[validate-key] Failed to update user.apiKeyConfigured:', dbErr);
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error('[validate-key] Unexpected error:', error);
    return NextResponse.json(
      { error: sanitizeErrorForResponse(error, 'Validation failed') },
      { status: 500 }
    );
  }
}
