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

export class GoogleProvider implements AIProvider {
  readonly name = 'Google';

  readonly models: ModelPresets = {
    fast: 'gemini-1.5-flash',
    balanced: 'gemini-1.5-flash',
    creative: 'gemini-1.5-pro',
    premium: 'gemini-1.5-pro',
    code: 'gemini-1.5-flash',
    free: 'gemini-1.5-flash',
  };

  private apiKey: string;
  private baseURL = 'https://generativelanguage.googleapis.com/v1beta';

  constructor() {
    this.apiKey = process.env.GOOGLE_AI_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('Google AI API key not configured.');
    }
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (!this.apiKey) {
      throw new Error('Google AI API key not configured');
    }

    // Convert chat messages to Gemini format
    const systemMsg = request.messages.find((m) => m.role === 'system');
    const conversationMsgs = request.messages.filter((m) => m.role !== 'system');

    const contents = conversationMsgs.map((m) => ({
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

    try {
      const url = `${this.baseURL}/models/${request.model}:generateContent?key=${this.apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        logger.error('Google AI API error', { status: res.status, body: errBody });
        throw new Error(
          (errBody as any)?.error?.message || `Google AI error ${res.status}`
        );
      }

      const data = await res.json();
      const text =
        data.candidates?.[0]?.content?.parts
          ?.map((p: any) => p.text)
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
      if (error instanceof Error && error.message.includes('Google AI')) {
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

    const systemMsg = request.messages.find((m) => m.role === 'system');
    const conversationMsgs = request.messages.filter((m) => m.role !== 'system');

    const contents = conversationMsgs.map((m) => ({
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
            const event = JSON.parse(line.slice(6));
            const text = event.candidates?.[0]?.content?.parts
              ?.map((p: any) => p.text)
              .join('');
            if (text) yield text;
          } catch {
            // skip
          }
        }
      }
    }
  }
}
