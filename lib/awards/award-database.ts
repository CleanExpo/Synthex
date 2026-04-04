/**
 * Award Database — Curated Award Templates (Phase 94)
 *
 * A hand-curated list of Australian and global industry awards suitable for
 * marketing, technology, and SaaS companies. Used to pre-populate the award
 * tracker with high-value submission targets.
 *
 * @module lib/awards/award-database
 */

export interface AwardTemplate {
  name: string;
  organizer: string;
  url: string;
  category: string;
  typicalDeadline: string;   // e.g. "March–April annually"
  entryFee: 'Free' | 'Paid';
  industry: string[];        // relevant industries
  country: 'Australia' | 'Global';
  description: string;
}

export const AWARD_TEMPLATES: AwardTemplate[] = [
  // ─── Australian Awards ────────────────────────────────────────────────────
  {
    name: 'ABA100 Australian Business Award — Technology',
    organizer: 'Australian Business Awards',
    url: 'https://www.australianbusinessawards.com.au',
    category: 'Technology',
    typicalDeadline: 'May–June annually',
    entryFee: 'Free',
    industry: ['Technology', 'SaaS', 'Marketing'],
    country: 'Australia',
    description: 'Recognises Australian businesses demonstrating excellence in technology innovation and business performance.',
  },
  {
    name: 'AIMIA Digital Industry Awards',
    organizer: 'Australian Interactive Media Industry Association',
    url: 'https://www.aimia.com.au/awards',
    category: 'Digital Innovation',
    typicalDeadline: 'August–September annually',
    entryFee: 'Paid',
    industry: ['Digital', 'Marketing', 'Media', 'Technology'],
    country: 'Australia',
    description: 'Australia\'s premier digital industry awards recognising excellence in digital marketing, platforms, and campaigns.',
  },
  {
    name: 'Australian Startup Awards — Best MarTech',
    organizer: 'Australian Startup Awards',
    url: 'https://www.australianstartupawards.com',
    category: 'Best MarTech',
    typicalDeadline: 'April–May annually',
    entryFee: 'Free',
    industry: ['Startup', 'Marketing Technology', 'SaaS'],
    country: 'Australia',
    description: 'Celebrates the best startups in Australia across sectors including marketing technology and B2B SaaS.',
  },
  {
    name: 'Deloitte Technology Fast 50',
    organizer: 'Deloitte Australia',
    url: 'https://www2.deloitte.com/au/fast50',
    category: 'Fastest Growing Technology Companies',
    typicalDeadline: 'May–August annually',
    entryFee: 'Free',
    industry: ['Technology', 'SaaS', 'Software'],
    country: 'Australia',
    description: 'Ranks Australia\'s 50 fastest growing technology companies by percentage revenue growth over three years.',
  },
  {
    name: 'AIIA iAwards — Software & SaaS',
    organizer: 'Australian Information Industry Association',
    url: 'https://www.aiia.com.au/iawards',
    category: 'Software & SaaS',
    typicalDeadline: 'May–June annually',
    entryFee: 'Paid',
    industry: ['Software', 'SaaS', 'Technology', 'AI'],
    country: 'Australia',
    description: 'Australia\'s most prestigious ICT industry recognition program, celebrating innovation across software, AI, and digital services.',
  },
  {
    name: 'AFR BOSS Most Innovative Companies',
    organizer: 'Australian Financial Review',
    url: 'https://www.afr.com/boss/innovation',
    category: 'Technology & Services',
    typicalDeadline: 'January–February annually',
    entryFee: 'Free',
    industry: ['Technology', 'Innovation', 'SaaS', 'Marketing'],
    country: 'Australia',
    description: 'AFR BOSS ranks Australia\'s most innovative companies across all industries, with specific technology and services categories.',
  },
  {
    name: 'StartupAUS Advance Awards',
    organizer: 'StartupAUS',
    url: 'https://www.startupaus.org',
    category: 'Emerging Technology',
    typicalDeadline: 'September–October annually',
    entryFee: 'Free',
    industry: ['Startup', 'Technology', 'AI', 'SaaS'],
    country: 'Australia',
    description: 'Celebrates the achievements of Australian startups driving innovation and economic growth.',
  },
  {
    name: 'Marketing Excellence Awards — Martech',
    organizer: 'Marketing Association Australia',
    url: 'https://www.ama.com.au/awards',
    category: 'MarTech & Marketing Automation',
    typicalDeadline: 'March–April annually',
    entryFee: 'Paid',
    industry: ['Marketing', 'MarTech', 'Automation'],
    country: 'Australia',
    description: 'Recognises excellence in marketing technology, automation, and data-driven marketing campaigns.',
  },
  {
    name: 'Anthill Smart 100',
    organizer: 'Anthill Magazine',
    url: 'https://anthillonline.com/smart100',
    category: 'Innovative Products & Services',
    typicalDeadline: 'June–August annually',
    entryFee: 'Free',
    industry: ['Innovation', 'Technology', 'Business', 'SaaS'],
    country: 'Australia',
    description: 'Anthill\'s annual ranking of the 100 most innovative products and services from Australian companies.',
  },
  {
    name: 'CGW Women in Technology Awards',
    organizer: 'CRN Australia',
    url: 'https://www.crn.com.au/awards',
    category: 'Best Product — Cloud/SaaS',
    typicalDeadline: 'June–July annually',
    entryFee: 'Free',
    industry: ['Technology', 'Cloud', 'SaaS'],
    country: 'Australia',
    description: 'CRN recognises Australia\'s leading technology vendors, distributors, and solution providers.',
  },

  // ─── Global Awards ────────────────────────────────────────────────────────
  {
    name: 'Webby Awards — Apps, Mobile & Voice — AI',
    organizer: 'The International Academy of Digital Arts and Sciences',
    url: 'https://www.webbyawards.com',
    category: 'AI, Robotics & Automation',
    typicalDeadline: 'December–January annually',
    entryFee: 'Paid',
    industry: ['AI', 'Technology', 'Digital', 'SaaS'],
    country: 'Global',
    description: 'The leading international awards programme honouring excellence on the internet, including dedicated AI and automation categories.',
  },
  {
    name: 'G2 Best Software Awards',
    organizer: 'G2',
    url: 'https://www.g2.com/best-software-companies',
    category: 'Marketing Software',
    typicalDeadline: 'Data-driven — review-based, no submission deadline',
    entryFee: 'Free',
    industry: ['SaaS', 'Marketing Software', 'Technology'],
    country: 'Global',
    description: 'G2\'s annual Best Software Awards are based on authentic user reviews — claim your listing and accumulate reviews to qualify.',
  },
  {
    name: 'Clutch Top Companies — Marketing Automation',
    organizer: 'Clutch',
    url: 'https://clutch.co',
    category: 'Marketing Automation Software',
    typicalDeadline: 'Review-based — no submission deadline',
    entryFee: 'Free',
    industry: ['Marketing', 'SaaS', 'Automation'],
    country: 'Global',
    description: 'Clutch recognises top B2B service providers based on client reviews. Claim your profile and gather verified reviews to earn badges.',
  },
  {
    name: 'MarTech Alliance Excellence Awards',
    organizer: 'MarTech Alliance',
    url: 'https://martechalliance.com/martech-awards',
    category: 'Marketing Technology Innovation',
    typicalDeadline: 'October–November annually',
    entryFee: 'Free',
    industry: ['MarTech', 'Marketing Automation', 'AI Marketing'],
    country: 'Global',
    description: 'Global awards recognising the best marketing technology platforms, campaigns, and teams driving innovation.',
  },
  {
    name: 'Gartner Peer Insights Customers\' Choice',
    organizer: 'Gartner',
    url: 'https://www.gartner.com/reviews',
    category: 'Marketing Automation Platforms',
    typicalDeadline: 'Review-based — quarterly recognition',
    entryFee: 'Free',
    industry: ['Marketing Automation', 'SaaS', 'Enterprise Software'],
    country: 'Global',
    description: 'Earned through verified customer reviews on Gartner Peer Insights. Claim your profile to be considered for Customers\' Choice recognition.',
  },
  {
    name: 'Product Hunt Golden Kitty Awards — AI Tools',
    organizer: 'Product Hunt',
    url: 'https://www.producthunt.com/golden-kitty-awards',
    category: 'AI Tools',
    typicalDeadline: 'December annually (based on Product Hunt votes)',
    entryFee: 'Free',
    industry: ['AI', 'SaaS', 'Productivity', 'Marketing'],
    country: 'Global',
    description: 'Annual awards driven by the Product Hunt community. Launch on Product Hunt to become eligible for the Golden Kitty AI Tools category.',
  },
  {
    name: 'SaaStr Annual Most Loved by Customers',
    organizer: 'SaaStr',
    url: 'https://www.saastr.com/award',
    category: 'Most Loved by Customers — SMB SaaS',
    typicalDeadline: 'January–February annually',
    entryFee: 'Free',
    industry: ['SaaS', 'B2B Software', 'Marketing Technology'],
    country: 'Global',
    description: 'SaaStr recognises B2B SaaS companies most loved by their customers, based on NPS, reviews, and churn data.',
  },
  {
    name: 'Stevie Awards — Technology — AI',
    organizer: 'Stevie Awards',
    url: 'https://www.stevieawards.com',
    category: 'Achievement in AI',
    typicalDeadline: 'February–April annually',
    entryFee: 'Paid',
    industry: ['AI', 'Technology', 'Business', 'Innovation'],
    country: 'Global',
    description: 'The world\'s premier business awards programme, with specific categories for AI innovation and technology achievement.',
  },
];
