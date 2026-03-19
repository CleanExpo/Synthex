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
import {
  SidebarGroup,
  type SidebarItem,
} from '@/components/dashboard/SidebarGroup';
import { SynthexLogo } from '@/components/landing/synthex-logo';
import { BottomMenu } from '@/components/landing/bottom-menu';
import type { NavItem } from '@/components/landing/bottom-menu';
import { useRouter } from 'next/navigation';
import { ModeProvider } from '@/components/providers/mode-provider';

// ============================================================================
// SIDEBAR GROUPS
// ============================================================================

const sidebarGroups: Array<{
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  items: SidebarItem[];
  defaultOpen?: boolean;
}> = [
  {
    id: 'command-centre',
    icon: CommandLine,
    label: 'COMMAND CENTRE',
    defaultOpen: true,
    items: [
      {
        icon: CommandLine,
        label: 'Citation Dashboard',
        href: '/dashboard/citation',
      },
    ],
  },
  {
    id: 'main',
    icon: Home,
    label: 'MAIN',
    defaultOpen: true,
    items: [
      { icon: Home, label: 'Dashboard', href: '/dashboard' },
      { icon: Grid, label: 'Unified View', href: '/dashboard/unified' },
      { icon: Globe, label: 'Platforms', href: '/dashboard/platforms' },
    ],
  },
  {
    id: 'creative-suite',
    icon: Sparkles,
    label: 'CREATIVE SUITE',
    items: [
      {
        icon: Sparkles,
        label: 'Creative Suite',
        href: '/dashboard/creative-suite',
      },
    ],
  },
  {
    id: 'content-ai',
    icon: Sparkles,
    label: 'CONTENT & AI',
    items: [
      { icon: FileText, label: 'Content', href: '/dashboard/content' },
      { icon: File, label: 'Drafts', href: '/dashboard/content/drafts' },
      { icon: MessageSquare, label: 'AI Chat', href: '/dashboard/ai-chat' },
      { icon: Image, label: 'AI Images', href: '/dashboard/ai-images' },
      {
        icon: Sparkles,
        label: 'Optimizer',
        href: '/dashboard/content/optimize',
      },
      {
        icon: Layers,
        label: 'Multi-format',
        href: '/dashboard/content/multi-format',
      },
      {
        icon: Repeat,
        label: 'Repurposer',
        href: '/dashboard/content/repurpose',
      },
      {
        icon: Send,
        label: 'Cross-Post',
        href: '/dashboard/content/cross-post',
      },
      { icon: BookOpen, label: 'Library', href: '/dashboard/content/library' },
      { icon: Palette, label: 'Sandbox', href: '/dashboard/sandbox' },
    ],
  },
  {
    id: 'planning',
    icon: Calendar,
    label: 'PLANNING',
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
      {
        icon: TrendingUp,
        label: 'Viral Patterns',
        href: '/dashboard/patterns',
      },
      { icon: Target, label: 'Competitors', href: '/dashboard/competitors' },
      { icon: Bell, label: 'Listening', href: '/dashboard/listening' },
      { icon: Brain, label: 'Psychology', href: '/dashboard/psychology' },
      { icon: Beaker, label: 'Experiments', href: '/dashboard/experiments' },
      { icon: Brain, label: 'Optimisation', href: '/dashboard/optimisation' },
      {
        icon: TrendingUp,
        label: 'Forecasting',
        href: '/dashboard/forecasting',
      },
    ],
  },
  {
    id: 'seo-research',
    icon: Search,
    label: 'SEO & RESEARCH',
    items: [
      { icon: Search, label: 'SEO Tools', href: '/dashboard/seo' },
      { icon: Globe, label: 'GEO Analysis', href: '/dashboard/geo' },
      { icon: Zap, label: 'GEO Optimiser', href: '/dashboard/geo/optimiser' },
      { icon: Mic, label: 'Voice Engine', href: '/dashboard/voice' },
      { icon: Shield, label: 'Quality Gate', href: '/dashboard/quality' },
      { icon: Award, label: 'E-E-A-T Builder', href: '/dashboard/eeat' },
      { icon: Building2, label: 'Brand Builder', href: '/dashboard/brand' },
      { icon: Shield, label: 'Authority', href: '/dashboard/authority' },
      { icon: Map, label: 'Local SEO', href: '/dashboard/local' },
      {
        icon: ShieldExclamation,
        label: 'Sentinel',
        href: '/dashboard/sentinel',
      },
      { icon: Users, label: 'Authors', href: '/dashboard/authors' },
      { icon: Database, label: 'Research', href: '/dashboard/research' },
      { icon: Link2, label: 'Link in Bio', href: '/dashboard/bio' },
    ],
  },
  {
    id: 'pr-manager',
    icon: Newspaper,
    label: 'PR MANAGER',
    items: [
      { icon: Newspaper, label: 'PR Manager', href: '/dashboard/pr' },
      { icon: Award, label: 'Awards & Directories', href: '/dashboard/awards' },
      {
        icon: LinkIcon,
        label: 'Link Prospector',
        href: '/dashboard/backlinks',
      },
      {
        icon: Sparkles,
        label: 'Prompt Intelligence',
        href: '/dashboard/prompts',
      },
    ],
  },
  {
    id: 'media',
    icon: Video,
    label: 'MEDIA',
    items: [
      { icon: Video, label: 'Video', href: '/dashboard/video' },
      { icon: Image, label: 'Visuals', href: '/dashboard/visuals' },
      { icon: Brain, label: 'Personas', href: '/dashboard/personas' },
    ],
  },
  {
    id: 'web-projects',
    icon: Globe,
    label: 'WEB PROJECTS',
    items: [
      { icon: Globe, label: 'Projects', href: '/dashboard/web-projects' },
    ],
  },
  {
    id: 'ai-agents',
    icon: GitPullRequest,
    label: 'AI AGENTS',
    items: [
      { icon: Sparkles, label: 'Autonomous', href: '/dashboard/autonomous' },
      {
        icon: GitPullRequest,
        label: 'Workflows',
        href: '/dashboard/workflows',
      },
      { icon: Shield, label: 'Brand Voice', href: '/dashboard/brand-voice' },
      { icon: Lightbulb, label: 'AI Insights', href: '/dashboard/insights' },
    ],
  },
  {
    id: 'team-admin',
    icon: Shield,
    label: 'TEAM & ADMIN',
    items: [
      { icon: Users, label: 'Team', href: '/dashboard/team' },
      { icon: Shield, label: 'Roles', href: '/dashboard/roles' },
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
      { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
    ],
  },
];

