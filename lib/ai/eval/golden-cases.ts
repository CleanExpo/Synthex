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
};
