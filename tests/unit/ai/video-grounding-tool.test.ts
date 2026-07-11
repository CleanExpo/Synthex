import { z } from 'zod';

// Re-derive the arg schema shape by importing the module and checking the tool.
import { ALL_MCP_TOOLS } from '@/lib/services/ai/studio-tools';

describe('generate_video reference args', () => {
  it('accepts referenceSet and useReferences without error', () => {
    const tool = ALL_MCP_TOOLS.find(t => t.name === 'generate_video');
    expect(tool).toBeDefined();
    const parsed = (tool!.schema as z.ZodTypeAny).safeParse({
      prompt: 'a carpet wand',
      methodCardId: 'stub',
      referenceSet: 'carpet-cleaning',
      useReferences: true,
    });
    expect(parsed.success).toBe(true);
  });

  it('still rejects a missing prompt', () => {
    const tool = ALL_MCP_TOOLS.find(t => t.name === 'generate_video');
    const parsed = (tool!.schema as z.ZodTypeAny).safeParse({
      methodCardId: 'stub',
      referenceSet: 'carpet-cleaning',
    });
    expect(parsed.success).toBe(false);
  });
});
