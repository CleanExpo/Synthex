import { z } from 'zod';
import {
  queryKnowledge,
  type KnowledgeResult,
  type QueryKnowledgeOptions,
} from '@/lib/knowledge-query';

export const semanticSearchInputSchema = z.object({
  clientId: z.string().min(1),
  query: z.string().min(3).max(500),
  maxResults: z.number().int().min(1).max(20).optional(),
  minRelevance: z.number().min(0).max(1).optional(),
  includeGraphExpansion: z.boolean().optional(),
});

export type SemanticSearchInput = z.infer<typeof semanticSearchInputSchema>;

export interface AgentTool<TInput, TOutput> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  execute(input: TInput): Promise<TOutput>;
}

export const semanticSearchTool: AgentTool<
  SemanticSearchInput,
  KnowledgeResult[]
> = {
  name: 'semantic_search',
  description:
    'Search the client knowledge graph with semantic similarity and graph evidence.',
  inputSchema: semanticSearchInputSchema,
  async execute(input) {
    const parsed = semanticSearchInputSchema.parse(input);
    const options: QueryKnowledgeOptions = {
      maxResults: parsed.maxResults,
      minRelevance: parsed.minRelevance,
      includeGraphExpansion: parsed.includeGraphExpansion,
    };

    return queryKnowledge(parsed.clientId, parsed.query, options);
  },
};

export const AGENT_TOOL_REGISTRY = {
  semantic_search: semanticSearchTool,
} as const;

export type AgentToolName = keyof typeof AGENT_TOOL_REGISTRY;
