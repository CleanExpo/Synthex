'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { DashboardPerformancePulse } from '@/components/dashboard/DashboardPerformancePulse';
import { HealthScoreWidget } from '@/components/dashboard/HealthScoreWidget';
import { VisibilityScoreWidget } from '@/components/dashboard/VisibilityScoreWidget';

const AICommandCentre = dynamic(
  () =>
    import('@/components/command-centre').then(m => ({
      default: m.AICommandCentre,
    })),
  { ssr: false }
);

const MissionControlHome = dynamic(
  () =>
    import('@/components/mission-control').then(m => ({
      default: m.MissionControlHome,
    })),
  { ssr: false }
);

/**
 * Engineering ticket desk — not the customer home.
 * Reachable from Power Tools.
 */
export default function MissionControlPage() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-white/45">
        This is the engineering desk (goals and tickets). Daily posting lives on{' '}
        <Link
          href="/dashboard"
          className="text-orange-400 hover:text-orange-300"
        >
          Home
        </Link>
        .
      </p>
      <MissionControlHome
        legacyCommandCentre={<AICommandCentre />}
        insights={
          <>
            <DashboardPerformancePulse />
            <div className="grid gap-4 lg:grid-cols-2">
              <HealthScoreWidget />
              <VisibilityScoreWidget />
            </div>
          </>
        }
      />
    </div>
  );
}
