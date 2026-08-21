/**
 * Dashboard sidebar — Basic (daily work) vs Advanced (power tools).
 * Icons are attached in layout.tsx when building groups.
 */

export interface SidebarNavItemDef {
  iconKey: string;
  label: string;
  href: string;
  isNew?: boolean;
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

export const ADVANCED_NAV_ITEMS: SidebarNavItemDef[] = [
  { iconKey: 'Sparkles', label: 'Campaign Studio', href: '/dashboard/creative-suite' },
  { iconKey: 'BadgeCheck', label: 'Approvals', href: '/dashboard/approvals' },
  { iconKey: 'Search', label: 'SEO', href: '/dashboard/seo' },
  {
    iconKey: 'Building2',
    label: 'Google Business',
    href: '/dashboard/google-business',
  },
  { iconKey: 'Zap', label: 'Integrations', href: '/dashboard/integrations' },
  { iconKey: 'Lightbulb', label: 'Marketing Lab', href: '/dashboard/marketing-lab' },
  { iconKey: 'Search', label: 'Profile Analyser', href: '/dashboard/profile-analyser', isNew: true },
  { iconKey: 'Brain', label: 'IntentScape', href: '/dashboard/intentscape', isNew: true },
  { iconKey: 'Image', label: 'AI Images', href: '/dashboard/ai-images' },
  { iconKey: 'Video', label: 'Video', href: '/dashboard/video' },
  { iconKey: 'Video', label: 'Brand Video', href: '/dashboard/brand-video' },
  { iconKey: 'MessageSquare', label: 'AI Chat', href: '/dashboard/ai-chat' },
  { iconKey: 'List', label: 'Publishing Queue', href: '/dashboard/schedule/queue' },
  { iconKey: 'ListTodo', label: 'Tasks', href: '/dashboard/tasks' },
  { iconKey: 'GitPullRequest', label: 'Workflows', href: '/dashboard/workflows' },
  { iconKey: 'Bell', label: 'Activity Log', href: '/dashboard/activity' },
  { iconKey: 'File', label: 'Reports', href: '/dashboard/reports' },
  { iconKey: 'Target', label: 'Benchmarks', href: '/dashboard/analytics/benchmarks' },
  { iconKey: 'Users', label: 'Team', href: '/dashboard/team' },
  { iconKey: 'Building', label: 'Businesses', href: '/dashboard/businesses' },
  { iconKey: 'Sparkles', label: 'Autopilot', href: '/dashboard/autopilot' },
  { iconKey: 'Megaphone', label: 'Marketing Agency', href: '/dashboard/marketing-agency' },
  { iconKey: 'DollarSign', label: 'Revenue', href: '/dashboard/revenue' },
  { iconKey: 'Calculator', label: 'ROI', href: '/dashboard/roi' },
  { iconKey: 'Users', label: 'Audience', href: '/dashboard/audience' },
  { iconKey: 'Target', label: 'Competitors', href: '/dashboard/competitors' },
  { iconKey: 'Beaker', label: 'Experiments', href: '/dashboard/experiments' },
  { iconKey: 'Map', label: 'Local SEO', href: '/dashboard/local' },
  { iconKey: 'Shield', label: 'Authority', href: '/dashboard/authority' },
  { iconKey: 'Database', label: 'Research', href: '/dashboard/research' },
  { iconKey: 'Mic', label: 'Voice Engine', href: '/dashboard/voice' },
  { iconKey: 'Cpu', label: 'Personas', href: '/dashboard/personas' },
  { iconKey: 'Link2', label: 'Webhooks', href: '/dashboard/webhooks' },
  { iconKey: 'Globe', label: 'Web Projects', href: '/dashboard/web-projects' },
  { iconKey: 'BookOpen', label: 'Content Library', href: '/dashboard/content/library' },
  { iconKey: 'Palette', label: 'Sandbox', href: '/dashboard/sandbox' },
  { iconKey: 'Lightbulb', label: 'Predictions', href: '/dashboard/predictions' },
  { iconKey: 'Grid', label: 'Unified View', href: '/dashboard/unified' },
];

export const BASIC_GROUP_ID = 'basic';
export const ADVANCED_GROUP_ID = 'advanced';
export const SIDEBAR_ADVANCED_KEY = 'sidebar-show-advanced';

export function isSidebarPathActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}
