import { SourceConnector, SourceResult } from '../types';
import { logger } from '@/lib/logger';

// Confidence scoring based on domain authority
function getDomainConfidence(url: string): number {
  try {
    const hostname = new URL(url).hostname;
    if (hostname.endsWith('.gov') || hostname.endsWith('.gov.au')) return 0.95;
    if (hostname.endsWith('.edu') || hostname.endsWith('.edu.au')) return 0.85;
    if (hostname.endsWith('.org') || hostname.endsWith('.org.au')) return 0.75;
    return 0.6;
  } catch {
    return 0.6;
  }
}

interface WebSearchResultBlock {
  type: string;
  url?: string;
  title?: string;
  page_age?: string;
  encrypted_index?: string;
  // The actual content of a web search result
  [key: string]: unknown;
}

interface TextContentBlock {
  type: 'text';
  text: string;
}

type ContentBlock = WebSearchResultBlock | TextContentBlock | { type: string; [key: string]: unknown };

export class ClaudeWebSearchConnector implements SourceConnector {
  readonly id = 'claude-web-search';
  readonly name = 'Claude Web Search';
  readonly type = 'web' as const;
  readonly description = 'Web search via Claude API with domain filtering for authoritative sources';

  get enabled(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  async search(query: string): Promise<SourceResult[]> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return [];
    }

    try {
      const requestBody = {
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            allowed_domains: [
              '*.gov.au',
              '*.edu.au',
              '*.org.au',
              'scholar.google.com',
              '*.gov',
              '*.edu',
            ],
          },
        ],
        messages: [
          {
            role: 'user',
            content: `Find authoritative sources about: ${query}. Search for peer-reviewed research, government publications, and official industry standards.`,
          },
        ],
      };

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'web-search-2025-03-05',
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        logger.warn('Claude Web Search API error', {
          status: response.status,
          query,
          error: (errBody as Record<string, unknown>)?.error,
        });
        return [];
      }

      const data = await response.json();
      const results: SourceResult[] = [];

      if (!data.content || !Array.isArray(data.content)) {
        return [];
      }

      // Parse content blocks — look for web search results
      for (const block of data.content as ContentBlock[]) {
        // web_search_result blocks contain the actual search results
        if (
          block.type === 'web_search_result' ||
          block.type === 'search_result' ||
          block.type === 'tool_result'
        ) {
          const url = (block as WebSearchResultBlock).url;
          const title = (block as WebSearchResultBlock).title;
          if (url && title) {
            results.push({
              title: String(title),
              url: String(url),
              snippet: `Found via Claude web search for: ${query}`,
              sourceType: 'web',
              sourceName: 'Claude Web Search',
              confidence: getDomainConfidence(String(url)),
            });
          }
        }

        // Also parse tool_use blocks that may contain search results
        if (block.type === 'tool_use') {
          const input = (block as Record<string, unknown>).input as Record<string, unknown> | undefined;
          if (input?.query) {
            // The tool was invoked — results come in subsequent tool_result blocks
          }
        }

        // Parse text blocks that may contain structured search result references
        if (block.type === 'text') {
          const text = (block as TextContentBlock).text;
          // Extract URLs from text if they match authoritative domains
          const urlMatches = text.matchAll(/https?:\/\/[^\s\)\"\']+/g);
          for (const match of urlMatches) {
            const url = match[0].replace(/[.,;:!?]$/, '');
            const confidence = getDomainConfidence(url);
            if (confidence >= 0.75) {
              // Only include high-confidence domain URLs from text
              const alreadyAdded = results.some((r) => r.url === url);
              if (!alreadyAdded) {
                results.push({
                  title: `Source from ${new URL(url).hostname}`,
                  url,
                  snippet: `Authoritative source referenced by Claude for: ${query}`,
                  sourceType: 'web',
                  sourceName: 'Claude Web Search',
                  confidence,
                });
              }
            }
          }
        }
      }

      return results;
    } catch (error) {
      logger.warn('Claude Web Search connector error', {
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
}
