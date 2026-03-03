'use client'

/**
 * ReviewQueuePanel — Phase 64
 * Lists AI-generated content items waiting for human review.
 * Provides inline approve/reject actions.
 */

import { useState } from 'react'
import useSWR from 'swr'
import { cn } from '@/lib/utils'
import { CheckCircle, XCircle, Loader2, Shield } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { QualityScoreCard } from './QualityScoreCard'
import type { QualityScore } from '@/lib/brand-voice/quality-scorer'

interface ReviewItem {
  id: string
  stepName: string
  stepType: string
  outputData: {
    contentPreview?: string
    qualityScore?: QualityScore
    waitingFor?: string
  } | null
  confidenceScore: number | null
  createdAt: string
  workflowExecution: {
    id: string
    title: string
  }
}

interface ReviewQueueResponse {
  items: ReviewItem[]
  total: number
}

async function fetcher(url: string): Promise<ReviewQueueResponse> {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error(`Failed to fetch review queue (${res.status})`)
  return res.json()
}

export function ReviewQueuePanel({ className }: { className?: string }) {
  const { data, isLoading, mutate } = useSWR<ReviewQueueResponse>(
    '/api/brand-voice/review-queue',
    fetcher,
    { refreshInterval: 15000 }
  )
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  async function handleApprove(stepId: string) {
    setProcessingId(stepId)
    try {
      const res = await fetch(`/api/brand-voice/review-queue/${stepId}/approve`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error('Approval failed')
      await mutate()
    } catch (err) {
      console.error('Approve failed:', err)
    } finally {
      setProcessingId(null)
    }
  }

  async function handleReject(stepId: string) {
    if (!rejectReason.trim()) return
    setProcessingId(stepId)
    try {
      const res = await fetch(`/api/brand-voice/review-queue/${stepId}/reject`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      })
      if (!res.ok) throw new Error('Rejection failed')
      setRejectingId(null)
      setRejectReason('')
      await mutate()
    } catch (err) {
      console.error('Reject failed:', err)
    } finally {
      setProcessingId(null)
    }
  }

  const items = data?.items ?? []

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <Loader2 className="h-6 w-6 text-white/30 animate-spin" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-16 space-y-3', className)}>
        <div className="h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <Shield className="h-6 w-6 text-emerald-400" />
        </div>
        <p className="text-sm font-medium text-white/70">No items pending review</p>
        <p className="text-xs text-white/40">High-confidence content is auto-approved. Low-confidence items appear here.</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/90">Review Queue</h3>
        <span className="text-xs text-white/40">{items.length} pending</span>
      </div>

      {items.map((item) => {
        const qualityScore = item.outputData?.qualityScore
        const preview = item.outputData?.contentPreview
        const isProcessing = processingId === item.id
        const isRejectOpen = rejectingId === item.id

        return (
          <div
            key={item.id}
            className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4"
          >
            {/* Step info */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white/90 truncate">{item.stepName}</p>
                <p className="text-xs text-white/40">{item.workflowExecution.title}</p>
              </div>
              {qualityScore && (
                <QualityScoreCard score={qualityScore} compact />
              )}
            </div>

            {/* Content preview */}
            {preview && (
              <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                <p className="text-xs text-white/60 line-clamp-4">{preview}</p>
              </div>
            )}

            {/* Quality score card (full) */}
            {qualityScore && !isRejectOpen && (
              <QualityScoreCard score={qualityScore} compact={false} />
            )}

            {/* Reject reason input */}
            {isRejectOpen && (
              <div className="space-y-2">
                <label className="text-xs text-white/60">Rejection reason</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Describe why this content is being rejected…"
                  className="w-full rounded-lg bg-white/5 border border-white/10 text-xs text-white/80 p-2 resize-none h-20 focus:outline-none focus:border-white/30"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleApprove(item.id)}
                disabled={isProcessing}
                className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30"
              >
                {isProcessing && !isRejectOpen ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                )}
                Approve
              </Button>

              {isRejectOpen ? (
                <>
                  <Button
                    size="sm"
                    onClick={() => handleReject(item.id)}
                    disabled={isProcessing || !rejectReason.trim()}
                    className="flex-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30"
                  >
                    {isProcessing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <XCircle className="h-3.5 w-3.5 mr-1" />}
                    Confirm Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setRejectingId(null); setRejectReason('') }}
                    className="text-white/40 hover:text-white/60"
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setRejectingId(item.id)}
                  disabled={isProcessing}
                  className="flex-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30"
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Reject
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
