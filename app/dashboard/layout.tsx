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
  Home,
  FileText,
  Users,
  Calendar,
  BarChart3,
  Settings,
  HelpCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  User,
  LogOut,
  TrendingUp,
  Zap,
  Brain,
  Palette,
  Menu,
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
import { WebSocketProvider } from '@/components/WebSocketProvider';
import { BusinessSwitcher } from '@/components/business';
import { useUser } from '@/hooks/use-user';
import { SynthexLogo } from '@/components/landing/synthex-logo';
import { BottomMenu } from '@/components/landing/bottom-menu';
import type { NavItem } from '@/components/landing/bottom-menu';
import { useRouter } from 'next/navigation';
import { ModeProvider } from '@/components/providers/mode-provider';
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
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
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
}

interface SidebarNavGroup {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  items: SidebarNavItem[];
  defaultOpen?: boolean;
}

const sidebarGroups: SidebarNavGroup[] = [
  {
    id: 'home',
    icon: Home,
    label: 'HOME',
    defaultOpen: true,
    items: [
      { icon: Home, label: 'Dashboard', href: '/dashboard' },
      { icon: Grid, label: 'Unified View', href: '/dashboard/unified' },
      {
        icon: CommandLine,
        label: 'Citation Dashboard',
        href: '/dashboard/citation',
      },
      { icon: Globe, label: 'Platforms', href: '/dashboard/platforms' },
      { icon: Gift, label: 'Referrals', href: '/dashboard/referrals' },
    ],
  },
  {
    id: 'content',
    icon: Sparkles,
    label: 'CONTENT',
    defaultOpen: true,
    items: [
      {
        icon: Sparkles,
        label: 'Creative Suite',
        href: '/dashboard/creative-suite',
      },
      { icon: FileText, label: 'Content', href: '/dashboard/content' },
      { icon: MessageSquare, label: 'AI Chat', href: '/dashboard/ai-chat' },
      { icon: Image, label: 'AI Images', href: '/dashboard/ai-images' },
      { icon: BookOpen, label: 'Library', href: '/dashboard/content/library' },
      { icon: Palette, label: 'Sandbox', href: '/dashboard/sandbox' },
    ],
  },
  {
    id: 'planning',
    icon: Calendar,
    label: 'PLANNING',
    defaultOpen: true,
    items: [
      { icon: Calendar, label: 'Calendar', href: '/dashboard/calendar' },
      { icon: Calendar, label: 'Schedule', href: '/dashboard/schedule' },
      { icon: List, label: 'Queue', href: '/dashboard/schedule/queue' },
      { icon: ListTodo, label: 'Tasks', href: '/dashboard/tasks' },
    ],
  },
  {
    id: 'analytics',
    icon: BarChart3,
    label: 'ANALYTICS',
    defaultOpen: true,
    items: [
      { icon: BarChart3, label: 'Analytics', href: '/dashboard/analytics' },
      { icon: Lightbulb, label: 'Predictions', href: '/dashboard/predictions' },
      {
        icon: Target,
        label: 'Benchmarks',
        href: '/dashboard/analytics/benchmarks',
      },
      { icon: File, label: 'Reports', href: '/dashboard/reports' },
      {
        icon: Layout,
        label: 'Report Builder',
        href: '/dashboard/reports/builder',
      },
    ],
  },
  {
    id: 'monetization',
    icon: DollarSign,
    label: 'MONETIZATION',
    items: [
      { icon: DollarSign, label: 'Revenue', href: '/dashboard/revenue' },
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
    id: 'seo',
    icon: Search,
    label: 'SEO',
    items: [
      { icon: Search, label: 'SEO Tools', href: '/dashboard/seo' },
      { icon: Globe, label: 'GEO Analysis', href: '/dashboard/geo' },
      { icon: Zap, label: 'GEO Optimiser', href: '/dashboard/geo/optimiser' },
      { icon: Map, label: 'Local SEO', href: '/dashboard/local', isNew: true },
      {
        icon: Building2,
        label: 'Google Business',
        href: '/dashboard/google-business',
        isNew: true,
      },
      { icon: BadgeCheck, label: 'E-E-A-T Builder', href: '/dashboard/eeat' },
      { icon: Shield, label: 'Quality Gate', href: '/dashboard/quality' },
    ],
  },
  {
    id: 'authority-pr',
    icon: Megaphone,
    label: 'AUTHORITY & PR',
    items: [
      { icon: Building2, label: 'Brand Builder', href: '/dashboard/brand' },
      { icon: Shield, label: 'Authority', href: '/dashboard/authority' },
      {
        icon: ShieldExclamation,
        label: 'Sentinel',
        href: '/dashboard/sentinel',
      },
      { icon: Newspaper, label: 'PR Manager', href: '/dashboard/pr' },
      { icon: Award, label: 'Awards & Directories', href: '/dashboard/awards' },
      {
        icon: LinkIcon,
        label: 'Link Prospector',
        href: '/dashboard/backlinks',
      },
      {
        icon: Wand2,
        label: 'Prompt Intelligence',
        href: '/dashboard/prompts',
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
      { icon: Sparkles, label: 'Autopilot', href: '/dashboard/autonomous', isNew: true },
      {
        icon: GitPullRequest,
        label: 'Workflows',
        href: '/dashboard/workflows',
      },
      { icon: Lock, label: 'Brand Voice', href: '/dashboard/brand-voice' },
      { icon: Star, label: 'AI Insights', href: '/dashboard/insights' },
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
      { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
    ],
  },
];

const STARTER_GROUP_IDS = new Set(['home', 'content', 'planning', 'analytics']);
const SIDEBAR_EXPANDED_KEY = 'sidebar-show-all-groups';

const MOBILE_NAV_ITEMS: NavItem[] = [
  {
    id: 'home',
    label: 'Home',
    icon: <Home className="w-5 h-5" />,
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
    icon: <Settings className="w-5 h-5" />,
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

  // Collapsed state: show only group icon linking to first item
  if (isCollapsed) {
    const firstHref = group.items[0]?.href ?? '/dashboard';
    return (
      <SidebarMenuItem>
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarMenuButton asChild size="sm">
              <Link href={firstHref}>
                <group.icon className="h-4 w-4" />
              </Link>
            </SidebarMenuButton>
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
        className="flex items-center gap-2 cursor-pointer select-none text-[10px] tracking-[0.2em] uppercase text-white/50 hover:text-white/70 transition-colors px-3 py-1.5"
        onClick={() => setIsOpen(!isOpen)}
      >
        <group.icon className="h-3 w-3 flex-shrink-0" />
        <span className="flex-1">{group.label}</span>
        <ChevronDown
          className={cn(
            'h-3 w-3 transition-transform',
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
                      'text-white/50 hover:text-white hover:bg-white/[0.04] rounded-sm transition-all',
                      isActive &&
                        'text-amber-500 bg-amber-500/[0.06] hover:text-amber-400'
                    )}
                  >
                    <Link href={item.href} className="flex items-center gap-2 w-full">
                      <item.icon className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="text-xs flex-1">{item.label}</span>
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
// DASHBOARD SIDEBAR (uses Shadcn Sidebar shell)
// ---------------------------------------------------------------------------

function DashboardSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const { user } = useUser();

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
    const isInHiddenGroup = sidebarGroups.some(
      g =>
        !STARTER_GROUP_IDS.has(g.id) &&
        g.items.some(
          item => pathname === item.href || pathname.startsWith(item.href + '/')
        )
    );
    if (isInHiddenGroup) {
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

  const visibleGroups = showAllGroups
    ? dynamicSidebarGroups
    : dynamicSidebarGroups.filter(
        g => STARTER_GROUP_IDS.has(g.id) || g.id === 'businesses'
      );

  const hiddenGroupCount = dynamicSidebarGroups.filter(
    g => !STARTER_GROUP_IDS.has(g.id) && g.id !== 'businesses'
  ).length;

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
              {visibleGroups.map(group => (
                <NavGroup key={group.id} group={group} />
              ))}
            </SidebarMenu>
          ) : (
            <>
              {visibleGroups.map(group =>
                group.id === 'businesses' ? (
                  <SidebarGroup key="businesses">
                    <SidebarGroupLabel className="text-[10px] tracking-[0.2em] uppercase text-white/50 px-3 py-1.5">
                      <Building className="h-3 w-3 mr-2" />
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

              {/* Show More / Less */}
              <button
                onClick={toggleShowAllGroups}
                aria-expanded={showAllGroups}
                className="w-full flex items-center gap-2 px-3 py-2 mt-2 text-[10px] tracking-[0.2em] uppercase text-white/50 hover:text-white/70 hover:bg-white/[0.02] rounded-sm transition-colors"
              >
                <ChevronDown
                  className={cn(
                    'w-3 h-3 transition-transform flex-shrink-0',
                    showAllGroups && 'rotate-180'
                  )}
                />
                {showAllGroups
                  ? 'Show less'
                  : `Show ${hiddenGroupCount} more sections`}
              </button>
            </>
          )}
        </TooltipProvider>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-[0.5px] border-white/[0.06] p-2">
        {!isCollapsed && (
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-white/50">Online</span>
          </div>
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
  useTokenRefresh();
  const { user } = useUser();
  const [searchValue, setSearchValue] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <ModeProvider>
      <WebSocketProvider autoConnect showConnectionStatus={false}>
        <SidebarProvider
          defaultOpen={true}
          className="min-h-screen bg-[#050508]"
        >
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
                  <Menu className="h-5 w-5" />
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
                <NotificationBell />

                {/* User Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 p-1 rounded-sm hover:bg-white/[0.04] transition-colors">
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
                    <DropdownMenuItem>
                      <button
                        onClick={() => router.push('/api/auth/signout')}
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
            <main className="p-4 md:p-6">{children}</main>
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

          {/* Product Tour — triggers on first dashboard visit after onboarding */}
          <ProductTour />
        </SidebarProvider>
      </WebSocketProvider>
    </ModeProvider>
  );
}
