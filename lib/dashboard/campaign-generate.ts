/** Days in the booked window, inclusive. Caps at 7 so a create stays usable. */
export function daysInWindow(startsAt: string, endsAt: string): number {
  if (!startsAt || !endsAt) return 0;
  const start = new Date(`${startsAt}T00:00:00`);
  const end = new Date(`${endsAt}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (diff < 1) return 1;
  return Math.min(7, diff);
}

export function defaultDateWindow(days: number): {
  startsAt: string;
  endsAt: string;
} {
  const count = Math.min(7, Math.max(3, Math.round(days) || 5));
  const start = new Date();
  const end = new Date(start);
  end.setDate(start.getDate() + count - 1);
  return { startsAt: toInputDate(start), endsAt: toInputDate(end) };
}

function toInputDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The generate-content route wraps copy in `{ data: { content, variations[] } }`. */
export function extractGeneratedLines(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const root = payload as Record<string, unknown>;
  const body =
    root.data && typeof root.data === 'object'
      ? (root.data as Record<string, unknown>)
      : root;
  const lines: string[] = [];
  if (typeof body.content === 'string' && body.content.trim()) {
    lines.push(body.content.trim());
  }
  if (Array.isArray(body.variations)) {
    for (const item of body.variations) {
      if (typeof item === 'string' && item.trim()) {
        lines.push(item.trim());
        continue;
      }
      if (
        item &&
        typeof item === 'object' &&
        typeof (item as { content?: unknown }).content === 'string'
      ) {
        const text = (item as { content: string }).content.trim();
        if (text) lines.push(text);
      }
    }
  }
  return [...new Set(lines)];
}
