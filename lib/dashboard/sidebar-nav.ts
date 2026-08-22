/**
 * Dashboard sidebar — Basic (daily work) vs Advanced (power tools).
 * Advanced is grouped by job-to-be-done; icons attach in layout.tsx.
 */

export interface SidebarNavItemDef {
  iconKey: string;
  label: string;
  href: string;
  description?: string;
  isNew?: boolean;
}

export interface AdvancedNavSectionDef {
  id: string;
  label: string;
  description: string;
  /** Icon key from sidebar-icons — used on hub cards and context bar. */
  iconKey: string;
  items: SidebarNavItemDef[];
}

/** Create, schedule, measure — always visible. */
export const BASIC_NAV_ITEMS: SidebarNavItemDef[] = [
  { iconKey: 'CommandLine', label: 'Mission Control', href: '/dashboard' },
  { iconKey: 'FileText', label: 'Content', href: '/dashboard/content' },
  { iconKey: 'Calendar', label: 'Calendar', href: '/dashboard/calendar' },
  { iconKey: 'Megaphone', label: 'Campaigns', href: '/dashboard/campaigns' },
  { iconKey: 'BarChart3', label: 'Analytics', href: '/dashboard/analytics' },
  { iconKey: 'Globe', label: 'Platforms', href: '/dashboard/platforms' },
  { iconKey: 'Settings', label: 'Settings', href: '/dashboard/settings' },
];

export const ADVANCED_HUB = {
  href: '/dashboard/advanced',
  label: 'Power Tools',
  description: 'Browse every advanced capability by workflow',
} as const;

