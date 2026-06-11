/**
 * LLM token routing — cost governance for assist tasks. Routine assists run on
 * the cheapest capable model; premium LLM use is reserved for explicit user
 * requests. Tune via env without code changes: LLM_ROUTING_<TASK> overrides.
 *
 * The default model IDs are raw OpenRouter strings, which the OpenRouterProvider
 * passes through directly to the completions API. Any other configured provider
 * (Anthropic, Google) must accept the same string or be overridden via env var.
 */
export type AssistTask =
  | 'prompt-enhance'
  | 'caption-draft'
  | 'fix-retry'
  | 'canvas-compose';

const DEFAULTS: Record<AssistTask, string> = {
  'prompt-enhance': 'google/gemini-2.5-flash',
  'caption-draft': 'google/gemini-2.5-flash',
  'fix-retry': 'google/gemini-2.5-flash',
  'canvas-compose': 'moonshotai/kimi-k2',
};

export function modelForTask(task: AssistTask): string {
  const envKey = `LLM_ROUTING_${task.toUpperCase().replace(/-/g, '_')}`;
  return process.env[envKey] ?? DEFAULTS[task];
}
