/**
 * OpenRouter API Configuration and Helper
 * Handles AI model interactions for the Strategic Marketing system
 */

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  response_format?: { type: 'json_object' };
}

interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

class OpenRouterClient {
  private apiKey: string;
  private baseUrl: string = 'https://openrouter.ai/api/v1';
  private defaultModel: string = 'openai/gpt-4-turbo-preview';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('OpenRouter API key not configured. Please set OPENROUTER_API_KEY environment variable.');
    }
  }

  /**
   * Call OpenRouter API with the specified configuration
   */
  async call(request: OpenRouterRequest): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key is not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'SYNTHEX Strategic Marketing'
        },
        body: JSON.stringify({
          ...request,
          response_format: request.response_format || { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
      }

      const data: OpenRouterResponse = await response.json();
      
      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from OpenRouter');
      }

      // Log token usage for monitoring
      if (data.usage) {
        console.log(`Token usage - Prompt: ${data.usage.prompt_tokens}, Completion: ${data.usage.completion_tokens}, Total: ${data.usage.total_tokens}`);
      }

      return data.choices[0].message.content;
    } catch (error) {
      console.error('OpenRouter API call failed:', error);
      throw error;
    }
  }

  /**
   * Stream responses from OpenRouter (for real-time generation)
   */
  async stream(request: OpenRouterRequest): Promise<ReadableStream> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key is not configured');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'SYNTHEX Strategic Marketing'
      },
      body: JSON.stringify({
        ...request,
        stream: true
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    return response.body!;
  }

  /**
   * Get available models from OpenRouter
   */
  async getModels(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Failed to fetch OpenRouter models:', error);
      return [];
    }
  }

  /**
   * Check API key validity and remaining credits
   */
  async checkCredits(): Promise<{ valid: boolean; credits?: number }> {
    try {
      // Make a minimal API call to check validity
      await this.call({
        model: 'openai/gpt-3.5-turbo',
        messages: [
          { role: 'user', content: 'test' }
        ],
        max_tokens: 1
      });

      return { valid: true };
    } catch (error) {
      return { valid: false };
    }
  }
}

// Singleton instance
let openRouterClient: OpenRouterClient | null = null;

/**
 * Get or create OpenRouter client instance
 */
export function getOpenRouterClient(): OpenRouterClient {
  if (!openRouterClient) {
    openRouterClient = new OpenRouterClient();
  }
  return openRouterClient;
}

/**
 * Main function to call OpenRouter API
 */
export async function callOpenRouter(request: OpenRouterRequest): Promise<string> {
  const client = getOpenRouterClient();
  return client.call(request);
}

/**
 * Stream responses from OpenRouter
 */
export async function streamOpenRouter(request: OpenRouterRequest): Promise<ReadableStream> {
  const client = getOpenRouterClient();
  return client.stream(request);
}

/**
 * Model presets for different use cases
 */
export const MODEL_PRESETS = {
  fast: 'openai/gpt-3.5-turbo',
  balanced: 'openai/gpt-4-turbo-preview',
  powerful: 'openai/gpt-4',
  creative: 'anthropic/claude-3-opus',
  analytical: 'anthropic/claude-3-sonnet'
};

/**
 * Temperature presets for different generation styles
 */
export const TEMPERATURE_PRESETS = {
  deterministic: 0.1,
  focused: 0.3,
  balanced: 0.7,
  creative: 0.9,
  experimental: 1.0
};

const openRouter = {
  callOpenRouter,
  streamOpenRouter,
  getOpenRouterClient,
  MODEL_PRESETS,
  TEMPERATURE_PRESETS
};

export default openRouter;
