'use client';

/**
 * LoyaltyTierCard — Phase 5C (SYN-431)
 *
 * Displays the authenticated user's loyalty tier, points, progress to the
 * next tier, and a badge grid of completed achievements.
 *
 * Data source: GET /api/user/loyalty
 * Pattern:     SWR with credentials: 'include' (per project data-fetching rules)
 */

import useSWR from 'swr';
import { Trophy, Lock } from '@/components/icons';

// ── Types ────────────────────────────────────────────────────────────────────

type Tier = 'bronze' | 'silver' | 'gold' | 'platinum';

interface LoyaltyData {
  points: number;
  tier: Tier;
  nextTierPoints: number | null;
  tierProgress: number;
  level: number;
  currentStreak: number;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  rarity: string;
  points: number;
  progress: number;
  isUnlocked: boolean;
  unlockedAt: string | null;
}

interface LoyaltyResponse {
  success: boolean;
  loyalty: LoyaltyData;
  achievements: Achievement[];
  stats: {
    totalUnlocked: number;
    totalAvailable: number;
    totalPointsEarned: number;
  };
}

// ── Constants ────────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<
  Tier,
  {
    label: string;
    colour: string;
    bgColour: string;
    borderColour: string;
    badgeColour: string;
  }
> = {
  bronze: {
    label: 'Bronze',
    colour: 'text-orange-600',
    bgColour: 'bg-orange-600/10',
    borderColour: 'border-orange-600/30',
    badgeColour: '#CD7F32',
  },
  silver: {
    label: 'Silver',
    colour: 'text-slate-300',
    bgColour: 'bg-slate-400/10',
    borderColour: 'border-slate-400/30',
    badgeColour: '#C0C0C0',
  },
  gold: {
    label: 'Gold',
    colour: 'text-yellow-400',
    bgColour: 'bg-yellow-400/10',
    borderColour: 'border-yellow-400/30',
    badgeColour: '#FFD700',
  },
  platinum: {
    label: 'Platinum',
    colour: 'text-slate-300',
    bgColour: 'bg-slate-300/10',
    borderColour: 'border-slate-300/30',
    badgeColour: '#E5E4E2',
  },
};

const RARITY_ORDER: Record<string, number> = {
  legendary: 0,
  epic: 1,
  rare: 2,
  uncommon: 3,
  common: 4,
};

const MAX_VISIBLE_BADGES = 6;

// ── Fetcher (project convention) ─────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch loyalty data');
  return res.json();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: Tier }) {
  const config = TIER_CONFIG[tier];
  return (
    <div
      className={`
        inline-flex items-center justify-center
        w-14 h-14 rounded-sm shrink-0
        border-[0.5px] ${config.borderColour} ${config.bgColour}
      `}
    >
      <Trophy className="h-7 w-7" style={{ color: config.badgeColour }} />
    </div>
  );
}

function ProgressBar({ progress, tier }: { progress: number; tier: Tier }) {
  const config = TIER_CONFIG[tier];
  return (
    <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{ backgroundColor: config.badgeColour, width: `${progress}%` }}
      />
    </div>
  );
}

function AchievementBadge({
  achievement,
  index,
}: {
  achievement: Achievement;
  index: number;
}) {
  return (
    <div
      title={`${achievement.name} — ${achievement.description}`}
      className="
        flex items-center justify-center
        w-9 h-9 rounded-sm
        border-[0.5px] border-orange-500/20 bg-orange-500/[0.05]
        cursor-default select-none
        hover:border-orange-500/40 hover:bg-orange-500/[0.08] transition-colors
      "
    >
      <span className="text-base leading-none">{achievement.icon}</span>
    </div>
  );
}

function LockedBadge({ index }: { index: number }) {
  return (
    <div
      className="
        flex items-center justify-center
        w-9 h-9 rounded-sm
        border-[0.5px] border-white/[0.06] bg-white/[0.02]
      "
    >
      <Lock className="h-3.5 w-3.5 text-white/50" />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-5 space-y-4 animate-pulse">
      <div className="flex items-center gap-2 mb-1">
        <div className="h-3 w-3 bg-white/[0.06] rounded-sm" />
        <div className="h-2.5 w-28 bg-white/[0.04] rounded-sm" />
      </div>
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-white/[0.04] rounded-sm shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-20 bg-white/[0.06] rounded-sm" />
          <div className="h-3 w-24 bg-white/[0.04] rounded-sm" />
          <div className="h-1.5 w-full bg-white/[0.04] rounded-full" />
          <div className="h-2.5 w-32 bg-white/[0.03] rounded-sm" />
        </div>
      </div>
      <div className="pt-1 space-y-2">
        <div className="h-2.5 w-24 bg-white/[0.03] rounded-sm" />
        <div className="flex gap-1.5 flex-wrap">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="w-9 h-9 bg-white/[0.04] rounded-sm" />
          ))}
        </div>
      </div>
    </div>
  );
}

