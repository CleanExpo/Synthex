'use client';

import { useState } from 'react';
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

const sidebarItems = [
  { icon: Home, label: 'Dashboard', href: '/dashboard' },
  { icon: TrendingUp, label: 'Viral Patterns', href: '/dashboard/patterns' },
  { icon: Brain, label: 'Personas', href: '/dashboard/personas' },
  { icon: FileText, label: 'Content', href: '/dashboard/content' },
  { icon: Sparkles, label: 'Optimizer', href: '/dashboard/content/optimize' },
  { icon: Layers, label: 'Multi-format', href: '/dashboard/content/multi-format' },
  { icon: Palette, label: 'Sandbox', href: '/dashboard/sandbox' },
  { icon: Calendar, label: 'Schedule', href: '/dashboard/schedule' },
  { icon: ListTodo, label: 'Tasks', href: '/dashboard/tasks' },
  { icon: BarChart3, label: 'Analytics', href: '/dashboard/analytics' },
  { icon: Lightbulb, label: 'Predictions', href: '/dashboard/predictions' },
  { icon: File, label: 'Reports', href: '/dashboard/reports' },
  { icon: Layout, label: 'Report Builder', href: '/dashboard/reports/builder' },
  { icon: Beaker, label: 'Experiments', href: '/dashboard/experiments' },
  { icon: Brain, label: 'Psychology', href: '/dashboard/psychology' },
  { icon: Target, label: 'Competitors', href: '/dashboard/competitors' },
  { icon: Video, label: 'Video', href: '/dashboard/video' },
  { icon: Search, label: 'SEO Tools', href: '/dashboard/seo' },
  { icon: Globe, label: 'GEO Analysis', href: '/dashboard/geo' },
  { icon: Users, label: 'Authors', href: '/dashboard/authors' },
  { icon: Database, label: 'Research', href: '/dashboard/research' },
  { icon: Image, label: 'Visuals', href: '/dashboard/visuals' },
  { icon: Map, label: 'Local SEO', href: '/dashboard/local' },
  { icon: Users, label: 'Team', href: '/dashboard/team' },
  { icon: Zap, label: 'Integrations', href: '/dashboard/integrations' },
  { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useUser();
  useTokenRefresh();

  // Conditionally add Businesses item for multi-business owners
  const dynamicSidebarItems = user?.isMultiBusinessOwner
    ? [
        ...sidebarItems.slice(0, 1), // Dashboard
        { icon: Building, label: 'Businesses', href: '/dashboard/businesses' },
        ...sidebarItems.slice(1),
      ]
    : sidebarItems;

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

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-2 py-4">
            {dynamicSidebarItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
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
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/[0.08] bg-white/[0.02] backdrop-blur-xl px-6">
          <div className="flex items-center space-x-4">
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
                className="w-64 pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
              />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Business Switcher (multi-business owners only) */}
            {user?.isMultiBusinessOwner && <BusinessSwitcher />}

            {/* Notifications */}
            <NotificationBell />

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
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
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/billing" className="flex items-center cursor-pointer">
                    <CreditCard className="mr-2 h-4 w-4" />
                    <span>Billing</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem className="text-red-400">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
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
