'use client'

/**
 * InsightsPageClient — Phase 66
 * Full insights history page with Run Now (dev only) functionality.
 */

import useSWR from 'swr'
import { useState } from 'react'
import { PageHeader } from '@/components/dashboard/page-header'
import { Lightbulb, Loader2, CheckCircle, Clock, AlertTriangle } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSubscription } from '@/hooks/useSubscription'
import { UpgradePrompt } from '@/components/billing/UpgradePrompt'

const ALLOWED_PLANS = ['professional', 'business', 'custom']

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
  completedAt: string | null
  createdAt: string
  stepExecutions: Array<{
    id: string
    stepName: string
    outputData: {
      content?: string
      platform?: string
      opportunityTitle?: string
    } | null
    confidenceScore: number | null
    createdAt: string
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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
        <CheckCircle className="h-3 w-3" />
        Complete
      </span>
    )
  }
  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
        <Loader2 className="h-3 w-3 animate-spin" />
        Running
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
        <AlertTriangle className="h-3 w-3" />
        Failed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-300 border border-slate-500/30">
      <Clock className="h-3 w-3" />
      {status}
    </span>
  )
}

export function InsightsPageClient() {
  const { subscription, isLoading: subscriptionLoading } = useSubscription()
  const hasAccess = subscription && ALLOWED_PLANS.includes(subscription.plan)

  const { data, isLoading, mutate } = useSWR<InsightsResponse>(
    hasAccess ? '/api/insights' : null,
    fetcher,
    { refreshInterval: 30000 }
  )
  const [runningNow, setRunningNow] = useState(false)

  const isDev = process.env.NODE_ENV !== 'production'

  async function handleRunNow() {
    setRunningNow(true)
    try {
      await fetch('/api/cron/insights', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      setTimeout(() => { mutate(); setRunningNow(false) }, 3000)
    } catch {
      setRunningNow(false)
    }
  }

  const insights = data?.insights ?? []

  // Gate: show upgrade prompt for free-plan users
  if (!subscriptionLoading && !hasAccess) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="AI Insights"
          description="Autonomous AI agent surfaces content opportunities every 4 hours."
        />
        <div className="container py-8">
          <UpgradePrompt feature="AI Insights Agent" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Insights"
        description="Autonomous AI agent surfaces content opportunities every 4 hours. High-confidence opportunities are auto-drafted to your content queue."
        actions={
          isDev ? (
            <Button
              size="sm"
              onClick={handleRunNow}
              disabled={runningNow}
              className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30"
            >
              {runningNow ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Lightbulb className="h-4 w-4 mr-1.5" />}
              {runningNow ? 'Running…' : 'Run Now (Dev)'}
            </Button>
          ) : null
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 text-white/20 animate-spin" />
        </div>
      ) : insights.length === 0 ? (
        <div className="flex flex-col items-center py-16 space-y-3">
          <div className="h-12 w-12 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Lightbulb className="h-6 w-6 text-amber-400" />
          </div>
          <p className="text-sm font-medium text-white/60">No insights yet</p>
          <p className="text-xs text-white/30">The agent runs every 4 hours. First run will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {insights.map((run) => (
            <div
              key={run.id}
              className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={run.status} />
                  </div>
                  <p className="text-xs text-white/40">{formatDate(run.startedAt)}</p>
                </div>

                {run.outputData && (
                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-center">
                      <div className="text-sm font-bold text-amber-400">{run.outputData.opportunities ?? 0}</div>
                      <div className="text-white/40">opps</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-bold text-emerald-400">{run.outputData.autoDrafted ?? run.outputData.drafts ?? 0}</div>
                      <div className="text-white/40">drafted</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-bold text-cyan-400">{run.outputData.queued ?? 0}</div>
                      <div className="text-white/40">queued</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Pending review items */}
              {run.stepExecutions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-white/40">Awaiting review:</p>
                  {run.stepExecutions.map((se) => (
                    <div
                      key={se.id}
                      className={cn(
                        'rounded-lg border p-3 space-y-2',
                        'border-amber-500/20 bg-amber-500/5'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-white/80">
                          {se.outputData?.opportunityTitle ?? se.stepName}
                        </span>
                        {se.confidenceScore !== null && (
                          <span className="text-xs text-amber-400 tabular-nums">
                            {Math.round(se.confidenceScore * 100)}% confidence
                          </span>
                        )}
                      </div>
                      {se.outputData?.content && (
                        <p className="text-xs text-white/50 line-clamp-2">{se.outputData.content}</p>
                      )}
                      {se.outputData?.platform && (
                        <span className="text-xs text-white/30 capitalize">{se.outputData.platform}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
