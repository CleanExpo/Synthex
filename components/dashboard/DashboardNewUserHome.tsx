'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/page-header';
import { GetStartedChecklist, WelcomeCard } from '@/components/dashboard';
import { DashboardAtmosphere, DashboardPanel } from './DashboardAtmosphere';
import { DashboardQuickRail } from './DashboardQuickRail';
import { useBrandProfile } from '@/hooks/use-brand-profile';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';

/** Full-bleed first-run home — fills the Mission Control canvas. */
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
    <DashboardAtmosphere className="w-full max-w-none space-y-8 pt-2">
      <PageHeader
        className="w-full"
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

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        {hasProfileDetails && (
          <DashboardPanel className="relative overflow-hidden xl:col-span-4 flex flex-col justify-between min-h-55">
            <div
              aria-hidden
              className="absolute inset-y-0 right-0 w-2/3 bg-linear-to-l from-orange-500/10 to-transparent pointer-events-none"
            />
            <div className="relative flex items-start gap-4">
              {profile?.logo ? (
                <img
                  src={profile.logo}
                  alt=""
                  className="h-14 w-14 rounded-sm object-cover border border-white/10 shrink-0"
                />
              ) : profile?.primaryColor ? (
                <span
                  className="h-14 w-14 rounded-sm shrink-0 border border-white/10"
                  style={{ backgroundColor: profile.primaryColor }}
                  aria-hidden
                />
              ) : (
                <span
                  className="h-14 w-14 rounded-sm shrink-0 border border-white/10 bg-orange-500/20"
                  aria-hidden
                />
              )}
              <div className="min-w-0 space-y-1.5">
                <p className="text-xs uppercase tracking-[0.22em] text-white/30">
                  From onboarding
                </p>
                <h2 className="text-xl font-light text-white tracking-tight">
                  {businessLabel}
                </h2>
                <p className="text-sm text-white/40 leading-relaxed break-all">
                  {[profile?.industry, profile?.website]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/settings/brand-profile"
              className="relative inline-flex w-fit text-xs text-orange-400/80 hover:text-orange-400 transition-colors mt-6"
            >
              Edit brand profile
            </Link>
          </DashboardPanel>
        )}

        <div
          className={
            hasProfileDetails
              ? 'xl:col-span-8 min-w-0'
              : 'xl:col-span-12 min-w-0'
          }
        >
          <WelcomeCard className="h-full" />
        </div>
      </div>

      <DashboardPanel className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 w-1/2 bg-linear-to-l from-orange-500/10 to-transparent pointer-events-none"
        />
        <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-white/30 mb-2">
              First win
            </p>
            <h2 className="text-2xl sm:text-3xl font-extralight text-white tracking-tight max-w-2xl leading-tight">
              One topic. Drafts for every connected platform.
            </h2>
            <p className="text-sm text-white/40 mt-3 max-w-xl leading-relaxed">
              After your first publish, this home becomes Mission Control — Goal
              → Linear → ship status.
            </p>
          </div>
          <Link
            href="/dashboard/content"
            className="inline-flex items-center justify-center bg-white/5 hover:bg-white/8 border-[0.5px] border-white/10 text-white text-sm font-medium py-2.5 px-5 rounded-sm transition-colors shrink-0"
          >
            Start drafting
          </Link>
        </div>
      </DashboardPanel>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-5 min-w-0">
          <GetStartedChecklist />
        </div>
        <div className="xl:col-span-7 min-w-0">
          <DashboardQuickRail />
        </div>
      </div>
    </DashboardAtmosphere>
  );
}
