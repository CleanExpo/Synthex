import {
  executeStudioTool,
  ALL_MCP_TOOLS,
} from '@/lib/services/ai/studio-tools';

const ctx = {
  userId: 'u1',
  organizationId: 'o1',
  initiatedBy: 'studio' as const,
};

describe('list_reference_sets tool', () => {
  it('is registered as a read/free creative tool', () => {
    const t = ALL_MCP_TOOLS.find(x => x.name === 'list_reference_sets');
    expect(t).toBeDefined();
    expect(t!.scope).toBe('creative');
    expect(t!.riskClass).toBe('read');
  });

  it('returns the owned reference sets', async () => {
    const res = await executeStudioTool('list_reference_sets', {}, ctx);
    const sets = (res as { sets: Array<{ industry: string }> }).sets;
    expect(sets.some(s => s.industry === 'carpet-cleaning')).toBe(true);
  });
});
