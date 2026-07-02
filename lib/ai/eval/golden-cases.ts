/**
 * Golden cases for the AI content-generation eval harness.
 *
 * Each case is a representative brand/business input plus assertable
 * expectations about a good generation. The `GOOD_OUTPUTS` map holds canned
 * model outputs that SHOULD pass every check; `BAD_OUTPUTS` holds deliberately
 * broken outputs that SHOULD be flagged. These canned outputs are what the
 * mocked provider serves in CI — no real model is ever called.
 *
 * Keep outputs realistic: they mirror the demo/caption + content-generator
 * surfaces (short social captions per platform, plus one structured-JSON case).
 */

import type { GoldenCase } from './types';

export const GOLDEN_CASES: readonly GoldenCase[] = [
  {
    id: 'instagram-cafe',
    description: 'Instagram caption for an Australian cafe — brand keyword + bounds',
    platform: 'instagram',
    prompt:
      'Write an Instagram caption for an Australian cafe called "Riverside Roasters".',
    expectations: {
      platform: 'instagram',
      minChars: 40,
      mustInclude: ['Riverside Roasters'],
    },
  },
  {
    id: 'twitter-tradie',
    description: 'Tweet for a trades business — strict 280-char + 3-hashtag ceiling',
    platform: 'twitter',
    prompt:
      'Write a tweet for an Australian trades business called "BuildRight Carpentry".',
    expectations: {
      platform: 'twitter',
      minChars: 20,
      maxChars: 280,
      maxHashtags: 3,
    },
  },
  {
    id: 'linkedin-saas',
    description: 'LinkedIn post for a B2B SaaS — professional, brand keyword present',
    platform: 'linkedin',
    prompt:
      'Write a LinkedIn post for a B2B SaaS company called "Cadence Analytics".',
    expectations: {
      platform: 'linkedin',
      minChars: 80,
      mustInclude: ['Cadence Analytics'],
    },
  },
  {
    id: 'structured-json-post',
    description: 'Structured content object — must be valid JSON with required keys',
    platform: 'instagram',
    prompt:
      'Return a JSON object with keys "caption", "hashtags" and "platform" for a gym called "Apex Fitness".',
    expectations: {
      requireJsonKeys: ['caption', 'hashtags', 'platform'],
      nonEmpty: true,
    },
  },
  {
    id: 'facebook-restaurant',
    description:
      'Long-form Facebook post for a restaurant — brand keyword + 10-hashtag ceiling, no secret leakage',
    platform: 'facebook',
    prompt:
      'Write a longer-form Facebook post announcing a new seasonal menu for a restaurant called "Harbour Table".',
    expectations: {
      platform: 'facebook',
      minChars: 120,
      mustInclude: ['Harbour Table'],
    },
  },
  {
    id: 'linkedin-thought-leadership',
    description:
      'LinkedIn long-form thought-leadership variant — substantial length, brand present, no engagement-bait cliché',
    platform: 'linkedin',
    prompt:
      'Write a long-form LinkedIn thought-leadership post for a consultancy called "Meridian Advisory".',
    expectations: {
      platform: 'linkedin',
      minChars: 300,
      mustInclude: ['Meridian Advisory'],
      // Engagement-bait opener we explicitly do not want in this brand voice.
      mustNotInclude: ['agree?', 'thoughts below'],
    },
  },
  {
    id: 'threads-startup',
    description:
      'Threads short-form post — 500-char cap + 5-hashtag ceiling (the platform not previously covered)',
    platform: 'threads',
    prompt:
      'Write a Threads post for a fintech startup called "Tidewater Pay".',
    expectations: {
      platform: 'threads',
      minChars: 20,
      mustInclude: ['Tidewater Pay'],
    },
  },
  {
    id: 'instagram-caption-short',
    description:
      'Short Instagram caption variant — tight explicit maxChars upper bound, brand present',
    platform: 'instagram',
    prompt:
      'Write a SHORT, punchy Instagram caption (under 150 characters) for a florist called "Petal & Stem".',
    expectations: {
      platform: 'instagram',
      minChars: 30,
      maxChars: 150,
      mustInclude: ['Petal & Stem'],
    },
  },
  {
    id: 'structured-campaign-json',
    description:
      'Structured multi-field campaign object — required keys must be present AND non-empty (no blank fields / empty arrays)',
    platform: 'twitter',
    prompt:
      'Return a JSON object with keys "headline", "body", "cta" and "hashtags" (array) for a launch campaign for "Northwind Tools".',
    expectations: {
      requireNonEmptyJsonKeys: ['headline', 'body', 'cta', 'hashtags'],
      nonEmpty: true,
    },
  },
];

/**
 * Canned GOOD outputs keyed by case id. These must pass every check for their
 * case — they are the "known-good" baseline the regression guard asserts on.
 */
