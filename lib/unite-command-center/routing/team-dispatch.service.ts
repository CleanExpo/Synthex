import type { BoardInput } from '../intake/board-input.schema';

export function routeBoardInputToTeam(input: BoardInput): string[] {
  const text = input.cleanedText;
  const route = new Set<string>(['ceo-board', 'margot']);

  if (/\b(code|api|database|route|bug|deploy|sandbox|command center)\b/i.test(text)) {
    route.add('senior-engineering-team');
  }
  if (/\b(campaign|seo|aeo|geo|backlink|market|competitor)\b/i.test(text)) {
    route.add('marketing-strategy');
  }
  if (
    /\b(research|trend|evidence|source|wiki|obsidian|karpathy|council|palantir|ontology|hermes)\b/i.test(
      text
    )
  ) {
    route.add('research-council');
  }
  if (/\b(video|short|reel|thumbnail|storyboard|heygen|remotion)\b/i.test(text)) {
    route.add('gen-media');
  }
  if (/\b(presentation|deck|slide|event|meeting)\b/i.test(text)) {
    route.add('presentation-qa');
  }
  if (input.sensitivity !== 'public') {
    route.add('compliance');
  }

  return Array.from(route);
}
