'use client'

/**
 * InsightsWidget — Phase 66
 * Dashboard widget showing latest AI-surfaced content opportunities.
 */

import useSWR from 'swr'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Lightbulb, Loader2, ArrowRight, Clock } from '@/components/icons'

interface InsightsRun {
  id: string
  status: string
  outputData: {
    opportunities?: number
    drafts?: number
    queued?: number
    autoDrafted?: number
  } | null
  startedAt: string | null
  stepExecutions: Array<{
    id: string
    stepName: string
    outputData: {
      content?: string
      platform?: string
      opportunityTitle?: string
    } | null
    confidenceScore: number | null
  }>
}

interface InsightsResponse {
  insights: InsightsRun[]
  lastRun: string | null
}

async function fetcher(url: string): Promise<InsightsResponse> {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch insights')
  return res.json()
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function InsightsWidget({ className }: { className?: string }) {
  const { data, isLoading } = useSWR<InsightsResponse>('/api/insights', fetcher, {
    refreshInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  })

  const latestRun = data?.insights?.[0]
  const pendingReview = data?.insights?.flatMap((r) => r.stepExecutions).slice(0, 3) ?? []
  const lastRun = data?.lastRun ?? null

  return (
    <div className={cn('rounded-xl border border-white/10 bg-white/5 p-5 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-semibold text-white/90">AI Insights</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-white/40">
          <Clock className="h-3 w-3" />
          <span>Last: {isLoading ? '…' : formatTimeAgo(lastRun)}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 text-white/20 animate-spin" />
        </div>
      ) : latestRun && latestRun.outputData ? (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-center">
              <div className="text-base font-bold tabular-nums text-amber-400">
                {latestRun.outputData.opportunities ?? 0}
              </div>
              <div className="text-xs text-white/40">opportunities</div>
            </div>
            <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-center">
              <div className="text-base font-bold tabular-nums text-emerald-400">
                {latestRun.outputData.autoDrafted ?? latestRun.outputData.drafts ?? 0}
              </div>
              <div className="text-xs text-white/40">auto-drafted</div>
            </div>
            <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-center">
              <div className="text-base font-bold tabular-nums text-cyan-400">
                {latestRun.outputData.queued ?? 0}
              </div>
              <div className="text-xs text-white/40">for review</div>
            </div>
          </div>

          {/* Pending review items */}
          {pendingReview.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-white/40 uppercase tracking-wide">Pending Review</p>
              {pendingReview.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-white/80 truncate">
                      {item.outputData?.opportunityTitle ?? item.stepName}
                    </span>
                    {item.confidenceScore !== null && (
                      <span className="text-xs tabular-nums text-amber-400 shrink-0">
                        {Math.round(item.confidenceScore * 100)}%
                      </span>
                    )}
                  </div>
                  {item.outputData?.platform && (
                    <span className="text-xs text-white/40 capitalize">{item.outputData.platform}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-4 space-y-1">
          <p className="text-xs text-white/50">AI insights run every 4 hours</p>
          <p className="text-xs text-white/30">High-confidence opportunities are auto-drafted to your content queue.</p>
        </div>
      )}

      <Link
        href="/dashboard/insights"
        className="flex items-center gap-1.5 text-xs text-amber-400/80 hover:text-amber-400 transition-colours"
      >
        View all insights
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  )
}
