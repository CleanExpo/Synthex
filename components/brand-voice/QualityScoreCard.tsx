'use client'

/**
 * QualityScoreCard — Phase 64
 * Displays a quality score with gauge, dimension breakdown, and flags.
 */

import { cn } from '@/lib/utils'
import { CheckCircle, AlertTriangle, XCircle } from '@/components/icons'
import type { QualityScore } from '@/lib/brand-voice/quality-scorer'

interface QualityScoreCardProps {
  score: QualityScore
  className?: string
  compact?: boolean
}

function ScoreGauge({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const colour =
    pct >= 85 ? 'text-emerald-400'
    : pct >= 70 ? 'text-amber-400'
    : 'text-rose-400'

  const bgColour =
    pct >= 85 ? 'bg-emerald-500'
    : pct >= 70 ? 'bg-amber-500'
    : 'bg-rose-500'

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn('text-3xl font-bold tabular-nums', colour)}>{pct}</div>
      <div className="text-xs text-white/40">/ 100</div>
      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', bgColour)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function DimensionBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100)
  const colour =
    pct >= 85 ? 'bg-emerald-500'
    : pct >= 70 ? 'bg-amber-500'
    : 'bg-rose-500'

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-white/60">{label}</span>
        <span className="text-white/80 tabular-nums font-medium">{pct}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', colour)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function QualityScoreCard({ score, className, compact = false }: QualityScoreCardProps) {
  const pct = Math.round(score.overall * 100)

  const StatusBadge = () => {
    if (score.autoApprove) {
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          <CheckCircle className="h-3 w-3" />
          Auto-Approved
        </span>
      )
    }
    if (pct >= 70) {
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
          <AlertTriangle className="h-3 w-3" />
          Needs Review
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
        <XCircle className="h-3 w-3" />
        Needs Revision
      </span>
    )
  }

  if (compact) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div className={cn('text-lg font-bold tabular-nums', pct >= 85 ? 'text-emerald-400' : pct >= 70 ? 'text-amber-400' : 'text-rose-400')}>
          {pct}
        </div>
        <StatusBadge />
        {score.flags.length > 0 && (
          <span className="text-xs text-white/40">{score.flags.length} flag{score.flags.length !== 1 ? 's' : ''}</span>
        )}
      </div>
    )
  }

  return (
    <div className={cn('rounded-xl border border-white/10 bg-white/5 p-5 space-y-5', className)}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white/90">Quality Score</h3>
          <p className="text-xs text-white/40 mt-0.5">Brand voice alignment analysis</p>
        </div>
        <StatusBadge />
      </div>

      {/* Overall gauge */}
      <ScoreGauge value={score.overall} />

      {/* Dimension breakdown */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-white/50 uppercase tracking-wide">Dimensions</h4>
        <DimensionBar label="Brand Alignment" value={score.dimensions.brandAlignment} />
        <DimensionBar label="Clarity" value={score.dimensions.clarity} />
        <DimensionBar label="Engagement" value={score.dimensions.engagement} />
        <DimensionBar label="Appropriateness" value={score.dimensions.appropriateness} />
      </div>

      {/* Reasoning */}
      {score.reasoning && (
        <p className="text-xs text-white/50 italic">{score.reasoning}</p>
      )}

      {/* Flags */}
      {score.flags.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-white/50 uppercase tracking-wide">Issues</h4>
          <ul className="space-y-1">
            {score.flags.map((flag, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-amber-300/80">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                {flag}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
