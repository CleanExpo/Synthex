'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTokenRefresh } from '@/hooks/useTokenRefresh';
import MobileMenu from '@/components/MobileMenu';
import { NotificationBell } from '@/components/NotificationBell';
import {
  Sparkles,
  CommandLine,
  FileText,
  Users,
  Calendar,
  BarChart3,
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Search,
  User,
  LogOut,
  TrendingUp,
  Zap,
  Brain,
  Palette,
  List,
  ListTodo,
  Target,
  Video,
  Globe,
  Shield,
  Image,
  Database,
  Map,
  Building,
  Building2,
  File,
  Beaker,
  CreditCard,
  Layers,
  Lightbulb,
  Layout,
  Link2,
  GitBranch as GitPullRequest,
  MessageSquare,
  Repeat,
  Send,
  Bell,
  BookOpen,
  Award,
  Grid,
  DollarSign,
  Calculator,
  Briefcase,
  Link as LinkIcon,
  Mic,
  Newspaper,
  ShieldExclamation,
  Gift,
  Wand2,
  Star,
  Lock,
  Cpu,
  BadgeCheck,
  Megaphone,
} from '@/components/icons';
import { AIPMFloatingButton } from '@/components/ai-pm';
import { PauseButton } from '@/components/autonomous/PauseButton';
import { KeyboardHints } from '@/components/dashboard/keyboard-hints';
import { ProductTour } from '@/components/ProductTour';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { BusinessSwitcher } from '@/components/business';
import { useUser } from '@/hooks/use-user';
import { SynthexLogo } from '@/components/landing/synthex-logo';
import { BottomMenu } from '@/components/landing/bottom-menu';
import type { NavItem } from '@/components/landing/bottom-menu';
import { useRouter } from 'next/navigation';
import { ModeProvider } from '@/components/providers/mode-provider';
import { FirstWinBanner } from '@/components/notifications/FirstWinBanner';
// PR 3 — Phase 3: global billing status banner (renders only when non-current)
import { BillingStatusBanner } from '@/components/BillingStatusBanner';
import { MascotTip } from '@/components/mascots/MascotTip';
import { MonthlyStoryCard } from '@/components/monthly-story/MonthlyStoryCard';
// SYN-597: Contextual team invite banner — self-hides when ineligible
import { TeamInviteBanner } from '@/components/team/TeamInviteBanner';
// SYN-635: GA4 connection prompt — self-hides when connected or dismissed
import { GA4ConnectBanner } from '@/components/dashboard/GA4ConnectBanner';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  sidebarMenuButtonVariants,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Icon3D } from '@/components/icons/Icon3D';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ---------------------------------------------------------------------------
// SIDEBAR GROUPS
// ---------------------------------------------------------------------------

interface SidebarNavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  isNew?: boolean; // renders an amber pulse badge in sidebar
  starterHidden?: boolean; // hidden until Advanced Mode is enabled
}

interface SidebarNavGroup {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  items: SidebarNavItem[];
  defaultOpen?: boolean;
}

// Quick Actions — pinned at the top of the sidebar, always visible
const QUICK_ACTIONS: SidebarNavItem[] = [
  {
    icon: CommandLine,
    label: 'Command Center',
    href: '/dashboard',
  },
  {
    icon: Sparkles,
    label: 'Create Campaign',
    href: '/dashboard/creative-suite',
  },
  { icon: BadgeCheck, label: 'Approvals', href: '/dashboard/approvals' },
];

