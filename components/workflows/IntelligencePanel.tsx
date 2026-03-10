'use client'

/**
 * IntelligencePanel — Phase 65
 * Shows performance analysis for a selected workflow template.
 * Step-by-step confidence scores, low-confidence flags, and improvement suggestions.
 */

import { useState } from 'react'
import useSWR from 'swr'
import { cn } from '@/lib/utils'
import { Brain, TrendingUp, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Loader2 } from '@/components/icons'
import { Button } from '@/components/ui/button'
import type { PatternAnalysis, PromptPattern } from '@/lib/workflow/intelligence'

interface IntelligencePanelProps {
  templateId: string
  className?: string
}

interface IntelligenceResponse {
  analysis: PatternAnalysis
}

async function fetcher(url: string): Promise<IntelligenceResponse> {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error(`Intelligence API error (${res.status})`)
  return res.json()
}

function ConfidenceBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(value * 100)
  const colour =
    pct >= 85 ? 'bg-emerald-500'
    : pct >= 75 ? 'bg-amber-500'
    : 'bg-rose-500'

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-white/60 truncate max-w-[160px]">{label}</span>
        <span className={cn('tabular-nums font-medium', pct >= 85 ? 'text-emerald-400' : pct >= 75 ? 'text-amber-400' : 'text-rose-400')}>
          {pct}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', colour)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function StepPatternCard({ pattern, onApply }: { pattern: PromptPattern; onApply: (stepIndex: number, prompt: string) => Promise<void> }) {
  const [expanded, setExpanded] = useState(false)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)

  async function handleApply() {
    if (!pattern.improvementSuggestion) return
    setApplying(true)
    try {
      await onApply(pattern.stepIndex, pattern.improvementSuggestion)
      setApplied(true)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className={cn(
      'rounded-lg border p-3 space-y-2',
      pattern.isLowPerforming
        ? 'border-amber-500/20 bg-amber-500/5'
        : 'border-white/10 bg-white/5'
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {pattern.isLowPerforming ? (
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          ) : (
            <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          )}
          <span className="text-sm font-medium text-white/80 truncate">
            Step {pattern.stepIndex + 1}: {pattern.stepName}
          </span>
          <span className="text-xs text-white/30 shrink-0">({pattern.stepType})</span>
        </div>
        <span className="text-xs text-white/40 shrink-0 ml-2">{pattern.sampleCount} samples</span>
      </div>

      <ConfidenceBar value={pattern.avgConfidenceScore} label={`Avg: ${Math.round(pattern.avgConfidenceScore * 100)}% (min: ${Math.round(pattern.minConfidenceScore * 100)}%, max: ${Math.round(pattern.maxConfidenceScore * 100)}%)`} />

      {pattern.isLowPerforming && pattern.improvementSuggestion && (
        <div className="space-y-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colours"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            View suggested improvement
          </button>

          {expanded && (
            <div className="space-y-2">
              <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                <p className="text-xs text-white/60 font-mono whitespace-pre-wrap">{pattern.improvementSuggestion}</p>
              </div>
              {applied ? (
                <div className="flex items-center gap-1 text-xs text-emerald-400">
                  <CheckCircle className="h-3 w-3" />
                  Prompt updated
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={handleApply}
                  disabled={applying}
                  className="text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30"
                >
                  {applying ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                  Apply Improvement
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function IntelligencePanel({ templateId, className }: IntelligencePanelProps) {
  const { data, isLoading, error } = useSWR<IntelligenceResponse>(
    `/api/workflows/intelligence?templateId=${templateId}`,
    fetcher
  )

  async function handleApply(stepIndex: number, newPrompt: string) {
    await fetch('/api/workflows/intelligence', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId, stepIndex, newPrompt }),
    })
  }

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <Loader2 className="h-5 w-5 text-white/30 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn('text-sm text-rose-400/60 py-4', className)}>
        Failed to load performance data
      </div>
    )
  }

  const analysis = data?.analysis

  if (!analysis || analysis.totalExecutions === 0) {
    return (
      <div className={cn('flex flex-col items-center py-12 space-y-3', className)}>
        <Brain className="h-8 w-8 text-white/20" />
        <p className="text-sm text-white/50">No execution data yet</p>
        <p className="text-xs text-white/30">Run this template a few times to see performance analysis.</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-5', className)}>
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
          <div className="text-xl font-bold tabular-nums text-white/90">{analysis.totalExecutions}</div>
          <div className="text-xs text-white/40">executions</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
          <div className={cn('text-xl font-bold tabular-nums', analysis.overallAvgConfidence >= 0.85 ? 'text-emerald-400' : analysis.overallAvgConfidence >= 0.7 ? 'text-amber-400' : 'text-rose-400')}>
            {Math.round(analysis.overallAvgConfidence * 100)}%
          </div>
          <div className="text-xs text-white/40">avg confidence</div>
        </div>
        <div className={cn('rounded-lg border p-3 text-center', analysis.lowPerformingCount > 0 ? 'border-amber-500/20 bg-amber-500/5' : 'border-white/10 bg-white/5')}>
          <div className={cn('text-xl font-bold tabular-nums', analysis.lowPerformingCount > 0 ? 'text-amber-400' : 'text-emerald-400')}>
            {analysis.lowPerformingCount}
          </div>
          <div className="text-xs text-white/40">low-performing steps</div>
        </div>
      </div>

      {/* Step breakdown */}
      {analysis.patterns.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-medium text-white/80">Step Performance</h3>
          </div>
          {analysis.patterns.map((pattern) => (
            <StepPatternCard
              key={pattern.stepIndex}
              pattern={pattern}
              onApply={handleApply}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-white/30">
        Analysed at {new Date(analysis.analysedAt).toLocaleString('en-AU')}
      </p>
    </div>
  )
}
