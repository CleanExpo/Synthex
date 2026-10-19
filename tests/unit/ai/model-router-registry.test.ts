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
import { getModels } from '@/lib/ai/model-registry';
import { TIER_MODELS } from '@/lib/ai/routing-config';
import {
  ALL_INTENTS,
  getRoutingMatrix,
  routeIntent,
} from '@/lib/ai/task-routing';

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

  it.each(Object.entries(TIER_MODELS))(
    '%s tier: configured prices equal the registry (settle equals ledger)',
    (_tier, cfg) => {
      const res = resolveModel('openrouter', {
        kind: 'registered',
        modelId: cfg.modelId,
      });
      expect(res.ok).toBe(true);
      expect(cfg.costPerMTokInput).toBeCloseTo(
        (res.model?.costPer1kTokens.input ?? 0) * 1000,
        6
      );
      expect(cfg.costPerMTokOutput).toBeCloseTo(
        (res.model?.costPer1kTokens.output ?? 0) * 1000,
        6
      );
    }
  );

  it('every OpenRouter id task-routing can return resolves with a non-zero price', () => {
    const ids = new Set<string>();
    for (const intent of ALL_INTENTS) {
      const entry = getRoutingMatrix()[intent];
      for (const c of [
        entry.primary,
        ...entry.fallback,
        ...(entry.panel ?? []),
      ])
        if (c.provider === 'openrouter') ids.add(c.modelId);
      for (const opts of [
        { quality: 'high' as const },
        { quality: 'low' as const },
        { contextLength: 500_000 },
      ]) {
        const choice = routeIntent(intent, opts);
        for (const c of [choice, ...choice.fallback])
          if (c.provider === 'openrouter') ids.add(c.modelId);
      }
    }
    expect(ids.size).toBeGreaterThan(0);
    for (const modelId of ids) {
      const res = resolveModel('openrouter', { kind: 'registered', modelId });
      expect({ modelId, ok: res.ok }).toEqual({ modelId, ok: true });
      expect(res.model?.costPer1kTokens.input).toBeGreaterThan(0);
      expect(res.model?.costPer1kTokens.output).toBeGreaterThan(0);
    }
  });

  it('registry OpenRouter ids use dot versions, not the unlisted hyphen form', () => {
    const bad = getModels('openrouter')
      .map(m => m.id)
      .filter(id => /^anthropic\/claude-[a-z]+-\d+-\d+$/.test(id));
    expect(bad).toEqual([]);
  });

  it('control: an unregistered id is refused (planted failure is caught)', () => {
    const res = resolveModel('openrouter', {
      kind: 'registered',
      modelId: 'anthropic/claude-not-a-model',
    });
    expect(res.ok).toBe(false);
  });
});
