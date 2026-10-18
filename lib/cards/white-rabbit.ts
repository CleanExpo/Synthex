/**
 * Digital business card — "Follow the White Rabbit: The Missing Signal".
 *
 * Content and rules live here so every change is reviewed in a PR. Nothing in
 * this file is approved for a live pilot: `contentStatus`, `solve.status`,
 * `solve.prize.approved` and `solve.music.rightsConfirmed` say so, and the UI
 * reads them. The two front-door variants offer the SAME needs and actions;
 * only the framing differs, so a later comparison is fair.
 */
import type { ExperimentSpec } from '@/lib/learning-loop/summary';

export interface CardNeed {
  id: string;
  label: string;
  action: string;
  why: string;
}

export interface CardVariantCopy {
  heading: string;
  intro: string;
  discoverLabel: string;
}

export interface CardConfig {
  slug: string;
  contentStatus: 'draft-pending-owner-review' | 'approved';
  variants: Record<'story' | 'plain', CardVariantCopy>;
  needs: CardNeed[];
  solve: {
    status: 'unconfirmed' | 'approved';
    entryRequirements: string[];
    trustClues: string[];
    prize: {
      approved: boolean;
      description: string | null;
      rules: string | null;
    };
    music: { rightsConfirmed: boolean; track: string | null };
  };
  experiment: ExperimentSpec;
}

export const WHITE_RABBIT_CARD: CardConfig = {
  slug: 'phill',
  contentStatus: 'draft-pending-owner-review',
  variants: {
    story: {
      heading: 'Follow the White Rabbit',
      intro:
        'Every business is missing one signal. Tell me where it hurts and I will hand you the next move, no strings.',
      discoverLabel: 'Find my missing signal',
    },
    plain: {
      heading: 'Phill McGurk — Unite-Group',
      intro:
        'Pick what you need help with and get one practical step you can do this week. No email needed.',
      discoverLabel: 'Get one practical step',
    },
  },
  needs: [
    {
      id: 'maps',
      label: 'Locals cannot find me on Google Maps',
      action:
        'Open your Google Business Profile, set the primary category to the job you most want, and add five photos of real recent jobs this week.',
      why: 'The primary category and fresh real photos are the parts of your profile you control fully.',
    },
    {
      id: 'reviews',
      label: 'I do not get enough reviews',
      action:
        'Text each customer your direct review link on the day you finish the job, in one plain sentence. Never offer anything in return.',
      why: 'Asking while the job is fresh is the habit most businesses skip, and incentives break Google’s review rules.',
    },
    {
      id: 'calls',
      label: 'My website does not bring in calls',
      action:
        'Put your phone number as a tap-to-call link at the top of every page, then test it from your own phone.',
      why: 'Most local visitors are on a phone; a number they cannot tap is a call you lose.',
    },
    {
      id: 'tracking',
      label: 'I am not sure my marketing works',
      action:
        'For the next four weeks, ask every new customer “How did you find us?” and write the answer down before you spend another dollar.',
      why: 'A month of real answers tells you more than any dashboard you have not set up yet.',
    },
  ],
  solve: {
    status: 'unconfirmed',
    entryRequirements: [
      'Open to people at the event in person.',
      'Marketing updates are a separate, optional choice and never affect your chances.',
      'Sharing, feedback or a review never affect your chances. We never ask for a Google review.',
    ],
    trustClues: [],
    prize: { approved: false, description: null, rules: null },
    music: { rightsConfirmed: false, track: null },
  },
  experiment: {
    id: 'exp-white-rabbit-front-door',
    variants: ['story', 'plain'],
    randomised: true,
    minSessionsPerVariant: 60,
    keepThreshold: 0.5,
    stopThreshold: 0.25,
    maxAccessibilityIssueRate: 0.05,
    maxConfusionRate: 0.1,
    deliveryCostCentsPerSession: 0,
  },
};

const CARDS: Record<string, CardConfig> = {
  [WHITE_RABBIT_CARD.slug]: WHITE_RABBIT_CARD,
};

export function getCardConfig(slug: string): CardConfig | null {
  return Object.prototype.hasOwnProperty.call(CARDS, slug) ? CARDS[slug] : null;
}

export function getExperimentSpec(experimentId: string): ExperimentSpec | null {
  return (
    Object.values(CARDS).find(c => c.experiment.id === experimentId)
      ?.experiment ?? null
  );
}
