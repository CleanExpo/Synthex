/**
 * P2 u12: `client_knowledge_entities` / `client_knowledge_edges` have no
 * Prisma model. The builder must fail before extracting or paying for
 * embeddings, with a typed error — not silently report zero writes.
 */
const prismaAny = new Proxy(
  {},
  {
    get: () => new Proxy({}, { get: () => jest.fn().mockResolvedValue([]) }),
  }
);
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: prismaAny,
  prisma: prismaAny,
}));
const batchEmbed = jest.fn();
jest.mock('@/lib/ai/embedding-service', () => ({
  __esModule: true,
  default: { batchEmbed: (...a: unknown[]) => batchEmbed(...a) },
}));
jest.mock('@/lib/pipelines/track-cost', () => ({
  trackPipelineCost: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import {
  buildKnowledgeGraphForClient,
  KnowledgeGraphNotProvisionedError,
} from '@/lib/knowledge-graph/builder';

describe('buildKnowledgeGraphForClient (NOT_PROVISIONED: client_knowledge_entities, client_knowledge_edges)', () => {
  it('throws a typed FEATURE_NOT_PROVISIONED error without embedding spend', async () => {
    const run = buildKnowledgeGraphForClient('org-1', 'run-1');
    await expect(run).rejects.toBeInstanceOf(KnowledgeGraphNotProvisionedError);
    await expect(run).rejects.toMatchObject({
      code: 'FEATURE_NOT_PROVISIONED',
      tables: ['client_knowledge_entities', 'client_knowledge_edges'],
    });
    expect(batchEmbed).not.toHaveBeenCalled();
  });
});