/** Grouped advanced nav — sidebar + hub page share this source of truth. */
export const ADVANCED_NAV_SECTIONS: AdvancedNavSectionDef[] = [
  {
    id: 'create',
    label: 'Create & media',
    description: 'Concepts, assets, and creative production beyond daily posts',
    iconKey: 'Sparkles',
    items: [
      {
        iconKey: 'Sparkles',
        label: 'Campaign Studio',
        href: '/dashboard/creative-suite',
        description: 'Concept → assets for multi-channel campaigns',
      },
      {
        iconKey: 'Image',
        label: 'AI Images',
        href: '/dashboard/ai-images',
        description: 'Generate on-brand visuals from prompts',
      },
      {
        iconKey: 'Video',
        label: 'Video',
        href: '/dashboard/video',
        description: 'Short-form and reel generation',
      },
      {
        iconKey: 'Palette',
        label: 'Brand Video',
        href: '/dashboard/brand-video',
        description: 'Long-form branded video workflows',
      },
      {
        iconKey: 'MessageSquare',
        label: 'AI Chat',
        href: '/dashboard/ai-chat',
        description: 'Conversational drafting and ideation',
      },
      {
        iconKey: 'BookOpen',
        label: 'Content Library',
        href: '/dashboard/content/library',
        description: 'Reuse and organise saved assets',
      },
      {
        iconKey: 'Palette',
        label: 'Sandbox',
        href: '/dashboard/sandbox',
        description: 'Experiment without touching live campaigns',
      },
    ],
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    description: 'Research, personas, and predictive signals',
    iconKey: 'Brain',
    items: [
      {
        iconKey: 'Brain',
        label: 'IntentScape',
        href: '/dashboard/intentscape',
        description: 'Intent clusters and content opportunities',
        isNew: true,
      },
      {
        iconKey: 'Cpu',
        label: 'Profile Analyser',
        href: '/dashboard/profile-analyser',
        description: 'Deep profile and voice analysis',
        isNew: true,
      },
      {
        iconKey: 'Lightbulb',
        label: 'Marketing Lab',
        href: '/dashboard/marketing-lab',
        description: 'Hypothesis testing and strategy experiments',
      },
      {
        iconKey: 'Database',
        label: 'Research',
        href: '/dashboard/research',
        description: 'Market and competitor research workspace',
      },
      {
        iconKey: 'TrendingUp',
        label: 'Predictions',
        href: '/dashboard/predictions',
        description: 'Forward-looking performance signals',
      },
      {
        iconKey: 'Cpu',
        label: 'Personas',
        href: '/dashboard/personas',
        description: 'Audience personas for content targeting',
      },
      {
        iconKey: 'Mic',
        label: 'Voice Engine',
        href: '/dashboard/voice',
        description: 'Brand voice tuning and samples',
      },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    description: 'Approvals, automation, and execution pipelines',
    iconKey: 'GitPullRequest',
    items: [
      {
        iconKey: 'BadgeCheck',
        label: 'Approvals',
        href: '/dashboard/approvals',
        description: 'Review queue before anything goes live',
      },
      {
        iconKey: 'GitPullRequest',
        label: 'Workflows',
        href: '/dashboard/workflows',
        description: 'Multi-step automations with gates',
      },
      {
        iconKey: 'ListTodo',
        label: 'Tasks',
        href: '/dashboard/tasks',
        description: 'Team task board tied to campaigns',
      },
      {
        iconKey: 'List',
        label: 'Publishing Queue',
        href: '/dashboard/schedule/queue',
        description: 'Queued and in-flight publishes',
      },
      {
        iconKey: 'Bell',
        label: 'Activity Log',
        href: '/dashboard/activity',
        description: 'Audit trail across the workspace',
      },
      {
        iconKey: 'Rocket',
        label: 'Autopilot',
        href: '/dashboard/autopilot',
        description: 'Hands-off content and publish loops',
      },
      {
        iconKey: 'File',
        label: 'Reports',
        href: '/dashboard/reports',
        description: 'Exportable client and exec reports',
      },
    ],
  },
  {
    id: 'growth',
    label: 'Growth & SEO',
    description: 'Discoverability, local presence, and revenue impact',
    iconKey: 'Search',
    items: [
      {
        iconKey: 'Search',
        label: 'SEO',
        href: '/dashboard/seo',
        description: 'Site health, keywords, and fixes',
      },
      {
        iconKey: 'Building2',
        label: 'Google Business',
        href: '/dashboard/google-business',
        description: 'GBP posts, reviews, and local listings',
      },
      {
        iconKey: 'Map',
        label: 'Local SEO',
        href: '/dashboard/local',
        description: 'Geo and citation optimisation',
      },
      {
        iconKey: 'Shield',
        label: 'Authority',
        href: '/dashboard/authority',
        description: 'E-E-A-T and claim validation',
      },
      {
        iconKey: 'Target',
        label: 'Competitors',
        href: '/dashboard/competitors',
        description: 'Competitive intelligence snapshots',
      },
      {
        iconKey: 'Beaker',
        label: 'Experiments',
        href: '/dashboard/experiments',
        description: 'A/B tests and variant tracking',
      },
      {
        iconKey: 'Target',
        label: 'Benchmarks',
        href: '/dashboard/analytics/benchmarks',
        description: 'Industry benchmark comparisons',
      },
      {
        iconKey: 'Users',
        label: 'Audience',
        href: '/dashboard/audience',
        description: 'Segmentation and cohort views',
      },
      {
        iconKey: 'Calculator',
        label: 'ROI',
        href: '/dashboard/roi',
        description: 'Campaign return on spend',
      },
      {
        iconKey: 'DollarSign',
        label: 'Revenue',
        href: '/dashboard/revenue',
        description: 'Attributed revenue dashboards',
      },
    ],
  },
  {
    id: 'platform',
    label: 'Platform & team',
    description: 'Integrations, multi-business, and developer hooks',
    iconKey: 'Zap',
    items: [
      {
        iconKey: 'Zap',
        label: 'Integrations',
        href: '/dashboard/integrations',
        description: 'Third-party apps and data sources',
      },
      {
        iconKey: 'Link2',
        label: 'Webhooks',
        href: '/dashboard/webhooks',
        description: 'Outbound event subscriptions',
      },
      {
        iconKey: 'Users',
        label: 'Team',
        href: '/dashboard/team',
        description: 'Members, roles, and invites',
      },
      {
        iconKey: 'Building',
        label: 'Businesses',
        href: '/dashboard/businesses',
        description: 'Switch and manage client brands',
      },
      {
        iconKey: 'Globe',
        label: 'Web Projects',
        href: '/dashboard/web-projects',
        description: 'Site projects linked to campaigns',
      },
      {
        iconKey: 'Grid',
        label: 'Unified View',
        href: '/dashboard/unified',
        description: 'Cross-channel performance rollup',
      },
      {
        iconKey: 'Megaphone',
        label: 'Marketing Agency',
        href: '/dashboard/marketing-agency',
        description: 'Agency ops and client delivery',
      },
    ],
  },
];

/** Flat list for route matching and legacy imports. */
export const ADVANCED_NAV_ITEMS: SidebarNavItemDef[] =
  ADVANCED_NAV_SECTIONS.flatMap(section => section.items);

export const BASIC_GROUP_ID = 'basic';
export const ADVANCED_GROUP_ID = 'advanced';
export const SIDEBAR_ADVANCED_KEY = 'sidebar-show-advanced';

export function isSidebarPathActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isAdvancedDashboardPath(pathname: string): boolean {
  if (pathname === ADVANCED_HUB.href) return true;
  return ADVANCED_NAV_ITEMS.some(item =>
    isSidebarPathActive(pathname, item.href)
  );
}
