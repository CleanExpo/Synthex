/**
 * API Key Validator
 *
 * Validates API keys by testing actual connectivity to the provider.
 * This ensures keys are valid before storing them in the database.
 *
 * Supported providers: OpenAI, Anthropic, Google, OpenRouter
 */

export type APIProvider = 'openai' | 'anthropic' | 'google' | 'openrouter';

function sanitizeApiKey(key: string): string {
  return key.trim().replace(/^bearer\s+/i, '');
}

interface ValidationResult {
  isValid: boolean;
  provider: APIProvider;
  organization?: string;
  error?: string;
}

/**
 * Validate OpenAI API Key
 * Tests the key against the list models endpoint
 */
async function validateOpenAIKey(key: string): Promise<ValidationResult> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });

    if (response.ok) {
      // Try to get organization info
      const orgHeader = response.headers.get('openai-organization');
      return {
        isValid: true,
        provider: 'openai',
        organization: orgHeader || undefined,
      };
    }

    if (response.status === 401) {
      return {
        isValid: false,
        provider: 'openai',
        error: 'Invalid API key',
      };
    }

    return {
      isValid: false,
      provider: 'openai',
      error: `OpenAI API returned status ${response.status}`,
    };
  } catch (error) {
    return {
      isValid: false,
      provider: 'openai',
      error: `Failed to validate: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Validate Anthropic API Key
 * Tests the key against the messages endpoint
 */
async function validateAnthropicKey(key: string): Promise<ValidationResult> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });

    // Any non-401 response means the key was accepted by Anthropic's auth layer.
    // 200 = success, 400 = bad request, 404 = model not found,
    // 429 = rate limited, 529 = overloaded — all confirm a valid key.
    if (response.status === 401) {
      return {
        isValid: false,
        provider: 'anthropic',
        error: 'Invalid API key',
      };
    }

    if (response.status === 403) {
      return {
        isValid: false,
        provider: 'anthropic',
        error: 'API key lacks required permissions',
      };
    }

    return {
      isValid: true,
      provider: 'anthropic',
    };
  } catch (error) {
    return {
      isValid: false,
      provider: 'anthropic',
      error: `Failed to validate: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Validate Google API Key
 * Tests the key against the generative language API
 */
async function validateGoogleKey(key: string): Promise<ValidationResult> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(key)}`
    );

    if (response.ok) {
      return {
        isValid: true,
        provider: 'google',
      };
    }

    if (response.status === 400 || response.status === 401) {
      return {
        isValid: false,
        provider: 'google',
        error: 'Invalid API key',
      };
    }

    return {
      isValid: false,
      provider: 'google',
      error: `Google API returned status ${response.status}`,
    };
  } catch (error) {
    return {
      isValid: false,
      provider: 'google',
      error: `Failed to validate: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Validate OpenRouter API Key
 * Tests the key against the models endpoint
 */
async function validateOpenRouterKey(key: string): Promise<ValidationResult> {
  if (!key.startsWith('sk-or-')) {
    return {
      isValid: false,
      provider: 'openrouter',
      error:
        'That is not an OpenRouter key. Paste a key that starts with sk-or- from openrouter.ai/keys.',
    };
  }

  const headers = {
    Authorization: `Bearer ${key}`,
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3008',
    'X-Title': 'Synthex',
  };

  try {
    // /key checks the secret. /models is a public catalogue and can 200
    // without proving the key works — or stall and then 400 the save.
    const response = await fetch('https://openrouter.ai/api/v1/key', {
      headers,
      signal: AbortSignal.timeout(8_000),
    });

    if (response.ok) {
      return { isValid: true, provider: 'openrouter' };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        isValid: false,
        provider: 'openrouter',
        error: 'OpenRouter rejected this key. Check it at openrouter.ai/keys.',
      };
    }

    if (response.status === 404) {
      const models = await fetch('https://openrouter.ai/api/v1/models', {
        headers,
        signal: AbortSignal.timeout(8_000),
      });
      if (models.ok || models.status === 401 || models.status === 403) {
        return models.ok
          ? { isValid: true, provider: 'openrouter' }
          : {
              isValid: false,
              provider: 'openrouter',
              error: 'OpenRouter rejected this key.',
            };
      }
    }

    return {
      isValid: false,
      provider: 'openrouter',
      error: `OpenRouter could not confirm this key (${response.status}). Try again.`,
    };
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === 'TimeoutError' || error.name === 'AbortError');
    if (timedOut) {
      // Format already matches — do not block save on a hung outbound check.
      return { isValid: true, provider: 'openrouter' };
    }
    return {
      isValid: false,
      provider: 'openrouter',
      error: `Failed to reach OpenRouter: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Main validation function
 * Routes to the appropriate provider validator
 */
export async function validateAPIKey(
  provider: APIProvider,
  key: string
): Promise<ValidationResult> {
  // Basic validation
  if (!key || typeof key !== 'string') {
    return {
      isValid: false,
      provider,
      error: 'Invalid key format',
    };
  }

  // Sanitize key (trim whitespace)
  const cleanKey = sanitizeApiKey(key);

  if (cleanKey.length < 10) {
    return {
      isValid: false,
      provider,
      error: 'Key is too short',
    };
  }

  // Route to appropriate validator
  switch (provider) {
    case 'openai':
      return validateOpenAIKey(cleanKey);
    case 'anthropic':
      return validateAnthropicKey(cleanKey);
    case 'google':
      return validateGoogleKey(cleanKey);
    case 'openrouter':
      return validateOpenRouterKey(cleanKey);
    default:
      return {
        isValid: false,
        provider,
        error: `Unknown provider: ${provider}`,
      };
  }
}

/**
 * Validate multiple API keys in parallel
 */
export async function validateAPIKeys(
  credentials: Array<{ provider: APIProvider; key: string }>
): Promise<ValidationResult[]> {
  return Promise.all(
    credentials.map(({ provider, key }) => validateAPIKey(provider, key))
  );
}
