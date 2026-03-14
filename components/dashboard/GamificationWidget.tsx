'use client'

/**
 * GamificationWidget — Sprint 3
 * Displays user streak and recent achievements on the dashboard.
 * Renders nothing if streak is zero and no achievements are unlocked.
 */

import useSWR from 'swr'
import { Flame, Trophy, Loader2 } from '@/components/icons'

interface StreakData {
  currentStreak: number
  longestStreak: number
  totalDays: number
  level: number
  points: number
  lastActiveDate: string | null
}

interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  rarity: string
  points: number
  isUnlocked: boolean
  unlockedAt: string | null
}

interface StreakResponse {
  success: boolean
  streak: StreakData
}

interface AchievementsResponse {
  success: boolean
  achievements: Achievement[]
  stats: {
    totalUnlocked: number
    totalAvailable: number
    totalPoints: number
    completionPercent: number
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

export function GamificationWidget({ className }: { className?: string }) {
  const { data: streakData, isLoading: streakLoading } = useSWR<StreakResponse>(
    '/api/gamification/streak',
    fetchJson,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )

  const { data: achievementsData, isLoading: achievementsLoading } = useSWR<AchievementsResponse>(
    '/api/gamification/achievements',
    fetchJson,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )

  const isLoading = streakLoading || achievementsLoading
  const streak = streakData?.streak
  const recentAchievements = achievementsData?.achievements
    .filter((a) => a.isUnlocked)
    .sort((a, b) => new Date(b.unlockedAt ?? 0).getTime() - new Date(a.unlockedAt ?? 0).getTime())
    .slice(0, 3) ?? []

  // Render nothing if there's no data worth showing
  if (!isLoading && (!streak || streak.currentStreak === 0) && recentAchievements.length === 0) {
    return null
  }

  return (
    <div className={`rounded-xl border border-white/10 bg-white/5 p-5 space-y-4 ${className ?? ''}`}>
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-amber-400" />
        <span className="text-sm font-semibold text-white/90">Your Progress</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 text-white/20 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {/* Streak */}
          {streak && streak.currentStreak > 0 && (
            <div className="flex items-center gap-3 rounded-lg bg-white/5 border border-white/10 p-3">
              <Flame className="h-5 w-5 text-orange-400 shrink-0" />
              <div>
                <div className="text-sm font-bold text-orange-400 tabular-nums">
                  {streak.currentStreak} day streak
                </div>
                <div className="text-xs text-white/40">
                  {streak.points} pts · Level {streak.level}
                </div>
              </div>
            </div>
          )}

          {/* Recent achievements */}
          {recentAchievements.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-white/40 uppercase tracking-wide">Recent Achievements</p>
              {recentAchievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2"
                >
                  <span className="text-lg leading-none">{achievement.icon}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-white/80 truncate">{achievement.name}</div>
                    <div className="text-xs text-white/40">{achievement.points} pts</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