const STARTER_GROUP_IDS = new Set([
  'main',
  'creative-suite',
  'content-ai',
  'planning',
  'analytics',
]);
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showAllGroups, setShowAllGroups] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const { user } = useUser();
  useTokenRefresh();

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
          defaultOpen: false,
          items: [
            {
              icon: Building,
              label: 'Businesses',
              href: '/dashboard/businesses',
            },
          ],
        },
        ...sidebarGroups.slice(1),
      ]
    : sidebarGroups;

  const visibleGroups = dynamicSidebarGroups.filter(
    g => showAllGroups || STARTER_GROUP_IDS.has(g.id)
  );

  const hiddenGroupCount = dynamicSidebarGroups.filter(
    g => !STARTER_GROUP_IDS.has(g.id) && g.id !== 'businesses'
  ).length;

  return (
    <ModeProvider>
      <WebSocketProvider autoConnect showConnectionStatus={false}>
        <div className="min-h-screen bg-[#0a1628]">
          {/* Mobile Menu */}
          <MobileMenu />

          {/* Desktop Sidebar */}
          <aside
            className={cn(
              'hidden md:flex fixed left-0 top-0 z-40 h-screen flex-col transition-all duration-300',
              'bg-[#080e1a] border-r border-[0.5px] border-white/[0.06]',
              sidebarCollapsed ? 'w-14' : 'w-60'
            )}
          >
            {/* Logo */}
            <div
              className={cn(
                'flex h-14 items-center border-b border-[0.5px] border-white/[0.06] flex-shrink-0',
                sidebarCollapsed
                  ? 'justify-center px-0'
                  : 'justify-between px-4'
              )}
            >
              <Link
                href="/dashboard"
                className="flex items-center gap-2.5 group"
              >
                <SynthexLogo className="w-7 h-7 flex-shrink-0 opacity-90 group-hover:opacity-100 transition-opacity" />
                {!sidebarCollapsed && (
                  <span className="text-xs font-light tracking-[0.2em] text-white uppercase">
                    Synthex
                  </span>
                )}
              </Link>
              {!sidebarCollapsed && (
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  className="hidden lg:flex p-1 text-white/25 hover:text-white/60 transition-colors rounded-sm"
                  aria-label="Collapse sidebar"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
              )}
              {sidebarCollapsed && (
                <button
                  onClick={() => setSidebarCollapsed(false)}
                  className="absolute -right-3 top-5 flex items-center justify-center w-6 h-6 bg-[#080e1a] border border-[0.5px] border-white/[0.1] rounded-sm text-white/40 hover:text-white/70 transition-colors"
                  aria-label="Expand sidebar"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 min-h-0 overflow-y-auto py-3 scrollbar-thin">
              {sidebarCollapsed ? (
                // Collapsed: icon-only links per group
                <div className="flex flex-col items-center gap-1 px-2">
                  {visibleGroups.map(group => (
                    <Link
                      key={group.id}
                      href={group.items[0]?.href ?? '/dashboard'}
                      className="flex items-center justify-center w-9 h-9 text-white/30 hover:text-white/70 hover:bg-white/[0.04] rounded-sm transition-all"
                      aria-label={group.label}
                      title={group.label}
                    >
                      <group.icon className="h-4 w-4" />
                    </Link>
                  ))}
                </div>
              ) : (
                // Expanded: full sidebar groups
                <div className="px-2 space-y-0.5">
                  {visibleGroups.map(group => (
                    <SidebarGroup
                      key={group.id}
                      id={group.id}
                      icon={group.icon}
                      label={group.label}
                      items={group.items}
                      defaultOpen={group.defaultOpen}
                    />
                  ))}

                  {/* Show More / Less */}
                  <button
                    onClick={toggleShowAllGroups}
                    aria-expanded={showAllGroups}
                    className="w-full flex items-center gap-2 px-3 py-2 mt-2 text-[10px] tracking-[0.2em] uppercase text-white/25 hover:text-white/50 hover:bg-white/[0.02] rounded-sm transition-colors"
                  >
                    <ChevronDown
                      className={cn(
                        'w-3 h-3 transition-transform flex-shrink-0',
                        showAllGroups && 'rotate-180'
                      )}
                    />
                    {showAllGroups
                      ? 'Show Less'
                      : `${hiddenGroupCount} More Sections`}
                  </button>
                </div>
              )}
            </nav>

            {/* Help */}
            <div className="border-t border-[0.5px] border-white/[0.06] p-3 flex-shrink-0">
              <Link
                href="/dashboard/help"
                className={cn(
                  'flex items-center gap-2.5 text-white/30 hover:text-white/60 hover:bg-white/[0.03] rounded-sm px-2 py-2 transition-all text-xs',
                  sidebarCollapsed && 'justify-center px-0'
                )}
              >
                <HelpCircle className="h-4 w-4 flex-shrink-0" />
                {!sidebarCollapsed && (
                  <span className="tracking-wide">Help & Support</span>
                )}
              </Link>
            </div>
          </aside>

          {/* Main Content */}
          <div
            className={cn(
              'transition-all duration-300',
              sidebarCollapsed ? 'lg:pl-14' : 'lg:pl-60'
            )}
          >
            {/* Top Header */}
            <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-[#080e1a]/95 backdrop-blur-md border-b border-[0.5px] border-white/[0.06] px-4 md:px-6">
              {/* Left: mobile toggle + search */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="lg:hidden p-1.5 text-white/40 hover:text-white transition-colors rounded-sm"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </button>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25 pointer-events-none" />
                  <input
                    type="search"
                    placeholder="Search..."
                    value={searchValue}
                    onChange={e => setSearchValue(e.target.value)}
                    aria-label="Search"
                    className="w-40 sm:w-52 md:w-64 pl-8 pr-3 py-1.5 text-xs bg-white/[0.02] border-[0.5px] border-white/[0.06] text-white/70 placeholder:text-white/20 rounded-sm focus:outline-none focus:border-white/20 focus:bg-white/[0.04] transition-all"
                  />
                </div>
              </div>

              {/* Right: business switcher, notifications, user */}
              <div className="flex items-center gap-3">
                {user?.isMultiBusinessOwner && <BusinessSwitcher />}

                <NotificationBell />

                {/* User dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex items-center gap-2 p-1 rounded-sm hover:bg-white/[0.04] transition-colors"
                      aria-label="User menu"
                    >
                      <Avatar className="h-7 w-7 rounded-sm">
                        {user?.avatar && (
                          <AvatarImage
                            src={user.avatar}
                            alt={user.name || 'User'}
                          />
                        )}
                        <AvatarFallback className="rounded-sm bg-cyan-500/20 text-cyan-400 text-xs font-mono">
                          {user?.name?.[0]?.toUpperCase() ||
                            user?.email?.[0]?.toUpperCase() ||
                            'U'}
                        </AvatarFallback>
                      </Avatar>
                      {user?.name && (
                        <span className="hidden md:block text-xs text-white/50 max-w-[100px] truncate">
                          {user.name}
                        </span>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-52 bg-[#080e1a] border-[0.5px] border-white/[0.1] rounded-sm shadow-xl shadow-black/40"
                    align="end"
                  >
                    <DropdownMenuLabel className="font-normal px-3 py-2">
                      <div className="flex flex-col gap-0.5">
                        <p className="text-xs font-medium text-white">
                          {user?.name || 'User'}
                        </p>
                        <p className="text-[10px] text-white/40 truncate">
                          {user?.email || ''}
                        </p>
                      </div>
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
                        href="/dashboard/billing"
                        className="flex items-center gap-2.5 px-3 py-2 text-xs text-white/60 hover:text-white cursor-pointer rounded-sm"
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        Billing
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/[0.06]" />
                    <DropdownMenuItem asChild>
                      <button
                        onClick={async () => {
                          try {
                            await fetch('/api/auth/logout', {
                              method: 'POST',
                              credentials: 'include',
                            });
                          } catch {
                            // best effort
                          }
                          document.cookie =
                            'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
                          document.cookie =
                            'user-info=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
                          localStorage.removeItem('user');
                          localStorage.removeItem('token-expires-at');
                          window.location.href = '/login';
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs text-red-400/80 hover:text-red-400 w-full cursor-pointer rounded-sm"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Sign Out
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
        </div>
      </WebSocketProvider>
    </ModeProvider>
  );
}
