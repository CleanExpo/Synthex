'use client';

/**
 * GamificationWidget — Sprint 3
 * Displays user streak and recent achievements on the dashboard.
 * Renders nothing if streak is zero and no achievements are unlocked.
 */

import useSWR from 'swr';
import { Flame, Trophy, Loader2, AlertCircle } from '@/components/icons';

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalDays: number;
  level: number;
  points: number;
  lastActiveDate: string | null;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
  points: number;
  isUnlocked: boolean;
  unlockedAt: string | null;
}

interface StreakResponse {
  success: boolean;
  streak: StreakData;
}

interface AchievementsResponse {
  success: boolean;
  achievements: Achievement[];
  stats: {
    totalUnlocked: number;
    totalAvailable: number;
    totalPoints: number;
    completionPercent: number;
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

export function GamificationWidget({ className }: { className?: string }) {
  const {
    data: streakData,
    isLoading: streakLoading,
    error: streakError,
    mutate: mutateStreak,
  } = useSWR<StreakResponse>('/api/gamification/streak', fetchJson, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  const {
    data: achievementsData,
    isLoading: achievementsLoading,
    error: achievementsError,
    mutate: mutateAchievements,
  } = useSWR<AchievementsResponse>(
    '/api/gamification/achievements',
    fetchJson,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  );

  const isLoading = streakLoading || achievementsLoading;

  if (streakError || achievementsError) {
    return (
      <div className="rounded-xl border border-orange-500/20 bg-orange-500/[0.04] p-6 text-center">
        <AlertCircle className="h-5 w-5 text-orange-400 mx-auto mb-2" />
        <p className="text-white/50 text-sm">
          Couldn&apos;t load your progress
        </p>
        <button
          onClick={() => {
            mutateStreak();
            mutateAchievements();
          }}
          className="mt-3 text-xs text-orange-400 hover:text-orange-300 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  const streak = streakData?.streak;
  const recentAchievements =
    achievementsData?.achievements
      .filter(a => a.isUnlocked)
      .sort(
        (a, b) =>
          new Date(b.unlockedAt ?? 0).getTime() -
          new Date(a.unlockedAt ?? 0).getTime()
      )
      .slice(0, 3) ?? [];

  if (
    !isLoading &&
    (!streak || streak.currentStreak === 0) &&
    recentAchievements.length === 0
  ) {
    return (
      <div
        className={`border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-5 space-y-4 ${className ?? ''}`}
      >
        <div className="flex items-center gap-2">
          <Trophy className="h-3.5 w-3.5 text-orange-400" />
          <span className="text-[10px] uppercase tracking-[0.25em] text-white/40">
            Your Progress
          </span>
        </div>
        <div className="space-y-3">
          <div className="flex items-start gap-3 border-[0.5px] border-orange-500/20 bg-orange-500/[0.04] rounded-sm p-3">
            <Flame className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-xs text-white/70">Start your streak</div>
              <p className="text-[10px] text-white/50 mt-0.5 leading-relaxed">
                Create and publish your first post to start your streak and earn
                achievements.
              </p>
              <a
                href="/dashboard/content"
                className="inline-block mt-3 text-[10px] uppercase tracking-[0.15em] px-2.5 py-1 rounded-sm border-[0.5px] border-orange-500/30 bg-orange-500/[0.08] text-orange-400 hover:bg-orange-500/[0.12] transition-colors"
              >
                Create Post
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-5 space-y-4 ${className ?? ''}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Trophy className="h-3.5 w-3.5 text-orange-400" />
        <span className="text-[10px] uppercase tracking-[0.25em] text-white/40">
          Your Progress
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 text-white/50 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {/* Streak */}
          {streak && streak.currentStreak > 0 && (
            <div className="flex items-center gap-3 border-[0.5px] border-orange-500/20 bg-orange-500/[0.04] rounded-sm p-3">
              <Flame className="h-4 w-4 text-orange-400 shrink-0" />
              <div>
                <div className="font-mono text-base font-medium text-orange-400 tabular-nums">
                  {streak.currentStreak} day streak
                </div>
                <div className="text-[10px] text-white/50 mt-0.5">
                  {streak.points} pts · Level {streak.level}
                </div>
              </div>
            </div>
          )}

          {/* Recent achievements */}
          {recentAchievements.length > 0 && (
            <div className="space-y-2">
              <p className="text-[9px] uppercase tracking-[0.25em] text-white/50">
                Recent Achievements
              </p>
              {recentAchievements.map(achievement => (
                <div
                  key={achievement.id}
                  className="flex items-center gap-3 border-[0.5px] border-orange-500/20 bg-orange-500/[0.03] rounded-sm p-2"
                >
                  <span className="text-base leading-none shrink-0">
                    {achievement.icon}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs text-white/70 truncate">
                      {achievement.name}
                    </div>
                    <div className="text-[10px] text-white/50">
                      {achievement.points} pts
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
