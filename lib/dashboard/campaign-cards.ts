/**
 * A campaign is a named set of posts. Cards come from real posts
 * or from the campaign content JSON until they are scheduled.
 */

export interface CampaignCard {
  key: string;
  text: string;
  platform: string;
  postId?: string;
  status?: string;
  skipped?: boolean;
}

export function parseCampaignCards(campaign: {
  platform: string;
  content?: unknown;
  posts?: Array<{
    id: string;
    content?: string | null;
    status: string;
    platform: string;
  }>;
}): CampaignCard[] {
  const fromPosts = (campaign.posts ?? [])
    .filter(p => (p.content ?? '').trim().length > 0)
    .map(p => ({
      key: p.id,
      text: p.content as string,
      platform: p.platform || campaign.platform,
      postId: p.id,
      status: p.status,
    }));
  if (fromPosts.length > 0) return fromPosts;

  const raw = campaign.content;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      return cardsFromJson(JSON.parse(trimmed), campaign.platform);
    } catch {
      return [
        {
          key: 'legacy',
          text: trimmed,
          platform: campaign.platform,
        },
      ];
    }
  }
  if (raw && typeof raw === 'object') {
    return cardsFromJson(raw, campaign.platform);
  }
  return [];
}

function cardsFromJson(value: unknown, platform: string): CampaignCard[] {
  if (!value || typeof value !== 'object') return [];
  const cards = (value as { cards?: unknown }).cards;
  if (!Array.isArray(cards)) return [];
  return cards
    .map((card, i): CampaignCard | null => {
      if (!card || typeof card !== 'object') return null;
      const text = String((card as { text?: unknown }).text ?? '').trim();
      if (!text) return null;
      const skipped = Boolean((card as { skipped?: unknown }).skipped);
      return {
        key: `card-${i}`,
        text,
        platform:
          String((card as { platform?: unknown }).platform ?? platform) ||
          platform,
        skipped,
      };
    })
    .filter((c): c is CampaignCard => c !== null);
}

export function serializeCampaignCards(cards: CampaignCard[]): string {
  return JSON.stringify({
    cards: cards.map(c => ({
      text: c.text,
      platform: c.platform,
      skipped: c.skipped ?? false,
    })),
  });
}
