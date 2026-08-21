'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/page-header';
import { GetStartedChecklist } from '@/components/dashboard';
import { DashboardAtmosphere, DashboardPanel } from './DashboardAtmosphere';
import { DashboardQuickRail } from './DashboardQuickRail';

/** Premium first-run home — calm, single composition, clear next step. */
export function DashboardNewUserHome() {
  return (
    <DashboardAtmosphere className="mx-auto max-w-3xl space-y-8 pt-2">
      <PageHeader
        eyebrow="Welcome"
        title="Your marketing command starts here"
        description="Create one post to unlock Mission Control — goals, Linear tickets, and live shipping status."
        actions={
          <Link
            href="/dashboard/content"
            className="inline-flex items-center bg-orange-500 hover:bg-orange-400 text-black font-medium text-sm py-2.5 px-5 rounded-sm transition-colors"
          >
            Create first post
          </Link>
        }
      />

      <DashboardPanel className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-orange-500/10 to-transparent pointer-events-none"
        />
        <p className="text-xs uppercase tracking-[0.22em] text-white/30 mb-2">
          First win
        </p>
        <h2 className="text-xl font-light text-white tracking-tight max-w-md">
          One topic. Drafts for every connected platform.
        </h2>
        <p className="text-sm text-white/40 mt-2 max-w-md leading-relaxed">
          After your first publish, this home becomes Mission Control — Goal →
          Linear → ship status.
        </p>
      </DashboardPanel>

      <GetStartedChecklist />
      <DashboardQuickRail />
    </DashboardAtmosphere>
  );
}
