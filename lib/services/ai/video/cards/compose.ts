import { MethodCard } from './method-cards';
import { ModifierChip } from './modifier-chips';

const CATEGORY_ORDER: ModifierChip['category'][] = [
  'style',
  'camera',
  'lighting',
];

export interface ComposeInput {
  methodCard: MethodCard;
  subject: string;
  chips: ModifierChip[];
  brandFragment?: string | null;
}

export interface ComposedPrompt {
  prompt: string;
  negativePrompt?: string;
  params: Record<string, string | number | boolean>;
}

export function composePrompt(input: ComposeInput): ComposedPrompt {
  const base = input.methodCard.promptScaffold.replaceAll(
    '{{subject}}',
    input.subject.trim()
  );

  const chipText = CATEGORY_ORDER.flatMap(cat =>
    input.chips.filter(c => c.category === cat).map(c => c.promptFragment)
  ).join(', ');

  const parts = [base];
  if (chipText) parts.push(chipText);
  if (input.brandFragment) parts.push(input.brandFragment);

  const params: Record<string, string | number | boolean> = {};
  for (const chip of input.chips) Object.assign(params, chip.params ?? {});
  Object.assign(params, input.methodCard.params); // card-last wins

  return {
    prompt: parts.join('. '),
    negativePrompt: input.methodCard.negativePrompt,
    params,
  };
}
