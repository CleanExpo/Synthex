/**
 * contentCampaignWorkflow template — AT-002 / AT-003 shape.
 */
import { contentCampaignWorkflow } from '@/lib/workflow/workflow-templates';

describe('contentCampaignWorkflow', () => {
  test('generate step wires senior-copywriter skill (AT-002)', () => {
    const def = contentCampaignWorkflow();
    const generate = def.steps.find(s => s.name === 'Generate content');

    expect(generate).toBeDefined();
    expect(generate?.type).toBe('ai');
    expect(generate?.config).toEqual({ skill: 'senior-copywriter' });
    expect(generate?.promptTemplate).toContain('{{workflowInput}}');
    expect(generate?.promptTemplate).not.toMatch(
      /You are a professional content creator/i
    );
  });

  test('includes brand-voice validation step after generate (AT-003)', () => {
    const def = contentCampaignWorkflow();
    const gate = def.steps.find(s => s.name === 'Brand voice gate');

    expect(gate).toEqual(
      expect.objectContaining({
        type: 'validation',
        config: { subType: 'brand-voice', passScore: 75 },
      })
    );
  });
});
