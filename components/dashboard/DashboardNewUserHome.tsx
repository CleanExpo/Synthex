'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/page-header';
import { GetStartedChecklist, WelcomeCard } from '@/components/dashboard';
import { DashboardAtmosphere, DashboardPanel } from './DashboardAtmosphere';
import { DashboardQuickRail } from './DashboardQuickRail';
import { useBrandProfile } from '@/hooks/use-brand-profile';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';

/** Premium first-run home — calm, single composition, clear next step. */
export function DashboardNewUserHome() {
  const { activeOrganizationId } = useActiveBusiness();
  const { profile } = useBrandProfile(activeOrganizationId);

  const businessLabel = profile?.name?.trim() || null;
  const hasProfileDetails = Boolean(
    profile &&
    (profile.description ||
      profile.website ||
      profile.industry ||
      profile.logo ||
      profile.primaryColor)
  );

  return (
    <DashboardAtmosphere className="mx-auto max-w-3xl space-y-8 pt-2">
      <PageHeader
        eyebrow="Welcome"
        title={
          businessLabel
            ? `${businessLabel} is ready`
            : 'Your marketing command starts here'
        }
        description={
          profile?.description?.trim() ||
          'Create one post to unlock Mission Control — goals, Linear tickets, and live shipping status.'
        }
        actions={
          <Link
            href="/dashboard/content"
            className="inline-flex items-center bg-orange-500 hover:bg-orange-400 text-black font-medium text-sm py-2.5 px-5 rounded-sm transition-colors"
          >
            Create first post
          </Link>
        }
      />

      {hasProfileDetails && (
        <DashboardPanel className="relative overflow-hidden">
          <div className="flex items-start gap-4">
            {profile?.logo ? (
              <img
                src={profile.logo}
                alt=""
                className="h-12 w-12 rounded-sm object-cover border border-white/10 shrink-0"
              />
            ) : profile?.primaryColor ? (
              <span
                className="h-12 w-12 rounded-sm shrink-0 border border-white/10"
                style={{ backgroundColor: profile.primaryColor }}
                aria-hidden
              />
            ) : null}
            <div className="min-w-0 space-y-1">
              <p className="text-xs uppercase tracking-[0.22em] text-white/30">
                From onboarding
              </p>
              <h2 className="text-lg font-light text-white tracking-tight truncate">
                {businessLabel}
              </h2>
              <p className="text-sm text-white/40 leading-relaxed">
                {[profile?.industry, profile?.website]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <Link
                href="/dashboard/settings/brand-profile"
                className="inline-block text-xs text-orange-400/80 hover:text-orange-400 transition-colors pt-1"
              >
                Edit brand profile
              </Link>
            </div>
          </div>
        </DashboardPanel>
      )}

      <WelcomeCard />

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
