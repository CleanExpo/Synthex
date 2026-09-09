/** Launch week is a campaign of 3–7 posts the user still schedules. */

export const LAUNCH_WEEK_MIN = 3;
export const LAUNCH_WEEK_MAX = 7;
export const LAUNCH_WEEK_DEFAULT = 5;

export function clampLaunchWeekCount(value: number): number {
  if (!Number.isFinite(value)) return LAUNCH_WEEK_DEFAULT;
  return Math.min(
    LAUNCH_WEEK_MAX,
    Math.max(LAUNCH_WEEK_MIN, Math.round(value))
  );
}

export function emptyLaunchWeekDrafts(count: number): string[] {
  return Array.from({ length: clampLaunchWeekCount(count) }, () => '');
}

export function filledDraftCount(drafts: string[]): number {
  return drafts.filter(text => text.trim().length > 0).length;
}

export function launchWeekReady(name: string, drafts: string[]): boolean {
  return name.trim().length > 0 && filledDraftCount(drafts) >= LAUNCH_WEEK_MIN;
}

/** Fill slots with distinct generated lines. Never invent lookalike copies. */
export function fillDraftsFromGeneration(
  slotCount: number,
  primary: string,
  variations: string[] = []
): string[] {
  const count = Math.max(1, Math.round(slotCount));
  const seen = new Set<string>();
  const filled: string[] = [];
  for (const raw of [primary, ...variations]) {
    const text = raw.trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    filled.push(text);
    if (filled.length === count) break;
  }
  while (filled.length < count) filled.push('');
  return filled;
}