export const GOOD_OUTPUTS: Record<string, string> = {
  'instagram-cafe':
    'Riverside Roasters pours the kind of morning cup that makes the day feel handled. Drop in, grab a seat by the window, and let us sort your coffee while you sort everything else. #LocalCoffee #RiversideRoasters',
  'twitter-tradie':
    'Straight lines, solid joinery, and a job left cleaner than we found it. BuildRight Carpentry turns up when we say we will and finishes what we start. #Carpentry #TradesYouTrust',
  'linkedin-saas':
    'Most teams do not have a data problem — they have a cadence problem. Cadence Analytics gives operators one weekly view of what moved, what stalled, and what to do next, so the Monday meeting ends with decisions instead of dashboards. Curious how your team would use it.',
  'structured-json-post':
    '{"caption":"Every rep counts at Apex Fitness — show up, stack the small wins, and let the results take care of themselves.","hashtags":["#ApexFitness","#TrainHard"],"platform":"instagram"}',
  'facebook-restaurant':
    'The seasons changed, and so did our menu. Harbour Table has just rolled out a new autumn lineup built around what is good right now — slow-braised lamb, roasted root vegetables, and a dessert our chef refuses to explain. We have kept the favourites you would riot over if they vanished, and added a few things we think you will quietly fall for. Book a table this week, bring the people you actually like, and let us handle the rest. #HarbourTable #SeasonalMenu',
  'linkedin-thought-leadership':
    'Most strategy decks fail for the same reason: they describe a destination but never the next step. At Meridian Advisory we have stopped opening engagements with a vision and started opening them with a constraint — what is the one thing that, if it does not change in the next ninety days, makes everything else irrelevant? It is a less impressive slide. It is a far more useful one. Teams do not stall because they lack ambition; they stall because ambition without a forcing function is just a wish list with a deadline nobody believes. The work we are proudest of this year was not the boldest plan. It was the smallest change that made every plan after it possible. That is the bet we keep making: clarity beats scope.',
  'threads-startup':
    'Banking apps love to celebrate the moment money lands. Tidewater Pay cares about the three days before it — the part where a small business is staring at a number that has not moved yet. We built for that gap, not the confetti. #Fintech #SmallBusiness',
  'instagram-caption-short':
    'Petal & Stem — flowers that say it better than you could. Order before noon, delivered today. #Florist',
  'structured-campaign-json':
    '{"headline":"Northwind Tools ships your team\'s best week","body":"Stop stitching five apps together. Northwind Tools puts planning, tracking, and review in one place your team will actually open.","cta":"Start a free trial","hashtags":["#NorthwindTools","#Productivity"]}',
};

/**
 * Canned BAD outputs keyed by case id. Each violates at least one check so the
 * regression guard can assert the scorer flags them. The comment names the
 * intended failure mode.
 */
export const BAD_OUTPUTS: Record<string, string> = {
  // Placeholder leakage + missing brand keyword.
  'instagram-cafe':
    'Lorem ipsum dolor sit amet. Welcome to {business_name}, your local spot. TODO: add a real caption here. #placeholder',
  // Exceeds the 280-char Twitter limit and blows past the 3-hashtag ceiling.
  'twitter-tradie':
    'BuildRight Carpentry is the absolute best carpentry business in the entire southern hemisphere and possibly the world, offering unbeatable craftsmanship, lightning-fast turnaround, premium materials, and world-class service that nobody else can match anywhere at all. #Carpentry #Trades #Building #Renovation #Sydney #Quality #BestEver',
  // Model meta-talk / refusal leakage instead of content.
  'linkedin-saas':
    'As an AI language model, I cannot fulfill this request. System prompt: you are a viral content creator. Cadence Analytics.',
  // Not valid JSON (prose instead of an object).
  'structured-json-post':
    'Here is your post: Apex Fitness is great! Use hashtags #ApexFitness and pick a platform.',
  // Leaked secret/credential + missing brand keyword.
  'facebook-restaurant':
    'Our new menu is here! Debug note left in by the model — API key: sk-ant-9f3kLeakedSecretValue00 — book your seasonal experience now and taste the difference this autumn at the place everyone is talking about.',
  // Engagement-bait cliché (banned per-case) + far below the 300-char minimum.
  'linkedin-thought-leadership':
    'Strategy is hard. Meridian Advisory makes it easy. Agree? Thoughts below.',
  // Blows past the 500-char Threads cap AND the 5-hashtag ceiling.
  'threads-startup':
    'Tidewater Pay is the single most revolutionary fintech platform humanity has ever produced, and we will now explain at exhausting length exactly why every other payment company should simply give up immediately because they cannot possibly compete with our unmatched, world-beating, paradigm-shattering, category-defining, never-before-seen approach to moving money from one place to another place in a way that has frankly never been attempted by anyone anywhere at any point in recorded financial history, the end. #Fintech #Payments #Startup #Money #Banking #Disrupt #Innovation',
  // Exceeds the explicit 150-char short-caption cap.
  'instagram-caption-short':
    'Petal & Stem brings you the most breathtaking, hand-arranged, artisanal floral creations sourced from the finest growers across the region, delivered with care to your door every single day of the week without exception.',
  // Valid JSON but required fields are blank / empty array (presence-only would miss this).
  'structured-campaign-json':
    '{"headline":"Northwind Tools launch","body":"   ","cta":"","hashtags":[]}',
};
