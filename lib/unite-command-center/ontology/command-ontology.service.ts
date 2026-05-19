import type { BoardInput } from '../intake/board-input.schema';

const ONTOLOGY_RULES: Array<[RegExp, string]> = [
  [/\b(?:client|customer|toby|ccw)\b/i, 'actor:client'],
  [/\b(?:product|shopify|meter|service)\b/i, 'entity:product'],
  [/\b(?:campaign|facebook|linkedin|youtube|instagram|reddit)\b/i, 'work:campaign'],
  [/\b(?:video|storyboard|thumbnail|remotion|heygen)\b/i, 'work:gen-media'],
  [/\b(?:research|trend|seo|aeo|geo|backlink)\b/i, 'signal:market-intelligence'],
  [/\b(?:approval|review|sign off|gate)\b/i, 'gate:human-review'],
];

export function linkCommandOntology(input: BoardInput): string[] {
  const text = `${input.cleanedText} ${input.evidenceRefs.join(' ')}`;
  const refs = ONTOLOGY_RULES.filter(([pattern]) => pattern.test(text)).map(
    ([, ref]) => ref
  );

  return Array.from(new Set(['source:board-input', ...refs]));
}
