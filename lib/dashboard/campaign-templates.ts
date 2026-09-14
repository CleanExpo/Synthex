export type CampaignTemplate = {
  id: string;
  name: string;
  label: string;
  blurb: string;
  job: string;
  cards: number;
  launchWeek?: boolean;
};

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: 'walk-in',
    name: '',
    label: 'Get them in',
    blurb: 'A reason to walk through the door this week.',
    job: 'Get more people through the door this week',
    cards: 4,
  },
  {
    id: 'offer',
    name: '',
    label: 'Sell the offer',
    blurb: 'One thing they can buy or book before it ends.',
    job: 'Sell a time-limited offer without sounding like an ad',
    cards: 3,
  },
  {
    id: 'story',
    name: '',
    label: 'Earn trust',
    blurb: 'Proof first. Ask second.',
    job: 'Make a stranger trust the shop enough to try it',
    cards: 4,
  },
  {
    id: 'launch',
    name: 'Launch week',
    label: 'First week',
    blurb: 'Open, settle, invite. You still book each hour.',
    job: 'Introduce the shop and give people a reason to come twice',
    cards: 5,
    launchWeek: true,
  },
];
