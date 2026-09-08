/**
 * Phase 6 — light guidance on first-week empty / blocked states.
 * No product tour. No popup stack. Each surface answers what / why / next /
 * what good looks like in one or two lines.
 */

export type FirstWeekSurface =
  | 'home'
  | 'content'
  | 'calendar'
  | 'platforms'
  | 'campaigns'
  | 'analytics';

export type FirstWeekGuidance = {
  what: string;
  why: string;
  next: string;
  nextHref: string;
  nextLabel: string;
  goodLooksLike: string;
  empty: string;
};

export const FIRST_WEEK_SURFACES = [
  'home',
  'content',
  'calendar',
  'platforms',
  'campaigns',
  'analytics',
] as const satisfies readonly FirstWeekSurface[];

export const FIRST_WEEK_GUIDANCE: Record<FirstWeekSurface, FirstWeekGuidance> =
  {
    home: {
      what: 'This week is connect, write, book, then see results.',
      why: 'One place so you know what to do next without hunting rooms.',
      next: 'Write a draft in Content, or connect an account if nothing is Ready.',
      nextHref: '/dashboard/content',
      nextLabel: 'Write a post',
      goodLooksLike: 'One Scheduled post on Calendar.',
      empty:
        'Connect an account, write a draft, then schedule it. Good looks like one booked post on Calendar — nothing goes public until you say so.',
    },
    content: {
      what: 'Write or generate a draft, then save, schedule, or post.',
      why: 'Posts start as drafts so you can edit before anything is public.',
      next: 'Type what happened, generate or write, then Save or Schedule.',
      nextHref: '/dashboard/content',
      nextLabel: 'Write a draft',
      goodLooksLike: 'Words you would actually post.',
      empty:
        'No draft yet. Type what happened above, then generate or write. Good looks like words you would actually post.',
    },
    calendar: {
      what: 'See booked times and fix anything that failed.',
      why: 'A time on the week is how a draft becomes Scheduled.',
      next: 'Write a post in Content, then schedule it here.',
      nextHref: '/dashboard/content',
      nextLabel: 'Write a post',
      goodLooksLike: 'A time this week marked Scheduled.',
      empty:
        'Write a post in Content, then schedule it here. Good looks like a time this week marked Scheduled.',
    },
    platforms: {
      what: 'Connect one account until it shows Ready.',
      why: 'Ready is a green check. Without it, posts stay inside Synthex.',
      next: 'Tap Connect on a channel, or write a draft in Content first.',
      nextHref: '/dashboard/content',
      nextLabel: 'Write a draft anyway',
      goodLooksLike: 'A green check next to a connected account.',
      empty:
        'No account is ready yet. Tap Connect on Instagram or another channel. You can still write drafts in Content.',
    },
    campaigns: {
      what: 'A campaign is a named set of posts with dates.',
      why: 'You still edit and schedule each card — nothing goes out from this page on its own.',
      next: 'Name a run, write two cards, then schedule each one.',
      nextHref: '/dashboard/campaigns',
      nextLabel: 'New campaign',
      goodLooksLike: 'Two times on Calendar.',
      empty:
        'Name a run of posts, write two cards, then schedule each one. Good looks like two times on Calendar.',
    },
    analytics: {
      what: 'Numbers after posts have gone out.',
      why: 'There is nothing to measure until a few posts are published.',
      next: 'Write one in Content, book it on Calendar, then come back.',
      nextHref: '/dashboard/content',
      nextLabel: 'Write a post',
      goodLooksLike: 'Reach after a few published posts.',
      empty:
        "We'll show numbers after a few published posts. Write one in Content, book it on Calendar, then come back.",
    },
  };
