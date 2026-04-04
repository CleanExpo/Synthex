/**
 * API Key Validator
 *
 * Validates API keys by testing actual connectivity to the provider.
 * This ensures keys are valid before storing them in the database.
 *
 * Supported providers: OpenAI, Anthropic, Google, OpenRouter
 */

export type APIProvider = 'openai' | 'anthropic' | 'google' | 'openrouter';

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
        model: 'claude-sonnet-4-20250514',
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
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });

    if (response.ok) {
      return {
        isValid: true,
        provider: 'openrouter',
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        isValid: false,
        provider: 'openrouter',
        error: 'Invalid API key',
      };
    }

    return {
      isValid: false,
      provider: 'openrouter',
      error: `OpenRouter API returned status ${response.status}`,
    };
  } catch (error) {
    return {
      isValid: false,
      provider: 'openrouter',
      error: `Failed to validate: ${error instanceof Error ? error.message : String(error)}`,
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
  const cleanKey = key.trim();

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
  return Promise.all(credentials.map(({ provider, key }) => validateAPIKey(provider, key)));
}
