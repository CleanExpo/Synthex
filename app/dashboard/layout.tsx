'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTokenRefresh } from '@/hooks/useTokenRefresh';
import { fireEngagementEvent } from '@/lib/analytics/engagement-events';
import MobileMenu from '@/components/MobileMenu';
import { NotificationBell } from '@/components/NotificationBell';
import {
  FileText,
  BarChart3,
  Settings,
  HelpCircle,
  Search,
  User,
  LogOut,
  CreditCard,
  Layers,
} from '@/components/icons';
import { AIPMFloatingButton } from '@/components/ai-pm';
import { PauseButton } from '@/components/autonomous/PauseButton';
import { KeyboardHints } from '@/components/dashboard/keyboard-hints';
import { AutoBreadcrumbs } from '@/components/dashboard/auto-breadcrumbs';
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
  sidebarMenuButtonVariants,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Icon3D } from '@/components/icons/Icon3D';
import {
  AdvancedPageShell,
  AdvancedSidebarSections,
} from '@/components/dashboard/advanced';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import {
  BASIC_NAV_ITEMS,
  SIDEBAR_ADVANCED_KEY,
  isAdvancedDashboardPath,
  isSidebarPathActive,
} from '@/lib/dashboard/sidebar-nav';
import { SIDEBAR_ICONS } from '@/lib/dashboard/sidebar-icons';

interface SidebarNavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  description?: string;
  isNew?: boolean;
}

function mapNavItems(defs: typeof BASIC_NAV_ITEMS): SidebarNavItem[] {
  return defs.map(def => ({
    icon: SIDEBAR_ICONS[def.iconKey] ?? FileText,
    label: def.label,
    href: def.href,
    description: def.description,
    isNew: def.isNew,
  }));
}

const basicNavItems = mapNavItems(BASIC_NAV_ITEMS);

