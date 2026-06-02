export const CCW_EOFY_CAMPAIGN_SLUG = 'ccw-eofy-sales-2026';
export const CCW_EOFY_CAMPAIGN_NAME = 'CCW EOFY Sales Acceleration 2026';

export type CcwEofyCalendarSlot = {
  id: string;
  date: string;
  timeAest: string;
  platforms: string[];
  title: string;
  objective: string;
  content: string;
  cta: string;
  hashtags: string[];
  assetBrief: string;
  gate: string;
};

export const ccwEofySourceUrls = [
  'https://ccwonline.com.au/',
  'https://ccwonline.com.au/collections/airmovers/products/dry-air-gale-force-axial-airmover',
  'https://ccwonline.com.au/products/xpower-low-profile-airmover',
  'https://ccwonline.com.au/products/dri-eaz-velo-low-profile-air-mover',
  'https://ccwonline.com.au/collections/airmovers/products/razorback-aam-pro-axial-air-mover',
  'https://ccwonline.com.au/pages/finance-options',
] as const;

export const ccwEofyCampaignCalendar: CcwEofyCalendarSlot[] = [
  {
    id: 'ccw-eofy-2026-06-03-linkedin-audit',
    date: '2026-06-03',
    timeAest: '10:00',
    platforms: ['linkedin'],
    title: 'EOFY equipment audit opener',
    objective: 'Open the campaign with a practical business-owner audit angle.',
    content:
      'EOFY planning is the right time to find the gear that is slowing down cleaning and restoration jobs. Audit extraction, drying, moisture checks, hoses, chemicals, and backups before buying anything new. CCW can help turn that audit into a practical equipment shortlist.',
    cta: 'Review the CCW EOFY equipment shortlist and speak with the team.',
    hashtags: ['#EOFYPlanning', '#CleaningIndustry', '#RestorationIndustry'],
    assetBrief:
      'Simple checklist graphic: Audit, Shortlist, Confirm Stock, Ask Finance.',
    gate: 'No discount or finance approval claim without CCW confirmation. Credentials required before posting.',
  },
  {
    id: 'ccw-eofy-2026-06-03-facebook-launch',
    date: '2026-06-03',
    timeAest: '16:00',
    platforms: ['facebook'],
    title: 'EOFY shortlist launch',
    objective: 'Drive operators to start a CCW equipment shortlist.',
    content:
      'EOFY is the practical time to tighten up the gear that makes every job smoother. Use this week to shortlist the machines, air movers, meters, hoses, chemicals, and accessories your team actually needs before June gets louder.',
    cta: 'Build your EOFY equipment shortlist with CCW.',
    hashtags: ['#EOFY', '#CarpetCleaning', '#RestorationEquipment', '#CCW'],
    assetBrief:
      'Square product-range collage using approved CCW product imagery only.',
    gate: 'Use current CCW range and listed sale pricing only. No invented sitewide EOFY sale.',
  },
  {
    id: 'ccw-eofy-2026-06-04-instagram-gear-check',
    date: '2026-06-04',
    timeAest: '11:00',
    platforms: ['instagram'],
    title: 'EOFY gear check reel',
    objective: 'Create a fast checklist post for visual engagement.',
    content:
      'EOFY gear check: machines, dryers, meters, chemicals, hoses, and the job-site essentials that stop small problems becoming slow jobs. Save this and get the upgrade list moving before June disappears.',
    cta: 'Tap through to build the CCW EOFY shortlist.',
    hashtags: [
      '#EOFY',
      '#CarpetCleaningBusiness',
      '#Restoration',
      '#CleaningEquipment',
    ],
    assetBrief:
      '15 second reel: five quick cuts of approved equipment categories with checklist captions.',
    gate: 'Confirm all shown product images are approved CCW assets before paid or boosted use.',
  },
  {
    id: 'ccw-eofy-2026-06-05-reddit-checklist',
    date: '2026-06-05',
    timeAest: '09:00',
    platforms: ['reddit'],
    title: 'Community-safe audit checklist',
    objective:
      'Provide useful trade advice without hard-selling in communities.',
    content:
      'For operators doing EOFY planning: audit the equipment that slows jobs down before buying anything new. Check extraction performance, drying coverage, moisture meters, hoses, wands, sprayers, and backup consumables. Buy only what removes a real operational bottleneck.',
    cta: 'Use the checklist internally before talking to a supplier.',
    hashtags: ['EOFY', 'carpetcleaning', 'restoration'],
    assetBrief:
      'Text-first Reddit post. No sales graphic unless subreddit rules clearly allow it.',
    gate: 'Only post in communities that allow supplier participation. Disclose commercial connection.',
  },
  {
    id: 'ccw-eofy-2026-06-08-facebook-xpower',
    date: '2026-06-08',
    timeAest: '13:00',
    platforms: ['facebook'],
    title: 'Low-profile air mover focus',
    objective: 'Use a verified sale product as a practical drying-stack hook.',
    content:
      'Drying coverage is one of the first places an EOFY equipment audit pays off. The XPOWER Low Profile Air Mover PL700A is listed by CCW with stackable storage, three speeds, built-in power outlet support, and a current listed sale price.',
    cta: 'Check current stock and pricing with CCW before adding it to your shortlist.',
    hashtags: ['#AirMover', '#RestorationEquipment', '#EOFY'],
    assetBrief:
      'Product tile with feature bullets: low profile, stackable, 3 speeds, sale listed.',
    gate: 'Price and stock must be checked on publish day. Do not imply sale duration unless CCW confirms it.',
  },
  {
    id: 'ccw-eofy-2026-06-09-linkedin-finance',
    date: '2026-06-09',
    timeAest: '10:00',
    platforms: ['linkedin'],
    title: 'Finance-aware equipment planning',
    objective: 'Position finance as an enquiry path, not an approval promise.',
    content:
      'The strongest EOFY equipment plan starts with operational need, then checks stock, pricing, and finance options. CCW points customers to Equipped Commercial Finance for equipment finance discussions across rental, lease, and chattel mortgage options.',
    cta: 'Shortlist the gear first, then speak with CCW about the right pathway.',
    hashtags: ['#EquipmentFinance', '#EOFYPlanning', '#CleaningBusiness'],
    assetBrief:
      'LinkedIn text card: Shortlist first. Finance enquiry second. Approval claims never assumed.',
    gate: 'Do not claim approval, rates, repayment amounts, or tax outcomes. Direct users to CCW/finance contact.',
  },
  {
    id: 'ccw-eofy-2026-06-10-instagram-drying-stack',
    date: '2026-06-10',
    timeAest: '14:00',
    platforms: ['instagram'],
    title: 'Drying stack carousel',
    objective: 'Turn product range into a practical restoration workflow.',
    content:
      'A stronger drying stack is not just more fans. Think extraction, air movement, moisture readings, layout, and backup gear. EOFY is a good time to remove the weak link before the next urgent job.',
    cta: 'Save the checklist and review the CCW drying range.',
    hashtags: ['#WaterDamageRestoration', '#AirMovers', '#EOFY'],
    assetBrief:
      '5-slide carousel: Extract, Move Air, Measure, Adjust, Restock.',
    gate: 'Keep claims operational. Avoid guaranteed drying-time statements.',
  },
  {
    id: 'ccw-eofy-2026-06-11-facebook-gale-force',
    date: '2026-06-11',
    timeAest: '16:00',
    platforms: ['facebook'],
    title: 'Dry Air Gale Force spotlight',
    objective: 'Highlight a premium drying product with verified features.',
    content:
      'If drying jobs are stretching your crew, air movement belongs on the EOFY shortlist. CCW lists the Dry Air Technology Gale Force Axial Air Mover with two speeds, stackable storage, low amp draw, and daisy-chain capability.',
    cta: 'Check the Dry Air Gale Force details with CCW.',
    hashtags: ['#DryingEquipment', '#Restoration', '#EOFY'],
    assetBrief:
      'Product feature tile using approved Gale Force image and three feature chips.',
    gate: 'Verify current page details before posting. Do not compare against named competitors.',
  },
  {
    id: 'ccw-eofy-2026-06-13-reddit-drying-bottlenecks',
    date: '2026-06-13',
    timeAest: '09:30',
    platforms: ['reddit'],
    title: 'Drying bottleneck discussion',
    objective: 'Start a useful operator discussion without direct selling.',
    content:
      'Question for restoration operators doing EOFY planning: where do drying jobs usually bottleneck for you? Air mover count, layout, moisture readings, dehumidification, access, or backup gear? The useful spend is usually the item that removes the most repeat friction.',
    cta: 'Use replies to inform the final CCW EOFY FAQ post.',
    hashtags: ['restoration', 'airmovers', 'EOFY'],
    assetBrief: 'Text-only discussion prompt.',
    gate: 'Community rules first. If supplier participation is not welcome, do not post.',
  },
  {
    id: 'ccw-eofy-2026-06-15-linkedin-midmonth',
    date: '2026-06-15',
    timeAest: '10:00',
    platforms: ['linkedin'],
    title: 'Mid-month operational bottleneck post',
    objective: 'Shift from product browsing to operational return.',
    content:
      'The middle of June is the point to turn the EOFY list into decisions. Rank upgrades by job impact: fewer delays, faster setup, cleaner handover, safer backup, and less time lost chasing parts or consumables.',
    cta: 'Send CCW the shortlist and ask what is practical to source now.',
    hashtags: ['#Operations', '#EOFY', '#CleaningBusiness'],
    assetBrief:
      'LinkedIn checklist card: Impact, Availability, Compatibility, Finance Enquiry, Approval.',
    gate: 'No tax advice. Keep value framed as operational impact.',
  },
  {
    id: 'ccw-eofy-2026-06-16-instagram-consumables',
    date: '2026-06-16',
    timeAest: '11:00',
    platforms: ['instagram'],
    title: 'Consumables restock angle',
    objective: 'Broaden campaign beyond capital equipment.',
    content:
      'EOFY is not only machines. Chemicals, rinses, spotters, deodorisers, hoses, wands, sprayers, and backup parts are the small items that can decide whether a job runs smoothly.',
    cta: 'Check the CCW range and restock the items your crew keeps reaching for.',
    hashtags: ['#CleaningSupplies', '#CarpetCleaning', '#EOFY'],
    assetBrief:
      'Flat-lay style product category graphic. Use approved CCW/Razorback imagery only.',
    gate: 'Do not feature chemical performance claims unless sourced from the product page.',
  },
  {
    id: 'ccw-eofy-2026-06-18-facebook-razorback-aam',
    date: '2026-06-18',
    timeAest: '16:00',
    platforms: ['facebook'],
    title: 'Razorback AAM Pro spotlight',
    objective: 'Promote another verified listed air mover option.',
    content:
      'For structural drying and clean-water-loss workflows, air mover setup matters. CCW lists the Razorback AAM Pro Axial Air Mover as a current sale item for restoration operators reviewing their drying stack.',
    cta: 'Review the Razorback AAM Pro details with CCW.',
    hashtags: ['#Razorback', '#RestorationEquipment', '#EOFY'],
    assetBrief:
      'Product tile: sale listed, axial air mover, drying stack review.',
    gate: 'Confirm sale price and availability on publish day. Avoid unsupported performance guarantees.',
  },
  {
    id: 'ccw-eofy-2026-06-22-linkedin-final-week',
    date: '2026-06-22',
    timeAest: '10:00',
    platforms: ['linkedin'],
    title: 'Final full week decision post',
    objective: 'Create urgency without false scarcity.',
    content:
      'The final full week of June is the moment to stop browsing and finalise the shortlist. Confirm the equipment that solves real job bottlenecks, check stock and pricing, and get internal approval before the EOFY rush peaks.',
    cta: 'Send the CCW team your shortlist for practical next steps.',
    hashtags: ['#EOFY', '#EquipmentPlanning', '#RestorationIndustry'],
    assetBrief:
      'Countdown-style LinkedIn graphic: Final full week to finalise the shortlist.',
    gate: 'Use calendar urgency only. Do not invent limited stock or deadline claims.',
  },
  {
    id: 'ccw-eofy-2026-06-23-instagram-final-week',
    date: '2026-06-23',
    timeAest: '14:00',
    platforms: ['instagram'],
    title: 'Final week reel',
    objective: 'Drive reminder engagement and saves.',
    content:
      'Final full week checklist: audit the gear, confirm the weak links, check current pricing, ask about finance pathways, and get the shortlist moving before June closes.',
    cta: 'Save this and message CCW with the gear you are reviewing.',
    hashtags: ['#EOFYChecklist', '#CleaningEquipment', '#Restoration'],
    assetBrief:
      'Short checklist reel with one step per frame and approved product category visuals.',
    gate: 'No auto-DM or platform automation until credentials are supplied and approved.',
  },
  {
    id: 'ccw-eofy-2026-06-24-facebook-finance-reminder',
    date: '2026-06-24',
    timeAest: '13:00',
    platforms: ['facebook'],
    title: 'Finance enquiry reminder',
    objective: 'Prompt operators who need a finance conversation.',
    content:
      'If the shortlist is bigger than this month can comfortably absorb, ask CCW about the finance pathway before leaving the decision too late. Keep the plan practical: gear first, business fit second, finance discussion third.',
    cta: 'Talk to CCW about the right next step for your shortlist.',
    hashtags: ['#EOFY', '#EquipmentFinance', '#CleaningBusiness'],
    assetBrief: 'Simple graphic: Shortlist, Stock, Finance Enquiry, Approval.',
    gate: 'No repayment, approval, rate, or tax claims. Finance terms need provider confirmation.',
  },
  {
    id: 'ccw-eofy-2026-06-25-reddit-final-checklist',
    date: '2026-06-25',
    timeAest: '09:00',
    platforms: ['reddit'],
    title: 'Final checklist community post',
    objective: 'Provide high-value checklist content late in the month.',
    content:
      'Final EOFY equipment checklist for cleaning/restoration operators: what item would cause the most pain if it failed next month, what consumable keeps running short, what drying setup bottleneck repeats, and what purchase needs stock or finance confirmation before it is realistic?',
    cta: 'Use the answers to prioritise your final shortlist.',
    hashtags: ['EOFY', 'restoration', 'carpetcleaning'],
    assetBrief: 'Text-only checklist. No promotional image.',
    gate: 'Educational only. Do not include sales language in strict trade communities.',
  },
  {
    id: 'ccw-eofy-2026-06-26-linkedin-finalise',
    date: '2026-06-26',
    timeAest: '10:00',
    platforms: ['linkedin', 'facebook'],
    title: 'Finalise the shortlist',
    objective: 'Push decision-ready operators to contact CCW.',
    content:
      'The best EOFY equipment decision is the one tied to a repeat operational problem. If a machine, air mover, meter, hose, chemical, or accessory removes a known bottleneck, now is the time to confirm the details with CCW.',
    cta: 'Finalise the shortlist with CCW before 30 June.',
    hashtags: ['#EOFY', '#CleaningEquipment', '#RestorationEquipment'],
    assetBrief:
      'Cross-platform static graphic: Finalise the gear that removes bottlenecks.',
    gate: 'Confirm final wording with CCW before publishing across both platforms.',
  },
  {
    id: 'ccw-eofy-2026-06-29-final-48',
    date: '2026-06-29',
    timeAest: '09:00',
    platforms: ['facebook', 'instagram'],
    title: 'Final 48 hour reminder',
    objective: 'Create legitimate calendar urgency before EOFY ends.',
    content:
      'EOFY closes tomorrow. If your shortlist is still sitting in a note, send it through and confirm what is practical now. Focus on the gear that removes friction from real jobs.',
    cta: 'Send the CCW team your shortlist today.',
    hashtags: ['#EOFY', '#CCW', '#CleaningEquipment'],
    assetBrief:
      'Countdown graphic for feed and story. Use June 30 calendar urgency only.',
    gate: 'No stock scarcity or discount deadline claims unless CCW confirms them in writing.',
  },
  {
    id: 'ccw-eofy-2026-06-30-final-day',
    date: '2026-06-30',
    timeAest: '08:30',
    platforms: ['linkedin', 'facebook', 'instagram'],
    title: 'EOFY final day',
    objective: 'Close the campaign with an action-oriented final-day post.',
    content:
      'Final day of EOFY. If an upgrade is already justified by the jobs you do every week, use today to confirm the details with CCW. Keep it practical, sourced, and tied to operational need.',
    cta: 'Contact CCW to confirm the final shortlist.',
    hashtags: ['#EOFY', '#CleaningIndustry', '#RestorationIndustry'],
    assetBrief:
      'Final-day graphic adapted to LinkedIn, Facebook, and Instagram sizes.',
    gate: 'Human approval required before posting. Credentials and platform connections still required.',
  },
];

export function ccwEofyScheduledAtUtc(slot: CcwEofyCalendarSlot): Date {
  const [year, month, day] = slot.date.split('-').map(Number);
  const [hour, minute] = slot.timeAest.split(':').map(Number);

  // calendar_posts.scheduled_for is timestamp without time zone. Store the
  // intended AEST wall-clock value so app/API reads display at the right time.
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
}
