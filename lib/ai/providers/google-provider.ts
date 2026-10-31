/**
 * Google Gemini AI Provider (Direct)
 *
 * Uses the Google Generative AI REST API directly.
 *
 * ENVIRONMENT VARIABLES:
 * - GOOGLE_AI_API_KEY: Google AI Studio / Gemini API key (SECRET)
 */

import { logger } from '@/lib/logger';
import type {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  ModelPresets,
} from './base-provider';

/** Google AI API response types */
interface GoogleAIErrorResponse {
  error?: {
    message?: string;
    code?: number;
  };
}

interface GoogleAIContentPart {
  text?: string;
}

interface GoogleAICandidate {
  content?: {
    parts?: GoogleAIContentPart[];
  };
  finishReason?: string;
}

interface GoogleAIUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

interface GoogleAIResponse {
  candidates?: GoogleAICandidate[];
  usageMetadata?: GoogleAIUsageMetadata;
}

export class GoogleProvider implements AIProvider {
  readonly name = 'Google';

  // SYN-786 — Gemini 3.1 Flash/Pro (GCN2026, Apr 22 2026). 70% TTFT reduction,
  // Native Function Calling Combination. 2.5 Flash retained as `production` tier fallback.
  readonly models: ModelPresets = {
    fast: 'gemini-3.1-flash',
    balanced: 'gemini-3.1-pro',
    creative: 'gemini-3.1-pro',
    premium: 'gemini-3.1-pro',
    code: 'gemini-3.1-pro',
    free: 'gemini-3.1-flash',
  };

  private apiKey: string;
  private baseURL = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(apiKeyOverride?: string) {
    this.apiKey = apiKeyOverride || process.env.GOOGLE_AI_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('Google AI API key not configured.');
    }
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (!this.apiKey) {
      throw new Error('Google AI API key not configured');
    }

    // Convert chat messages to Gemini format
    const systemMsg = request.messages.find(m => m.role === 'system');
    const conversationMsgs = request.messages.filter(m => m.role !== 'system');

    const contents = conversationMsgs.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: request.temperature,
        maxOutputTokens: request.max_tokens || 1024,
        topP: request.top_p,
      },
    };

    if (systemMsg) {
      body.systemInstruction = { parts: [{ text: systemMsg.content }] };
    }

    // SYN-786 — Native Function Calling (Gemini 3.1).
    // Gemini expects tools as [{ functionDeclarations: [...] }] — different shape to Anthropic.
    if (request.tools && request.tools.length > 0) {
      body.tools = [
        {
          functionDeclarations: request.tools.map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.input_schema,
          })),
        },
      ];
    }

    try {
      const url = `${this.baseURL}/models/${request.model}:generateContent?key=${this.apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody: GoogleAIErrorResponse = await res
          .json()
          .catch(() => ({}));
        logger.error('Google AI API error', {
          status: res.status,
          body: errBody,
        });
        throw new Error(
          errBody.error?.message || `Google AI error ${res.status}`
        );
      }

      const data: GoogleAIResponse = await res.json();
      const text =
        data.candidates?.[0]?.content?.parts
          ?.map((p: GoogleAIContentPart) => p.text ?? '')
          .join('') || '';

      return {
        id: `google-${Date.now()}`,
        model: request.model,
        choices: [
          {
            message: { role: 'assistant', content: text },
            finish_reason: data.candidates?.[0]?.finishReason || 'STOP',
          },
        ],
        usage: data.usageMetadata
          ? {
              prompt_tokens: data.usageMetadata.promptTokenCount || 0,
              completion_tokens: data.usageMetadata.candidatesTokenCount || 0,
              total_tokens: data.usageMetadata.totalTokenCount || 0,
            }
          : undefined,
      };
    } catch (error) {
      if (
        (error instanceof Error ? error.message : String(error)).includes(
          'Google AI'
        )
      ) {
        throw error;
      }
      logger.error('Google provider error', { error });
      throw new Error('Failed to connect to Google AI API');
    }
  }

  async *stream(
    request: AICompletionRequest
  ): AsyncGenerator<string, void, unknown> {
    if (!this.apiKey) {
      throw new Error('Google AI API key not configured');
    }

    const systemMsg = request.messages.find(m => m.role === 'system');
    const conversationMsgs = request.messages.filter(m => m.role !== 'system');

    const contents = conversationMsgs.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: request.temperature,
        maxOutputTokens: request.max_tokens || 1024,
      },
    };
    if (systemMsg) {
      body.systemInstruction = { parts: [{ text: systemMsg.content }] };
    }

    const url = `${this.baseURL}/models/${request.model}:streamGenerateContent?key=${this.apiKey}&alt=sse`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok || !res.body) {
      throw new Error(`Google AI streaming error: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event: GoogleAIResponse = JSON.parse(line.slice(6));
            const text = event.candidates?.[0]?.content?.parts
              ?.map((p: GoogleAIContentPart) => p.text ?? '')
              .join('');
            if (text) yield text;
          } catch {
            // Malformed SSE frame, skip to next
          }
        }
      }
    }
  }
}
