import {
  AGENT_TOOL_REGISTRY,
  semanticSearchInputSchema,
} from '@/lib/agents/tool-registry';
import { queryKnowledge } from '@/lib/knowledge-query';

jest.mock('@/lib/knowledge-query', () => ({
  queryKnowledge: jest.fn().mockResolvedValue([
    {
      entityId: 'entity-1',
      entityType: 'topic',
      entityName: 'Campaign planning',
      entityMetadata: {},
      sourceSystem: 'pipeline',
      sourceId: null,
      relevanceScore: 0.91,
      evidence: ['related_to'],
      sourceCitation: 'pipeline: Campaign planning',
    },
  ]),
}));

describe('agent tool registry', () => {
  it('registers semantic_search as the callable knowledge tool', () => {
    expect(AGENT_TOOL_REGISTRY.semantic_search.name).toBe('semantic_search');
  });

  it('rejects empty semantic search queries', () => {
    expect(() =>
      semanticSearchInputSchema.parse({ clientId: 'org_1', query: '' })
    ).toThrow();
  });

  it('executes semantic_search through the registry', async () => {
    (queryKnowledge as jest.Mock).mockResolvedValueOnce([
      {
        entityId: 'entity-1',
        entityType: 'topic',
        entityName: 'Campaign planning',
        entityMetadata: {},
        sourceSystem: 'pipeline',
        sourceId: null,
        relevanceScore: 0.91,
        evidence: ['related_to'],
        sourceCitation: 'pipeline: Campaign planning',
      },
    ]);

    const results = await AGENT_TOOL_REGISTRY.semantic_search.execute({
      clientId: 'org_1',
      query: 'marketing campaign plan',
      maxResults: 5,
    });

    expect(results).toHaveLength(1);
    expect(results[0].entityName).toBe('Campaign planning');
  });
});
