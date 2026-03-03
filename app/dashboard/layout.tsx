'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTokenRefresh } from '@/hooks/useTokenRefresh';
import MobileMenu from '@/components/MobileMenu';
import { NotificationBell } from '@/components/NotificationBell';
import {
  Sparkles,
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
  ListTodo,
  Target,
  Video,
  Globe,
  Shield,
  Image,
  Database,
  Map,
  Building,
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
  Grid,
  DollarSign,
  Calculator,
  Briefcase,
  Link as LinkIcon,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { AIPMFloatingButton } from '@/components/ai-pm';
import { KeyboardHints } from '@/components/dashboard/keyboard-hints';
import { Input } from '@/components/ui/input';
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
import { SidebarGroup, type SidebarItem } from '@/components/dashboard/SidebarGroup';

// ============================================================================
// SIDEBAR GROUPS - Organized by semantic categories
// ============================================================================

const sidebarGroups: Array<{
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  items: SidebarItem[];
  defaultOpen?: boolean;
}> = [
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
    id: 'content-ai',
    icon: Sparkles,
    label: 'CONTENT & AI',
    items: [
      { icon: FileText, label: 'Content', href: '/dashboard/content' },
      { icon: File, label: 'Drafts', href: '/dashboard/content/drafts' },
      { icon: MessageSquare, label: 'AI Chat', href: '/dashboard/ai-chat' },
      { icon: Image, label: 'AI Images', href: '/dashboard/ai-images' },
      { icon: Sparkles, label: 'Optimizer', href: '/dashboard/content/optimize' },
      { icon: Layers, label: 'Multi-format', href: '/dashboard/content/multi-format' },
      { icon: Repeat, label: 'Repurposer', href: '/dashboard/content/repurpose' },
      { icon: Send, label: 'Cross-Post', href: '/dashboard/content/cross-post' },
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
      { icon: Target, label: 'Benchmarks', href: '/dashboard/analytics/benchmarks' },
      { icon: File, label: 'Reports', href: '/dashboard/reports' },
      { icon: Layout, label: 'Report Builder', href: '/dashboard/reports/builder' },
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
      { icon: TrendingUp, label: 'Viral Patterns', href: '/dashboard/patterns' },
      { icon: Target, label: 'Competitors', href: '/dashboard/competitors' },
      { icon: Bell, label: 'Listening', href: '/dashboard/listening' },
      { icon: Brain, label: 'Psychology', href: '/dashboard/psychology' },
      { icon: Beaker, label: 'Experiments', href: '/dashboard/experiments' },
    ],
  },
  {
    id: 'seo-research',
    icon: Search,
    label: 'SEO & RESEARCH',
    items: [
      { icon: Search, label: 'SEO Tools', href: '/dashboard/seo' },
      { icon: Globe, label: 'GEO Analysis', href: '/dashboard/geo' },
      { icon: Map, label: 'Local SEO', href: '/dashboard/local' },
      { icon: Users, label: 'Authors', href: '/dashboard/authors' },
      { icon: Database, label: 'Research', href: '/dashboard/research' },
      { icon: Link2, label: 'Link in Bio', href: '/dashboard/bio' },
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
      { icon: GitPullRequest, label: 'Workflows', href: '/dashboard/workflows' },
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
      { icon: MessageSquare, label: 'Collaboration', href: '/dashboard/collaboration' },
      { icon: Zap, label: 'Integrations', href: '/dashboard/integrations' },
      { icon: Link2, label: 'Webhooks', href: '/dashboard/webhooks' },
      { icon: GitPullRequest, label: 'Approvals', href: '/dashboard/approvals' },
      { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
    ],
  },
];

// ============================================================================
// PROGRESSIVE DISCLOSURE — New users see only starter groups to reduce overload.
// After clicking "Show More" the full sidebar is revealed and persisted.
// ============================================================================
const STARTER_GROUP_IDS = new Set(['main', 'content-ai', 'planning']);
const SIDEBAR_EXPANDED_KEY = 'sidebar-show-all-groups';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showAllGroups, setShowAllGroups] = useState(false);
  const { user } = useUser();
  useTokenRefresh();

  // Hydrate showAllGroups from localStorage once on mount
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_EXPANDED_KEY);
    if (stored === 'true') setShowAllGroups(true);
  }, []);

  const toggleShowAllGroups = () => {
    const next = !showAllGroups;
    setShowAllGroups(next);
    localStorage.setItem(SIDEBAR_EXPANDED_KEY, next.toString());
  };

  // Auto-expand sidebar when the user navigates to a page inside a hidden group
  // (e.g. direct-linking /dashboard/analytics while groups are collapsed)
  useEffect(() => {
    if (showAllGroups) return;
    const isInHiddenGroup = sidebarGroups.some(
      (g) =>
        !STARTER_GROUP_IDS.has(g.id) &&
        g.items.some((item) => pathname === item.href || pathname.startsWith(item.href + '/'))
    );
    if (isInHiddenGroup) {
      setShowAllGroups(true);
      localStorage.setItem(SIDEBAR_EXPANDED_KEY, 'true');
    }
  }, [pathname, showAllGroups]);

  // Insert Businesses group for multi-business owners (after MAIN group)
  const dynamicSidebarGroups = user?.isMultiBusinessOwner
    ? [
        sidebarGroups[0], // MAIN
        {
          id: 'businesses',
          icon: Building,
          label: 'BUSINESSES',
          defaultOpen: false,
          items: [
            { icon: Building, label: 'Businesses', href: '/dashboard/businesses' },
          ],
        },
        ...sidebarGroups.slice(1), // All other groups
      ]
    : sidebarGroups;

  return (
    <WebSocketProvider autoConnect showConnectionStatus={false}>
    <div className="min-h-screen bg-gray-950">
      {/* Mobile Menu Component */}
      <MobileMenu />

      {/* Desktop Sidebar - Hidden on mobile */}
      <aside
        className={cn(
          'hidden md:block fixed left-0 top-0 z-40 h-screen transition-all duration-300 bg-white/[0.02] backdrop-blur-xl border-r border-white/[0.08]',
          sidebarCollapsed ? 'w-16' : 'w-64'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-4 border-b border-white/10">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <Sparkles className="w-8 h-8 text-cyan-500" />
              {!sidebarCollapsed && (
                <span className="text-xl font-bold gradient-text">Synthex</span>
              )}
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:flex"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Navigation — progressive disclosure: show starter groups first */}
          <nav className="flex-1 space-y-2 px-2 py-4 overflow-y-auto">
            {dynamicSidebarGroups
              .filter((g) => showAllGroups || STARTER_GROUP_IDS.has(g.id))
              .map((group) => (
                sidebarCollapsed ? (
                  // Collapsed mode: show only group icons as tooltips
                  <div
                    key={group.id}
                    className="flex items-center justify-center px-2 py-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5"
                    title={group.label}
                  >
                    <group.icon className="h-5 w-5" />
                  </div>
                ) : (
                  // Expanded mode: show full sidebar groups
                  <SidebarGroup
                    key={group.id}
                    id={group.id}
                    icon={group.icon}
                    label={group.label}
                    items={group.items}
                    defaultOpen={group.defaultOpen}
                  />
                )
              ))}

            {/* Show More / Show Less toggle (only in expanded sidebar) */}
            {!sidebarCollapsed && (
              <button
                onClick={toggleShowAllGroups}
                className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded-lg transition-colors"
              >
                <ChevronDown
                  className={cn(
                    'w-3.5 h-3.5 transition-transform',
                    showAllGroups && 'rotate-180'
                  )}
                />
                {showAllGroups
                  ? 'Show Less'
                  : `Show More (${dynamicSidebarGroups.filter((g) => !STARTER_GROUP_IDS.has(g.id) && g.id !== 'businesses').length} more)`
                }
              </button>
            )}
          </nav>

          {/* Help Section */}
          <div className="border-t border-white/10 p-4">
            <Link
              href="/dashboard/help"
              className="flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-white"
            >
              <HelpCircle className="h-5 w-5" />
              {!sidebarCollapsed && <span>Help & Support</span>}
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={cn(
        'transition-all duration-300',
        sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'
      )}>
        {/* Top Navigation */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/[0.08] bg-white/[0.02] backdrop-blur-xl px-3 sm:px-4 md:px-6">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <Input
                type="search"
                placeholder="Search..."
                aria-label="Search"
                className="w-40 sm:w-48 md:w-64 pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Business Switcher (multi-business owners only) */}
            {user?.isMultiBusinessOwner && <BusinessSwitcher />}

            {/* Notifications */}
            <NotificationBell />

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full" aria-label="User menu">
                  <Avatar className="h-10 w-10">
                    {user?.avatar && <AvatarImage src={user.avatar} alt={user.name || 'User'} />}
                    <AvatarFallback>{user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-white/[0.02] backdrop-blur-xl border-white/[0.08]" align="end">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.name || 'User'}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email || ''}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings?tab=profile" className="flex items-center cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings" className="flex items-center cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings/accounts" className="flex items-center cursor-pointer">
                    <CreditCard className="mr-2 h-4 w-4" />
                    <span>Billing</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem asChild>
                  <button
                    onClick={async () => {
                      // Call logout API to destroy server session, then clear client state
                      try {
                        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                      } catch {
                        // Best effort — proceed with client-side cleanup regardless
                      }
                      document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
                      document.cookie = 'user-info=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
                      localStorage.removeItem('user');
                      localStorage.removeItem('token-expires-at');
                      window.location.href = '/login';
                    }}
                    className="flex items-center w-full text-left text-red-400 cursor-pointer hover:text-red-500"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </button>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-3 sm:p-4 md:p-6">
          {children}
        </main>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* AI Project Manager — Floating Action Button */}
      <AIPMFloatingButton />

      {/* Keyboard Hints — Shows on first visit */}
      <KeyboardHints />
    </div>
    </WebSocketProvider>
  );
}
