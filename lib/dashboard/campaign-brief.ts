export type CampaignBrief = {
  name: string;
  job: string;
  audience: string;
  offer: string;
  proof: string;
  cta: string;
  place: string;
  avoid: string;
};

export function campaignBriefReady(brief: CampaignBrief): boolean {
  return [brief.name, brief.job, brief.audience, brief.offer, brief.cta].every(
    part => part.trim().length > 0
  );
}

/** Prompt the model from the brief — not from an empty “post 1”. */
export function campaignBriefTopic(brief: CampaignBrief): string {
  return [
    `Campaign: ${brief.name.trim()}`,
    `Job of this run: ${brief.job.trim()}`,
    `Who it is for: ${brief.audience.trim()}`,
    `What they get: ${brief.offer.trim()}`,
    brief.proof.trim() && `Why believe it: ${brief.proof.trim()}`,
    `What they should do: ${brief.cta.trim()}`,
    brief.place.trim() && `Where: ${brief.place.trim()}`,
    brief.avoid.trim() && `Do not say: ${brief.avoid.trim()}`,
    'Write one real social caption. No markdown. No heading. Sound like the shop.',
  ]
    .filter(Boolean)
    .join('\n');
}

export const EMPTY_CAMPAIGN_BRIEF: CampaignBrief = {
  name: '',
  job: '',
  audience: '',
  offer: '',
  proof: '',
  cta: '',
  place: '',
  avoid: '',
};
