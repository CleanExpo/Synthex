/**
 * Unit tests for ensureBrandVoiceGate — AT-027.
 */

import {
  BRAND_VOICE_GATE_STEP,
  ensureBrandVoiceGate,
} from '@/lib/autonomous/ensure-brand-voice-gate';
import type { WorkflowStepDefinition } from '@/lib/workflow/types';

describe('ensureBrandVoiceGate', () => {
  it('is a no-op when a brand-voice validation step already exists', () => {
    const steps: WorkflowStepDefinition[] = [
      { name: 'Draft', type: 'ai', promptTemplate: 'Write' },
      {
        name: 'Brand voice gate',
        type: 'validation',
        config: { subType: 'brand-voice', passScore: 80 },
      },
      { name: 'Publish', type: 'action', actionType: 'publish' },
    ];

    expect(ensureBrandVoiceGate(steps)).toBe(steps);
  });

  it('inserts the gate before the first publish action', () => {
    const steps: WorkflowStepDefinition[] = [
      { name: 'Draft', type: 'ai', promptTemplate: 'Write' },
      { name: 'Publish', type: 'action', actionType: 'publish' },
    ];

    expect(ensureBrandVoiceGate(steps)).toEqual([
      steps[0],
      BRAND_VOICE_GATE_STEP,
      steps[1],
    ]);
  });

  it('inserts the gate before human approval', () => {
    const steps: WorkflowStepDefinition[] = [
      { name: 'Draft', type: 'ai', promptTemplate: 'Write' },
      { name: 'Review', type: 'approval' },
    ];

    expect(ensureBrandVoiceGate(steps)).toEqual([
      steps[0],
      BRAND_VOICE_GATE_STEP,
      steps[1],
    ]);
  });

  it('appends the gate when there is no publish or approval sink', () => {
    const steps: WorkflowStepDefinition[] = [
      { name: 'Research', type: 'ai', promptTemplate: 'Analyse' },
    ];

    expect(ensureBrandVoiceGate(steps)).toEqual([
      steps[0],
      BRAND_VOICE_GATE_STEP,
    ]);
  });
});