const MOBILE_NAV_ITEMS: NavItem[] = [
  {
    id: 'home',
    label: 'Mission',
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

function NavItemLink({
  item,
  collapsed,
}: {
  item: SidebarNavItem;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const isActive = isSidebarPathActive(pathname, item.href);
  const link = (
    <Link
      href={item.href}
      className={cn(
        sidebarMenuButtonVariants({ size: 'sm' }),
        'text-white/65 hover:text-white hover:bg-white/4 rounded-sm transition-all',
        isActive &&
          'text-orange-400 bg-orange-500/10 hover:text-orange-400 hover:bg-orange-500/12',
        collapsed && 'justify-center'
      )}
      aria-current={isActive ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="text-[13px] flex-1">{item.label}</span>}
      {!collapsed && item.isNew && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-500" />
        </span>
      )}
    </Link>
  );

  if (!collapsed && item.description) {
    return (
      <SidebarMenuItem>
        <Tooltip>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent
            side="right"
            className="bg-[var(--mode-surface)] border-white/10 text-white/70 text-xs max-w-[240px]"
          >
            <p className="text-white/85">{item.label}</p>
            <p className="text-white/45 mt-1 leading-relaxed">
              {item.description}
            </p>
          </TooltipContent>
        </Tooltip>
      </SidebarMenuItem>
    );
  }

  if (!collapsed) {
    return <SidebarMenuItem>{link}</SidebarMenuItem>;
  }

  return (
    <SidebarMenuItem>
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent
          side="right"
          className="bg-[#0a0a12] border-white/10 text-white/70 text-xs"
        >
          {item.label}
        </TooltipContent>
      </Tooltip>
    </SidebarMenuItem>
  );
}

function BasicNavList({ collapsed }: { collapsed: boolean }) {
  return (
    <SidebarMenu
      className={cn(collapsed ? 'py-3 px-2 gap-1' : 'px-2 py-2 gap-0.5')}
    >
      {basicNavItems.map(item => (
        <NavItemLink key={item.href} item={item} collapsed={collapsed} />
      ))}
    </SidebarMenu>
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

  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    const stored =
      localStorage.getItem(SIDEBAR_ADVANCED_KEY) ??
      localStorage.getItem('sidebar-show-all-groups');
    if (stored === 'true') setShowAdvanced(true);
  }, []);

  const toggleAdvanced = () => {
    const next = !showAdvanced;
    setShowAdvanced(next);
    localStorage.setItem(SIDEBAR_ADVANCED_KEY, next.toString());
  };

  useEffect(() => {
    if (showAdvanced) return;
    const isAdvancedRoute = isAdvancedDashboardPath(pathname);
    if (isAdvancedRoute) {
      setShowAdvanced(true);
      localStorage.setItem(SIDEBAR_ADVANCED_KEY, 'true');
    }
  }, [pathname, showAdvanced]);

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-[0.5px] border-white/6 bg-[#0a0a12] [&>div]:bg-[#0a0a12]"
    >
      <SidebarHeader className="border-b border-[0.5px] border-white/6 h-14 flex-row items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <SynthexLogo className="w-7 h-7 shrink-0 opacity-90 group-hover:opacity-100 transition-opacity" />
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-light tracking-[0.22em] text-white uppercase">
                Synthex
              </span>
              <span className="text-xs tracking-[0.16em] uppercase text-white/30 truncate">
                Mission Control
              </span>
            </div>
          )}
        </Link>
        {!isCollapsed && (
          <SidebarTrigger className="text-white/50 hover:text-white/80 transition-colors h-6 w-6" />
        )}
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin">
        <TooltipProvider delayDuration={0}>
          <BasicNavList collapsed={isCollapsed} />

          {user?.isMultiBusinessOwner &&
            !isStaticReviewRoute &&
            !isCollapsed && (
              <SidebarGroup>
                <SidebarGroupLabel className="text-xs tracking-[0.18em] uppercase text-white/40 px-3 py-1">
                  Businesses
                </SidebarGroupLabel>
                <SidebarGroupContent className="px-2">
                  <BusinessSwitcher />
                </SidebarGroupContent>
              </SidebarGroup>
            )}

          {showAdvanced && !isCollapsed && <AdvancedSidebarSections />}
        </TooltipProvider>
      </SidebarContent>

      <SidebarFooter className="border-t border-[0.5px] border-white/6 p-2">
        {isCollapsed ? (
          <button
            type="button"
            onClick={toggleAdvanced}
            aria-pressed={showAdvanced}
            aria-label="Advanced tools"
            className={cn(
              'flex w-full items-center justify-center rounded-sm p-2 transition-colors',
              showAdvanced
                ? 'text-orange-400'
                : 'text-white/40 hover:text-white/70'
            )}
          >
            <Layers className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={toggleAdvanced}
            aria-pressed={showAdvanced}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs tracking-[0.15em] uppercase text-white/40 hover:text-white/60 hover:bg-white/2 rounded-sm transition-colors"
          >
            <Layers className="w-3 h-3 shrink-0" />
            <span className="flex-1 text-left">Advanced</span>
            <div
              className={cn(
                'relative w-7 h-3.5 rounded-full transition-colors shrink-0',
                showAdvanced ? 'bg-orange-500/70' : 'bg-white/10'
              )}
            >
              <div
                className={cn(
                  'absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow-sm transition-all',
                  showAdvanced ? 'left-[calc(100%-12px)]' : 'left-0.5'
                )}
              />
            </div>
          </button>
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const needsOnboarding = user?.onboardingComplete === false;
  const isDashboardHome = pathname === '/dashboard';

  useEffect(() => {
    if (isStaticReviewRoute || !needsOnboarding) return;
    router.replace('/onboarding');
  }, [isStaticReviewRoute, needsOnboarding, router]);

  // SYN-612: client engagement telemetry. Fires dashboard_visit on every
  // dashboard page load (debounced to 1 / 30-min window / page / session inside
  // the helper). Skips the static marketing-agency review routes.
  useEffect(() => {
    if (isStaticReviewRoute || needsOnboarding) return;
    fireEngagementEvent('dashboard_visit', { pagePath: pathname });
  }, [pathname, isStaticReviewRoute, needsOnboarding]);

  if (needsOnboarding) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#050508]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-orange-500" />
      </div>
    );
  }

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
          <header className="sticky top-0 z-30 flex items-center justify-between h-14 border-b border-[0.5px] border-white/6 bg-[#050508]/85 backdrop-blur-md px-4 md:px-6">
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

              {/* Search — opens the ⌘K command palette (discoverability) */}
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(new Event('openCommandPalette'))
                }
                aria-label="Open command palette"
                className="group relative flex items-center w-40 sm:w-52 md:w-72 pl-8 pr-2 py-1.5 text-xs bg-white/[0.02] border-[0.5px] border-white/6 text-white/40 rounded-sm hover:border-orange-500/35 hover:text-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 transition-colors"
              >
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40 pointer-events-none" />
                <span className="flex-1 text-left">Search workspace…</span>
                <kbd className="hidden sm:inline px-1.5 py-0.5 text-xs font-medium bg-white/4 border-[0.5px] border-white/8 rounded-sm text-white/45">
                  ⌘K
                </kbd>
              </button>
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
                  <button className="flex items-center gap-2 p-2 rounded-sm hover:bg-white/4 transition-colors focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user?.avatar ?? undefined} />
                      <AvatarFallback className="bg-orange-500/10 text-orange-400 text-xs">
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
                  className="w-48 bg-[#0a0a12] border-white/8 rounded-sm"
                >
                  <DropdownMenuLabel className="text-xs text-white/40 font-normal">
                    {user?.email ?? 'Account'}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/6" />
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
                  <DropdownMenuSeparator className="bg-white/6" />
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
                  <DropdownMenuSeparator className="bg-white/6" />
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
          <main className="relative flex-1 p-4 md:p-6 lg:p-8">
            {!isStaticReviewRoute && !isDashboardHome && (
              <AutoBreadcrumbs className="mb-4" />
            )}
            {!isStaticReviewRoute && (
              <>
                <BillingStatusBanner />
                <FirstWinBanner className="mb-5" />
                {!isDashboardHome && (
                  <>
                    <TeamInviteBanner />
                    <GA4ConnectBanner />
                  </>
                )}
              </>
            )}
            <AdvancedPageShell>{children}</AdvancedPageShell>
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
