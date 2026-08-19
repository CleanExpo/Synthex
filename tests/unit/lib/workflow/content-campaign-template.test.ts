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

  test('includes strategist final-gate before human review (AT-004)', () => {
    const def = contentCampaignWorkflow();
    const strategist = def.steps.find(s => s.name === 'Strategist final gate');
    const human = def.steps.find(s => s.name === 'Human review');
    const strategistIdx = def.steps.findIndex(
      s => s.name === 'Strategist final gate'
    );
    const humanIdx = def.steps.findIndex(s => s.name === 'Human review');

    expect(strategist).toEqual(
      expect.objectContaining({
        type: 'validation',
        config: { subType: 'strategist' },
      })
    );
    expect(human?.type).toBe('approval');
    expect(strategistIdx).toBeGreaterThan(-1);
    expect(humanIdx).toBeGreaterThan(strategistIdx);
  });
});
