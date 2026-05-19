import type { BoardInput } from '../intake/board-input.schema';

const ONTOLOGY_RULES: Array<[RegExp, string]> = [
  [/\bclient|customer|toby|ccw\b/i, 'actor:client'],
  [/\bproduct|shopify|meter|service\b/i, 'entity:product'],
  [/\bcampaign|facebook|linkedin|youtube|instagram|reddit\b/i, 'work:campaign'],
  [/\bvideo|storyboard|thumbnail|remotion|heygen\b/i, 'work:gen-media'],
  [/\bresearch|trend|seo|aeo|geo|backlink\b/i, 'signal:market-intelligence'],
  [/\bapproval|review|sign off|gate\b/i, 'gate:human-review'],
];

export function linkCommandOntology(input: BoardInput): string[] {
  const text = `${input.cleanedText} ${input.evidenceRefs.join(' ')}`;
  const refs = ONTOLOGY_RULES.filter(([pattern]) => pattern.test(text)).map(
    ([, ref]) => ref
  );

  return Array.from(new Set(['source:board-input', ...refs]));
}
