'use client';

import Link from 'next/link';
import {
  FileText,
  BarChart3,
  Megaphone,
  Globe,
  ArrowUpRight,
} from '@/components/icons';
import { DashboardPanel, DashboardEyebrow } from './DashboardAtmosphere';

const ACTIONS = [
  {
    href: '/dashboard/content',
    label: 'Content',
    hint: 'Draft & publish',
    icon: FileText,
  },
  {
    href: '/dashboard/campaigns',
    label: 'Campaigns',
    hint: 'Brand → assets',
    icon: Megaphone,
  },
  {
    href: '/dashboard/analytics',
    label: 'Analytics',
    hint: 'Performance',
    icon: BarChart3,
  },
  {
    href: '/dashboard/platforms',
    label: 'Platforms',
    hint: 'Connections',
    icon: Globe,
  },
] as const;

/** Premium shortcut rail — one job: jump to daily work without leaving Mission Control. */
export function DashboardQuickRail() {
  return (
    <DashboardPanel padded={false} className="overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-white/6 flex items-end justify-between gap-3">
        <div>
          <DashboardEyebrow>Workspace</DashboardEyebrow>
          <p className="text-sm text-white/70 font-light">Daily tools</p>
        </div>
        <Link
          href="/dashboard/content"
          className="text-xs text-orange-400/80 hover:text-orange-400 inline-flex items-center gap-1"
        >
          Create post
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-white/6">
        {ACTIONS.map(a => (
          <Link
            key={a.href}
            href={a.href}
            className="group flex items-start gap-3 px-4 py-4 hover:bg-white/[0.02] transition-colors"
          >
            <div className="mt-0.5 h-8 w-8 flex items-center justify-center border-[0.5px] border-white/8 bg-white/[0.02] rounded-sm group-hover:border-orange-500/30 transition-colors">
              <a.icon className="h-3.5 w-3.5 text-white/45 group-hover:text-orange-400 transition-colors" />
            </div>
            <div>
              <p className="text-sm text-white/80 font-light group-hover:text-white transition-colors">
                {a.label}
              </p>
              <p className="text-xs text-white/30 mt-0.5">{a.hint}</p>
            </div>
          </Link>
        ))}
      </div>
    </DashboardPanel>
  );
}
