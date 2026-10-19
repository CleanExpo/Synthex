/**
 * SEAM: routeTask() (public router) -> resolveModel() (the Governor's pricing
 * lookup, lib/ai/governor/model.ts) for provider 'openrouter'.
 * Catches: a tier whose model id the registry cannot price (Governor refuses
 * with refused_model_unavailable, receipt records cost 0 — spec M10).
 * Misses: whether the id is live on OpenRouter today (verified by hand against
 * https://openrouter.ai/api/v1/models, see registry source comments).
 */
import { routeTask, type TaskType } from '@/lib/ai/model-router';
import { DEFAULT_TASK_ROUTING } from '@/lib/ai/routing-config';
import { resolveModel } from '@/lib/ai/governor/model';

const TASKS = Object.keys(DEFAULT_TASK_ROUTING) as TaskType[];

describe('model-router ids resolve in the OpenRouter registry', () => {
  it('covers all three tiers', () => {
    const tiers = new Set(
      TASKS.map(
        t =>
          routeTask({
            taskType: t,
            inputTokenEstimate: 100,
            qualityThreshold: 'medium',
          }).tier
      )
    );
    expect([...tiers].sort()).toEqual(['complex', 'simple', 'standard']);
  });

  it.each(TASKS)('%s: routed model resolves with a non-zero price', task => {
    const { model } = routeTask({
      taskType: task,
      inputTokenEstimate: 100,
      qualityThreshold: 'medium',
    });
    const res = resolveModel('openrouter', {
      kind: 'registered',
      modelId: model,
    });
    expect(res.ok).toBe(true);
    expect(res.model?.costPer1kTokens.input).toBeGreaterThan(0);
    expect(res.model?.costPer1kTokens.output).toBeGreaterThan(0);
  });

  it('control: an unregistered id is refused (planted failure is caught)', () => {
    const res = resolveModel('openrouter', {
      kind: 'registered',
      modelId: 'anthropic/claude-not-a-model',
    });
    expect(res.ok).toBe(false);
  });
});
