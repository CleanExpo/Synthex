'use client';

/**
 * app/dashboard/layout.tsx
 *
 * Dashboard shell with Shadcn Sidebar.
 * Design system: charcoal background, amber accents, "Scientific Luxury" aesthetic.
 *
 * Sidebar groups:
 *  ① Core        — Overview, Analytics, Autopilot
 *  ② Content     — Content Library, Content Drafts, Creative Suite, Visuals
 *  ③ Audience    — Geo, Voice, Referrals, Awards
 *  ④ Authority   — E-E-A-T, Citation, Bio
 *  ⑤ Business    — ROI, Sponsors, Experiments
 *  ⑥ SEO         — Local SEO, Google Business, Search Console
 */

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard,
  BarChart3,
  Bot,
  Library,
  FileEdit,
  Palette,
  Image,
  Globe,
  Mic,
  Users,
  Trophy,
  Star,
  Link2,
  User,
  TrendingUp,
  Building2,
  FlaskConical,
  MapPin,
  Store,
  Search,
  ChevronLeft,
  ChevronRight,
  Settings,
  LogOut,
  Bell,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types & nav config
// ─────────────────────────────────────────────────────────────────────────────

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Core',
    items: [
      { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
      { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/dashboard/autopilot', label: 'Autopilot', icon: Bot, badge: 'New' },
    ],
  },
  {
    label: 'Content',
    items: [
      { href: '/dashboard/content-library', label: 'Library', icon: Library },
      { href: '/dashboard/content-drafts', label: 'Drafts', icon: FileEdit },
      { href: '/dashboard/creative-suite', label: 'Creative Suite', icon: Palette },
      { href: '/dashboard/visuals', label: 'Visuals', icon: Image },
    ],
  },
  {
    label: 'Audience',
    items: [
      { href: '/dashboard/geo', label: 'Geographic', icon: Globe },
      { href: '/dashboard/voice', label: 'Brand Voice', icon: Mic },
      { href: '/dashboard/referrals', label: 'Referrals', icon: Users },
      { href: '/dashboard/awards', label: 'Awards', icon: Trophy },
    ],
  },
  {
    label: 'Authority',
    items: [
      { href: '/dashboard/eeat', label: 'E-E-A-T Score', icon: Star },
      { href: '/dashboard/citation', label: 'Citations', icon: Link2 },
      { href: '/dashboard/bio', label: 'Bio Pages', icon: User },
    ],
  },
  {
    label: 'Business',
    items: [
      { href: '/dashboard/roi', label: 'ROI', icon: TrendingUp },
      { href: '/dashboard/sponsors', label: 'Sponsors', icon: Building2 },
      { href: '/dashboard/experiments', label: 'Experiments', icon: FlaskConical },
    ],
  },
  {
    label: 'Local SEO',
    items: [
      { href: '/dashboard/geo', label: 'Local SEO', icon: MapPin, badge: 'New' },
      { href: '/dashboard/google-business', label: 'Google Business', icon: Store, badge: 'New' },
      { href: '/dashboard/seo-search-console', label: 'Search Console', icon: Search },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// NavItem component
// ─────────────────────────────────────────────────────────────────────────────

function SidebarNavItem({
  item,
  collapsed,
  active,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={`
        flex items-center gap-2.5 px-2.5 py-2 rounded-sm text-sm transition-all duration-150 group relative
        ${active
          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
          : 'text-white/40 hover:text-white/80 hover:bg-white/[0.04] border border-transparent'
        }
        ${collapsed ? 'justify-center px-2' : ''}
      `}
    >
      <Icon
        className={`h-4 w-4 flex-shrink-0 ${active ? 'text-amber-400' : 'text-white/30 group-hover:text-white/60'}`}
      />
      {!collapsed && (
        <>
          <span className="truncate flex-1">{item.label}</span>
          {item.badge && (
            <Badge
              variant="outline"
              className="text-[9px] px-1 py-0 h-4 text-amber-400 border-amber-400/30 bg-amber-400/10 flex-shrink-0"
            >
              {item.badge}
            </Badge>
          )}
        </>
      )}
      {collapsed && item.badge && (
        <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-amber-400" />
      )}
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar component
// ─────────────────────────────────────────────────────────────────────────────

function DashboardSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={`
        relative flex flex-col h-full
        bg-[rgb(12_12_20)] border-r border-white/[0.06]
        transition-all duration-200 ease-in-out
        ${collapsed ? 'w-[52px]' : 'w-[220px]'}
      `}
    >
      {/* Logo / Brand */}
      <div className={`flex items-center h-14 px-3 border-b border-white/[0.06] flex-shrink-0 ${collapsed ? 'justify-center' : 'gap-2.5'}`}>
        <div className="h-7 w-7 rounded-sm bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
          <span className="text-amber-400 text-xs font-bold">S</span>
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold text-white tracking-wide">SYNTHEX</span>
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="text-[10px] uppercase tracking-widest text-white/20 px-2.5 mb-1.5">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <SidebarNavItem
                  key={item.href}
                  item={item}
                  collapsed={collapsed}
                  active={pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className={`border-t border-white/[0.06] p-2 space-y-0.5 flex-shrink-0`}>
        <Link
          href="/dashboard/settings"
          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-sm text-sm text-white/30 hover:text-white/70 hover:bg-white/[0.04] transition-colors ${collapsed ? 'justify-center' : ''}`}
        >
          <Settings className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span>Settings</span>}
        </Link>
        <Link
          href="/api/auth/signout"
          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-sm text-sm text-white/30 hover:text-white/70 hover:bg-white/[0.04] transition-colors ${collapsed ? 'justify-center' : ''}`}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </Link>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-[60px] h-6 w-6 rounded-full bg-[rgb(18_18_30)] border border-white/[0.1] flex items-center justify-center text-white/40 hover:text-white/80 hover:border-amber-500/30 transition-all z-10"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Top bar
// ─────────────────────────────────────────────────────────────────────────────

function TopBar() {
  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-white/[0.06] flex-shrink-0">
      <div />
      <div className="flex items-center gap-3">
        <button className="relative h-8 w-8 rounded-sm text-white/30 hover:text-white/70 hover:bg-white/[0.04] flex items-center justify-center transition-colors">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-400" />
        </button>
        <div className="h-7 w-7 rounded-sm bg-amber-500/20 border border-amber-500/20 flex items-center justify-center">
          <span className="text-amber-300 text-xs font-medium">P</span>
        </div>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-[rgb(10_10_18)] overflow-hidden">
      <DashboardSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