const sidebarGroups: SidebarNavGroup[] = [
  // ── Starter groups (visible by default) ────────────────────────────────────
  {
    id: 'content',
    icon: Sparkles,
    label: 'CREATE',
    defaultOpen: true,
    items: [
      {
        icon: Sparkles,
        label: 'Campaign Studio',
        href: '/dashboard/creative-suite',
      },
      { icon: FileText, label: 'Content Library', href: '/dashboard/content' },
      { icon: Image, label: 'AI Images', href: '/dashboard/ai-images' },
      { icon: Video, label: 'Video', href: '/dashboard/video' },
      { icon: MessageSquare, label: 'AI Chat', href: '/dashboard/ai-chat' },
      { icon: Globe, label: 'Platforms', href: '/dashboard/platforms' },
      {
        icon: BookOpen,
        label: 'Library',
        href: '/dashboard/content/library',
        starterHidden: true,
      },
      {
        icon: Palette,
        label: 'Sandbox',
        href: '/dashboard/sandbox',
        starterHidden: true,
      },
    ],
  },
  {
    id: 'planning',
    icon: Calendar,
    label: 'RUN',
    defaultOpen: true,
    items: [
      { icon: Calendar, label: 'Calendar', href: '/dashboard/calendar' },
      {
        icon: List,
        label: 'Publishing Queue',
        href: '/dashboard/schedule/queue',
      },
      { icon: ListTodo, label: 'Tasks', href: '/dashboard/tasks' },
      {
        icon: GitPullRequest,
        label: 'Workflows',
        href: '/dashboard/workflows',
      },
      { icon: Bell, label: 'Activity Log', href: '/dashboard/activity' },
    ],
  },
  {
    id: 'analytics',
    icon: BarChart3,
    label: 'MEASURE',
    defaultOpen: true,
    items: [
      { icon: BarChart3, label: 'Performance', href: '/dashboard/analytics' },
      { icon: Search, label: 'SEO Tools', href: '/dashboard/seo' },
      {
        icon: Building2,
        label: 'Google Business',
        href: '/dashboard/google-business',
      },
      { icon: File, label: 'Reports', href: '/dashboard/reports' },
      {
        icon: Target,
        label: 'Benchmarks',
        href: '/dashboard/analytics/benchmarks',
      },
      {
        icon: Lightbulb,
        label: 'Predictions',
        href: '/dashboard/predictions',
        starterHidden: true,
      },
      {
        icon: Layout,
        label: 'Report Builder',
        href: '/dashboard/reports/builder',
        starterHidden: true,
      },
      {
        icon: Grid,
        label: 'Unified View',
        href: '/dashboard/unified',
        starterHidden: true,
      },
      {
        icon: CommandLine,
        label: 'Citation Dashboard',
        href: '/dashboard/citation',
        starterHidden: true,
      },
    ],
  },
  {
    id: 'setup',
    icon: Settings,
    label: 'SETUP',
    defaultOpen: true,
    items: [
      { icon: Zap, label: 'Integrations', href: '/dashboard/integrations' },
      { icon: Users, label: 'Team', href: '/dashboard/team' },
      { icon: Building, label: 'Businesses', href: '/dashboard/businesses' },
      { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
    ],
  },
  // ── Advanced groups (visible in Advanced Mode) ──────────────────────────────
  {
    id: 'monetization',
    icon: DollarSign,
    label: 'MONETIZATION',
    items: [
      { icon: DollarSign, label: 'Revenue', href: '/dashboard/revenue' },
      { icon: FileText, label: 'Invoices', href: '/dashboard/invoices' },
      { icon: Calculator, label: 'ROI', href: '/dashboard/roi' },
      { icon: Briefcase, label: 'Sponsors', href: '/dashboard/sponsors' },
      { icon: LinkIcon, label: 'Affiliates', href: '/dashboard/affiliates' },
    ],
  },
  {
    id: 'business-intel',
    icon: Brain,
    label: 'BUSINESS INTEL',
    items: [
      { icon: Users, label: 'Audience', href: '/dashboard/audience' },
      { icon: Target, label: 'Competitors', href: '/dashboard/competitors' },
      { icon: Bell, label: 'Listening', href: '/dashboard/listening' },
      { icon: Beaker, label: 'Experiments', href: '/dashboard/experiments' },
      {
        icon: TrendingUp,
        label: 'Forecasting',
        href: '/dashboard/forecasting',
      },
    ],
  },
  {
    id: 'seo-authority',
    icon: Search,
    label: 'SEO & AUTHORITY',
    items: [
      { icon: Search, label: 'SEO Tools', href: '/dashboard/seo' },
      { icon: Target, label: 'Rankings', href: '/dashboard/seo/rankings' },
      { icon: Globe, label: 'GEO Analysis', href: '/dashboard/geo' },
      { icon: Zap, label: 'GEO Optimiser', href: '/dashboard/geo/optimiser' },
      { icon: Map, label: 'Local SEO', href: '/dashboard/local' },
      {
        icon: Building2,
        label: 'Google Business',
        href: '/dashboard/google-business',
      },
      {
        icon: BarChart3,
        label: 'Displacement',
        href: '/dashboard/seo/displacement',
      },
      { icon: BadgeCheck, label: 'E-E-A-T Builder', href: '/dashboard/eeat' },
      { icon: Shield, label: 'Quality Gate', href: '/dashboard/quality' },
      { icon: Building2, label: 'Brand Builder', href: '/dashboard/brand' },
      { icon: Shield, label: 'Authority', href: '/dashboard/authority' },
      {
        icon: ShieldExclamation,
        label: 'Sentinel',
        href: '/dashboard/sentinel',
      },
      { icon: Newspaper, label: 'PR Manager', href: '/dashboard/pr' },
      {
        icon: LinkIcon,
        label: 'Link Prospector',
        href: '/dashboard/backlinks',
      },
    ],
  },
  {
    id: 'research-media',
    icon: Database,
    label: 'RESEARCH & MEDIA',
    items: [
      { icon: Database, label: 'Research', href: '/dashboard/research' },
      { icon: Users, label: 'Authors', href: '/dashboard/authors' },
      { icon: Link2, label: 'Link in Bio', href: '/dashboard/bio' },
      { icon: Mic, label: 'Voice Engine', href: '/dashboard/voice' },
      { icon: Video, label: 'Video', href: '/dashboard/video' },
      { icon: Image, label: 'Visuals', href: '/dashboard/visuals' },
      { icon: Cpu, label: 'Personas', href: '/dashboard/personas' },
    ],
  },
  {
    id: 'ai-agents',
    icon: GitPullRequest,
    label: 'AI AGENTS',
    items: [
      { icon: Sparkles, label: 'Autopilot', href: '/dashboard/autopilot' },
      {
        icon: GitPullRequest,
        label: 'Workflows',
        href: '/dashboard/workflows',
      },
      { icon: Lock, label: 'Brand Voice', href: '/dashboard/brand-voice' },
      { icon: Star, label: 'AI Insights', href: '/dashboard/insights' },
      { icon: Brain, label: 'Advisor', href: '/dashboard/advisor' },
    ],
  },
  {
    id: 'team-admin',
    icon: Users,
    label: 'TEAM & ADMIN',
    items: [
      { icon: Users, label: 'Team', href: '/dashboard/team' },
      { icon: Lock, label: 'Roles', href: '/dashboard/roles' },
      {
        icon: MessageSquare,
        label: 'Collaboration',
        href: '/dashboard/collaboration',
      },
      { icon: Zap, label: 'Integrations', href: '/dashboard/integrations' },
      { icon: Link2, label: 'Webhooks', href: '/dashboard/webhooks' },
      {
        icon: GitPullRequest,
        label: 'Approvals',
        href: '/dashboard/approvals',
      },
      { icon: Globe, label: 'Projects', href: '/dashboard/web-projects' },
      { icon: Gift, label: 'Referrals', href: '/dashboard/referrals' },
      { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
    ],
  },
];

// Groups shown by default (before Advanced Mode is enabled)
const STARTER_GROUP_IDS = new Set([
  'content',
  'planning',
  'analytics',
  'setup',
]);
const SIDEBAR_EXPANDED_KEY = 'sidebar-show-all-groups';

const MOBILE_NAV_ITEMS: NavItem[] = [
  {
    id: 'home',
    label: 'Home',
    icon: (
      <Icon3D name="home" category="navigation" size={24} className="w-5 h-5" />
    ),
    href: '/dashboard',
  },
  {
    id: 'content',
    label: 'Content',
    icon: <FileText className="w-5 h-5" />,
    href: '/dashboard/content',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: <BarChart3 className="w-5 h-5" />,
    href: '/dashboard/analytics',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <Icon3D
        name="settings"
        category="navigation"
        size={24}
        className="w-5 h-5"
      />
    ),
    href: '/dashboard/settings',
  },
];

function getMobileActiveId(pathname: string): string {
  if (pathname.startsWith('/dashboard/settings')) return 'settings';
  if (pathname.startsWith('/dashboard/analytics')) return 'analytics';
  if (pathname.startsWith('/dashboard/content')) return 'content';
  return 'home';
}

// ---------------------------------------------------------------------------
// COLLAPSIBLE SIDEBAR NAV GROUP (uses Shadcn SidebarGroup)
// ---------------------------------------------------------------------------

function NavGroup({ group }: { group: SidebarNavGroup }) {
  const pathname = usePathname();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const [isOpen, setIsOpen] = useState(group.defaultOpen ?? false);

  useEffect(() => {
    const isActive = group.items.some(
      item => pathname === item.href || pathname.startsWith(item.href + '/')
    );
    if (isActive) setIsOpen(true);
  }, [pathname, group.items]);

  // Collapsed state: show only group icon linking to first item.
  //
  // SYN-905: Tooltip wraps <Link> directly with the sidebar-menu-button
  // styling. Previously this was <SidebarMenuButton><Link/></SidebarMenuButton>
  // which rendered <button><a/></button> — invalid HTML (anchors cannot
  // descend from buttons per WHATWG spec) and a latent source of
  // React.Children.only crashes during reconciliation.
  if (isCollapsed) {
    const firstHref = group.items[0]?.href ?? '/dashboard';
    return (
      <SidebarMenuItem>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={firstHref}
              className={cn(sidebarMenuButtonVariants({ size: 'sm' }))}
              aria-label={group.label}
            >
              <group.icon className="h-4 w-4" />
            </Link>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            className="bg-[#0a0a12] border-white/10 text-white/70 text-xs"
          >
            {group.label}
          </TooltipContent>
        </Tooltip>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel
        className="flex items-center gap-2 cursor-pointer select-none text-[11px] tracking-[0.18em] uppercase text-white/55 hover:text-white/80 transition-colors px-3 py-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <group.icon className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="flex-1">{group.label}</span>
        <Icon3D
          name="chevron-down"
          category="navigation"
          size={24}
          className={cn(
            'h-3.5 w-3.5 transition-transform',
            !isOpen && '-rotate-90'
          )}
        />
      </SidebarGroupLabel>
      {isOpen && (
        <SidebarGroupContent>
          <SidebarMenu>
            {group.items.map(item => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    size="sm"
                    className={cn(
                      'text-white/65 hover:text-white hover:bg-white/[0.04] rounded-sm transition-all',
                      isActive &&
                        'text-amber-500 bg-amber-500/[0.08] hover:text-amber-400'
                    )}
                  >
                    <Link
                      href={item.href}
                      className="flex items-center gap-2.5 w-full py-1.5"
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      <span className="text-[13px] flex-1">{item.label}</span>
                      {item.isNew && (
                        <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      )}
    </SidebarGroup>
  );
}

// ---------------------------------------------------------------------------
// QUICK ACTIONS (pinned non-collapsible block at top of sidebar)
// ---------------------------------------------------------------------------

function QuickActionsGroup() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  if (isCollapsed) {
    return (
      <>
        {QUICK_ACTIONS.map(item => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <SidebarMenuItem key={item.href}>
              <Tooltip>
                <TooltipTrigger asChild>
                  {/*
                    SYN-905: see the matching block in NavGroup above for
                    rationale. <Link> renders <a>, so wrapping it in a
                    <button> via SidebarMenuButton produces invalid HTML
                    and a Slot/Children.only hazard.
                  */}
                  <Link
                    href={item.href}
                    className={cn(
                      sidebarMenuButtonVariants({ size: 'sm' }),
                      isActive && 'text-amber-500'
                    )}
                    aria-label={item.label}
                  >
                    <item.icon className="h-4 w-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="bg-[#0a0a12] border-white/10 text-white/70 text-xs"
                >
                  {item.label}
                </TooltipContent>
              </Tooltip>
            </SidebarMenuItem>
          );
        })}
      </>
    );
  }

  return (
    <SidebarGroup className="pb-0">
      <SidebarGroupLabel className="text-[11px] tracking-[0.18em] uppercase text-white/40 px-3 py-2">
        Quick Actions
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {QUICK_ACTIONS.map(item => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  size="sm"
                  className={cn(
                    'h-auto border border-white/[0.06] bg-white/[0.025] text-white/70 hover:text-white hover:bg-white/[0.05] rounded-md transition-all',
                    isActive &&
                      'border-amber-500/20 text-amber-500 bg-amber-500/[0.08] hover:text-amber-400'
                  )}
                >
                  <Link
                    href={item.href}
                    className="flex items-center gap-2.5 w-full px-1 py-2"
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    <span className="text-[13px] flex-1">{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
      <SidebarSeparator className="mt-2 bg-white/[0.04]" />
    </SidebarGroup>
  );
}

// ---------------------------------------------------------------------------
// DASHBOARD SIDEBAR (uses Shadcn Sidebar shell)
// ---------------------------------------------------------------------------

function DashboardSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const isStaticReviewRoute = pathname.startsWith(
    '/dashboard/marketing-agency'
  );
  const { user } = useUser({ enabled: !isStaticReviewRoute });

  const [showAllGroups, setShowAllGroups] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_EXPANDED_KEY);
    if (stored === 'true') setShowAllGroups(true);
  }, []);

  const toggleShowAllGroups = () => {
    const next = !showAllGroups;
    setShowAllGroups(next);
    localStorage.setItem(SIDEBAR_EXPANDED_KEY, next.toString());
  };

  useEffect(() => {
    if (showAllGroups) return;
    // Auto-expand if the current path is in a hidden group or hidden item
    const isInHiddenContent = sidebarGroups.some(g => {
      const groupHidden = !STARTER_GROUP_IDS.has(g.id);
      return g.items.some(
        item =>
          (groupHidden || item.starterHidden) &&
          (pathname === item.href || pathname.startsWith(item.href + '/'))
      );
    });
    if (isInHiddenContent) {
      setShowAllGroups(true);
      localStorage.setItem(SIDEBAR_EXPANDED_KEY, 'true');
    }
  }, [pathname, showAllGroups]);

  const dynamicSidebarGroups = user?.isMultiBusinessOwner
    ? [
        sidebarGroups[0]!,
        {
          id: 'businesses',
          icon: Building,
          label: 'BUSINESSES',
          defaultOpen: true,
          items: [],
        },
        ...sidebarGroups.slice(1),
      ]
    : sidebarGroups;

  // Filter groups and items based on Advanced Mode state
  const visibleGroups = (
    showAllGroups
      ? dynamicSidebarGroups
      : dynamicSidebarGroups.filter(
          g => STARTER_GROUP_IDS.has(g.id) || g.id === 'businesses'
        )
  ).map(group => ({
    ...group,
    items: showAllGroups
      ? group.items
      : group.items.filter(item => !item.starterHidden),
  }));

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-[0.5px] border-white/[0.06] bg-[#0a0a12] [&>div]:bg-[#0a0a12]"
    >
      {/* Logo Header */}
      <SidebarHeader className="border-b border-[0.5px] border-white/[0.06] h-14 flex-row items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <SynthexLogo className="w-7 h-7 flex-shrink-0 opacity-90 group-hover:opacity-100 transition-opacity" />
          {!isCollapsed && (
            <span className="text-xs font-light tracking-[0.2em] text-white uppercase">
              Synthex
            </span>
          )}
        </Link>
        {!isCollapsed && (
          <SidebarTrigger className="text-white/50 hover:text-white/80 transition-colors h-6 w-6" />
        )}
      </SidebarHeader>

      {/* Navigation Content */}
      <SidebarContent className="scrollbar-thin">
        <TooltipProvider delayDuration={0}>
          {isCollapsed ? (
            <SidebarMenu className="py-3 px-2 gap-1">
              <QuickActionsGroup />
              {visibleGroups.map(group => (
                <NavGroup key={group.id} group={group} />
              ))}
            </SidebarMenu>
          ) : (
            <>
              <QuickActionsGroup />
              {visibleGroups.map(group =>
                group.id === 'businesses' && !isStaticReviewRoute ? (
                  <SidebarGroup key="businesses">
                    <SidebarGroupLabel className="text-[11px] tracking-[0.18em] uppercase text-white/55 px-3 py-2">
                      <Building className="h-3.5 w-3.5 mr-2" />
                      BUSINESSES
                    </SidebarGroupLabel>
                    <SidebarGroupContent className="px-2">
                      <BusinessSwitcher />
                    </SidebarGroupContent>
                  </SidebarGroup>
                ) : (
                  <NavGroup key={group.id} group={group} />
                )
              )}
            </>
          )}
        </TooltipProvider>
      </SidebarContent>

      {/* Footer — Weekly mascot tip + Advanced Mode toggle */}
      <SidebarFooter className="border-t border-[0.5px] border-white/[0.06] p-2 space-y-1">
        {!isCollapsed && (
          <>
            {/* Weekly rotating board persona tip */}
            <MascotTip className="mb-2" />

            <div className="flex items-center gap-2 px-2 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] text-white/50">Online</span>
            </div>
            <button
              onClick={toggleShowAllGroups}
              aria-pressed={showAllGroups}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] tracking-[0.15em] uppercase text-white/40 hover:text-white/60 hover:bg-white/[0.02] rounded-sm transition-colors"
            >
              <Layers className="w-3 h-3 flex-shrink-0" />
              <span className="flex-1 text-left">Advanced Mode</span>
              {/* Toggle pill */}
              <div
                className={cn(
                  'relative w-7 h-3.5 rounded-full transition-colors flex-shrink-0',
                  showAllGroups ? 'bg-amber-500/70' : 'bg-white/10'
                )}
              >
                <div
                  className={cn(
                    'absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow-sm transition-all',
                    showAllGroups ? 'left-[calc(100%-12px)]' : 'left-0.5'
                  )}
                />
              </div>
            </button>
          </>
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

// ---------------------------------------------------------------------------
// MAIN LAYOUT
// ---------------------------------------------------------------------------

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isStaticReviewRoute = pathname.startsWith(
    '/dashboard/marketing-agency'
  );
  useTokenRefresh({ enabled: !isStaticReviewRoute });
  const { user } = useUser({ enabled: !isStaticReviewRoute });
  const [searchValue, setSearchValue] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <ModeProvider>
      <SidebarProvider defaultOpen={true} className="min-h-screen bg-[#050508]">
        {/* Mobile Menu */}
        <MobileMenu />

        {/* Desktop Sidebar */}
        <DashboardSidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-screen">
          {/* Top Header Bar */}
          <header className="sticky top-0 z-30 flex items-center justify-between h-14 border-b border-[0.5px] border-white/[0.06] bg-[#050508]/80 backdrop-blur-sm px-4 md:px-6">
            <div className="flex items-center gap-3">
              {/* Sidebar toggle for collapsed state */}
              <SidebarTrigger className="hidden md:flex text-white/50 hover:text-white/80 transition-colors h-6 w-6" />

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-1.5 text-white/40 hover:text-white transition-colors rounded-sm"
                aria-label="Open menu"
              >
                <Icon3D
                  name="menu"
                  category="navigation"
                  size={24}
                  className="h-5 w-5"
                />
              </button>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40 pointer-events-none" />
                <input
                  type="search"
                  placeholder="Search..."
                  value={searchValue}
                  onChange={e => setSearchValue(e.target.value)}
                  aria-label="Search"
                  className="w-40 sm:w-52 md:w-64 pl-8 pr-3 py-1.5 text-xs bg-white/[0.02] border-[0.5px] border-white/[0.06] text-white/70 placeholder:text-white/40 rounded-sm focus:outline-none focus:border-amber-500/30 transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              {!isStaticReviewRoute && (
                <>
                  <PauseButton />
                  <NotificationBell />
                </>
              )}

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 p-2 rounded-sm hover:bg-white/[0.04] transition-colors focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user?.avatar ?? undefined} />
                      <AvatarFallback className="bg-amber-500/10 text-amber-500 text-xs">
                        {user?.name
                          ?.split(' ')
                          .map((n: string) => n[0])
                          .join('')
                          .toUpperCase() ?? 'U'}
                      </AvatarFallback>
                    </Avatar>
                    {user?.name && (
                      <span className="hidden md:inline text-xs text-white/60">
                        {user.name}
                      </span>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-48 bg-[#0a0a12] border-white/[0.08] rounded-sm"
                >
                  <DropdownMenuLabel className="text-xs text-white/40 font-normal">
                    {user?.email ?? 'Account'}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/[0.06]" />
                  <DropdownMenuItem asChild>
                    <Link
                      href="/dashboard/settings?tab=profile"
                      className="flex items-center gap-2.5 px-3 py-2 text-xs text-white/60 hover:text-white cursor-pointer rounded-sm"
                    >
                      <User className="h-3.5 w-3.5" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/dashboard/settings"
                      className="flex items-center gap-2.5 px-3 py-2 text-xs text-white/60 hover:text-white cursor-pointer rounded-sm"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/dashboard/settings?tab=billing"
                      className="flex items-center gap-2.5 px-3 py-2 text-xs text-white/60 hover:text-white cursor-pointer rounded-sm"
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      Billing
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/[0.06]" />
                  <DropdownMenuItem asChild>
                    <a
                      href="https://status.synthex.social"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 px-3 py-2 text-xs text-white/60 hover:text-white cursor-pointer rounded-sm"
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                      System Status
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/[0.06]" />
                  <DropdownMenuItem>
                    <button
                      onClick={async () => {
                        await fetch('/api/auth/logout', {
                          method: 'POST',
                          credentials: 'include',
                        });
                        router.push('/login');
                      }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-white/40 hover:text-red-400 cursor-pointer rounded-sm"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign out
                    </button>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Page Content */}
          <main className="p-4 md:p-6">
            {!isStaticReviewRoute && (
              <>
                {/* PR 3 — Phase 3: past_due / unpaid / paused / cancelled banner.
                    Self-hides when state is `current`. */}
                <BillingStatusBanner />
                {/* First Win Banner — SYN-525: shown once until dismissed */}
                <FirstWinBanner className="mb-5" />
                {/* SYN-597: Team invite banner — self-hides when org < 45 days or dismissed */}
                <TeamInviteBanner />
                {/* SYN-635: GA4 connection prompt — self-hides when connected or dismissed */}
                <GA4ConnectBanner />
              </>
            )}
            {children}
          </main>

          {!isStaticReviewRoute && (
            /* Monthly Story overlay — SYN-553: full-screen card on first login after story generated */
            <MonthlyStoryCard />
          )}
        </div>

        {/* Mobile overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/60 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Mobile Bottom Navigation */}
        <BottomMenu
          className="md:hidden"
          items={MOBILE_NAV_ITEMS}
          activeId={getMobileActiveId(pathname)}
          onSelect={id => {
            const item = MOBILE_NAV_ITEMS.find(i => i.id === id);
            if (item?.href) router.push(item.href);
          }}
        />

        {/* AI Project Manager */}
        <AIPMFloatingButton />

        {/* Keyboard Hints */}
        <KeyboardHints />

        {!isStaticReviewRoute && (
          /* Product Tour — triggers on first dashboard visit after onboarding */
          <ProductTour />
        )}
      </SidebarProvider>
    </ModeProvider>
  );
}
