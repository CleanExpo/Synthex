export type CampaignHealth = {
  total: number;
  draft: number;
  scheduled: number;
  posted: number;
  failed: number;
  bookedPercent: number;
};

export function campaignHealth(
  cards: Array<{ status?: string | null }>
): CampaignHealth {
  const total = cards.length;
  let draft = 0;
  let scheduled = 0;
  let posted = 0;
  let failed = 0;

  for (const card of cards) {
    const status = (card.status ?? 'draft').toLowerCase();
    if (status === 'published' || status === 'posted') posted += 1;
    else if (status === 'scheduled') scheduled += 1;
    else if (status === 'failed') failed += 1;
    else draft += 1;
  }

  const booked = scheduled + posted;
  return {
    total,
    draft,
    scheduled,
    posted,
    failed,
    bookedPercent: total === 0 ? 0 : Math.round((booked / total) * 100),
  };
}

export function matchesCampaignQuery(name: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return name.toLowerCase().includes(q);
}