function ErrorCard() {
  return (
    <div className="border-[0.5px] border-red-500/20 bg-red-500/[0.03] rounded-sm p-5">
      <div className="flex items-center gap-2 mb-1">
        <Trophy className="h-3.5 w-3.5 text-orange-400" />
        <span className="text-[10px] uppercase tracking-[0.25em] text-white/40">
          Your Loyalty Tier
        </span>
      </div>
      <p className="text-sm text-white/40 mt-3">
        Unable to load loyalty data. Please refresh the page.
      </p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function LoyaltyTierCard({ className }: { className?: string }) {
  const { data, error, isLoading } = useSWR<LoyaltyResponse>(
    '/api/user/loyalty',
    fetchJson,
    { revalidateOnFocus: false, dedupingInterval: 120_000 }
  );

  if (isLoading) return <SkeletonCard />;
  if (error || !data?.success || !data.loyalty) return <ErrorCard />;

  const { loyalty, achievements, stats } = data;
  const { tier, points, nextTierPoints, tierProgress } = loyalty;
  const config = TIER_CONFIG[tier] ?? TIER_CONFIG.bronze;

  // Sort unlocked achievements by rarity (rarest first), then by unlockedAt
  const unlocked = achievements
    .filter(a => a.isUnlocked)
    .sort((a, b) => {
      const rarityDiff =
        (RARITY_ORDER[a.rarity] ?? 99) - (RARITY_ORDER[b.rarity] ?? 99);
      if (rarityDiff !== 0) return rarityDiff;
      return (
        new Date(b.unlockedAt ?? 0).getTime() -
        new Date(a.unlockedAt ?? 0).getTime()
      );
    });

  const visibleBadges = unlocked.slice(0, MAX_VISIBLE_BADGES);
  const remainingCount = unlocked.length - visibleBadges.length;

  // How many locked placeholder badges to show (fill grid up to 6 total, or show 2 locked minimum)
  const lockedCount = Math.max(
    0,
    Math.min(MAX_VISIBLE_BADGES - visibleBadges.length, 2)
  );

  const isPlatinum = tier === 'platinum';

  return (
    <div
      className={`
        border-[0.5px] ${config.borderColour} bg-white/[0.01] rounded-sm p-5 space-y-4
        ${className ?? ''}
      `}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Trophy className={`h-3.5 w-3.5 ${config.colour}`} />
        <span className="text-[10px] uppercase tracking-[0.25em] text-white/40">
          Your Loyalty Tier
        </span>
      </div>

      {/* Tier badge + points + progress */}
      <div className="flex items-start gap-4">
        <TierBadge tier={tier} />

        <div className="flex-1 min-w-0">
          {/* Tier name + points */}
          <div className="flex items-baseline gap-2 mb-1">
            <span className={`text-base font-medium ${config.colour}`}>
              {config.label}
            </span>
            <span className="text-[10px] text-white/50 font-mono tabular-nums">
              {points.toLocaleString()} pts
            </span>
          </div>

          {/* Progress bar */}
          <ProgressBar progress={tierProgress} tier={tier} />

          {/* Progress label */}
          <p className="mt-1.5 text-[10px] text-white/50">
            {isPlatinum ? (
              "Maximum tier — you've reached Platinum"
            ) : (
              <>
                {points.toLocaleString()} / {nextTierPoints?.toLocaleString()}{' '}
                pts to {computeNextTierLabel(tier)}
              </>
            )}
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-white/[0.04]" />

      {/* Achievements */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-[9px] uppercase tracking-[0.25em] text-white/50">
            Achievements
          </p>
          <span className="text-[9px] text-white/50 font-mono tabular-nums">
            {stats.totalUnlocked}/{stats.totalAvailable}
          </span>
        </div>

        {unlocked.length === 0 ? (
          <p className="text-[10px] text-white/50 leading-relaxed py-1">
            Complete actions to earn achievements and unlock rewards.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {visibleBadges.map((achievement, i) => (
              <AchievementBadge
                key={achievement.id}
                achievement={achievement}
                index={i}
              />
            ))}

            {/* Locked placeholders */}
            {lockedCount > 0 &&
              [...Array(lockedCount)].map((_, i) => (
                <LockedBadge key={`locked-${i}`} index={i} />
              ))}

            {/* Overflow count */}
            {remainingCount > 0 && (
              <div
                className="
                  flex items-center justify-center
                  w-9 h-9 rounded-sm
                  border-[0.5px] border-white/[0.08] bg-white/[0.02]
                  text-[9px] text-white/50 font-mono
                "
              >
                +{remainingCount}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeNextTierLabel(tier: Tier): string {
  switch (tier) {
    case 'bronze':
      return 'Silver';
    case 'silver':
      return 'Gold';
    case 'gold':
      return 'Platinum';
    default:
      return '';
  }
}
