'use client'

/**
 * Autonomous Page — Natural language → Workflow execution
 *
 * Three states:
 * 1. Input — textarea + example chips + "Parse" button
 * 2. Preview — summary, step timeline, confidence, warnings, "Execute" button
 * 3. Executing — status + link to /dashboard/workflows
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ConfidenceBadge } from '@/components/workflows/ConfidenceBadge'
import {
  Sparkles,
  Brain,
  User,
  Zap,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Loader2,
} from '@/components/icons'
import type { ParsedInstruction } from '@/lib/autonomous/types'
import type { WorkflowStepDefinition } from '@/lib/workflow/types'

// ---------------------------------------------------------------------------
// Example instruction chips
// ---------------------------------------------------------------------------

const EXAMPLES = [
  'Create a LinkedIn campaign about AI in restoration, 5 posts, schedule next week',
  'Analyse our top 10 posts and create a performance report',
  'Draft 3 Instagram reels scripts about our latest product launch',
  'Research competitor content strategies and create a summary',
  'Optimise our existing blog posts for SEO and suggest improvements',
]

// ---------------------------------------------------------------------------
// Step type icon (preview version — steps don't have execution status yet)
// ---------------------------------------------------------------------------

function StepIcon({ stepType }: { stepType: string }) {
  switch (stepType) {
    case 'ai':
      return <Brain className="h-4 w-4" />
    case 'approval':
      return <User className="h-4 w-4" />
    case 'action':
      return <Zap className="h-4 w-4" />
    case 'validation':
      return <CheckCircle className="h-4 w-4" />
    default:
      return <Zap className="h-4 w-4" />
  }
}

function stepTypeColour(type: string): string {
  switch (type) {
    case 'ai':
      return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
    case 'approval':
      return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    case 'action':
      return 'text-green-400 bg-green-500/10 border-green-500/20'
    case 'validation':
      return 'text-purple-400 bg-purple-500/10 border-purple-500/20'
    default:
      return 'text-gray-400 bg-gray-500/10 border-gray-500/20'
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function AutonomousPageClient() {
  const router = useRouter()
  const [instruction, setInstruction] = useState('')
  const [parsed, setParsed] = useState<ParsedInstruction | null>(null)
  const [executionId, setExecutionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ---- State: input | preview | executing ----
  const state = executionId ? 'executing' : parsed ? 'preview' : 'input'

  // ---- Parse instruction ----
  async function handleParse() {
    if (instruction.trim().length < 10) {
      setError('Instruction must be at least 10 characters')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/autonomous/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ instruction: instruction.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to parse instruction')
        return
      }
      setParsed(data.parsed)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  // ---- Execute workflow ----
  async function handleExecute() {
    if (!parsed) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/autonomous/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: parsed.title,
          steps: parsed.steps,
          inputData: {
            sourceInstruction: parsed.originalInstruction,
            sourceType: 'autonomous',
            parserConfidence: parsed.confidence,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to execute workflow')
        return
      }
      setExecutionId(data.execution.id)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  // ---- Reset to input ----
  function handleReset() {
    setParsed(null)
    setExecutionId(null)
    setError(null)
    setInstruction('')
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-cyan-500" />
          Autonomous
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Describe what you want done in plain English. Synthex will build and execute a workflow for you.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* ================================================================= */}
      {/* STATE: INPUT                                                       */}
      {/* ================================================================= */}
      {state === 'input' && (
        <div className="space-y-4">
          {/* Textarea */}
          <div className="relative">
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g., Create a LinkedIn campaign about AI in restoration, 5 posts, schedule next week"
              rows={4}
              maxLength={2000}
              className="w-full rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-gray-500 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 resize-none"
            />
            <span className="absolute bottom-2 right-3 text-[11px] text-gray-600 tabular-nums">
              {instruction.length}/2000
            </span>
          </div>

          {/* Example chips */}
          <div className="space-y-2">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Examples</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setInstruction(ex)}
                  className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-colors"
                >
                  {ex.length > 60 ? ex.slice(0, 57) + '...' : ex}
                </button>
              ))}
            </div>
          </div>

          {/* Parse button */}
          <Button
            onClick={handleParse}
            disabled={loading || instruction.trim().length < 10}
            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Parsing instruction...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                Parse Instruction
              </>
            )}
          </Button>
        </div>
      )}

      {/* ================================================================= */}
      {/* STATE: PREVIEW                                                     */}
      {/* ================================================================= */}
      {state === 'preview' && parsed && (
        <div className="space-y-5">
          {/* Summary card */}
          <div className="rounded-lg bg-white/[0.03] border border-white/10 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">{parsed.title}</h2>
                <p className="text-sm text-gray-400 mt-1">{parsed.summary}</p>
              </div>
              <ConfidenceBadge score={parsed.confidence} />
            </div>

            {/* Intents */}
            <div className="flex flex-wrap gap-1.5">
              {parsed.intents.map((intent) => (
                <span
                  key={intent}
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 capitalize"
                >
                  {intent}
                </span>
              ))}
            </div>
          </div>

          {/* Warnings */}
          {parsed.warnings.length > 0 && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 space-y-1">
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Warnings
              </p>
              <ul className="space-y-0.5">
                {parsed.warnings.map((w, i) => (
                  <li key={i} className="text-sm text-amber-300/80">• {w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Step timeline (preview version) */}
          <div className="rounded-lg bg-white/[0.03] border border-white/10 p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">
              Workflow Steps ({parsed.steps.length})
            </h3>
            <ol className="relative">
              {parsed.steps.map((step: WorkflowStepDefinition, idx: number) => {
                const isLast = idx === parsed.steps.length - 1
                return (
                  <li key={idx} className="relative pl-8 pb-5">
                    {!isLast && (
                      <span
                        className="absolute left-[11px] top-5 h-full w-px bg-white/10"
                        aria-hidden="true"
                      />
                    )}
                    <span className="absolute left-0 top-1 h-6 w-6 rounded-full border border-white/10 bg-white/5 flex items-center justify-center">
                      <span className="text-gray-400">
                        <StepIcon stepType={step.type} />
                      </span>
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-white">{step.name}</span>
                        <span
                          className={cn(
                            'text-[10px] font-semibold px-1.5 py-0.5 rounded-full border capitalize',
                            stepTypeColour(step.type)
                          )}
                        >
                          {step.type}
                        </span>
                        {step.actionType && (
                          <span className="text-[10px] text-gray-500">→ {step.actionType}</span>
                        )}
                      </div>
                      {step.promptTemplate && (
                        <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">
                          {step.promptTemplate}
                        </p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleReset}
              className="border-white/10 text-gray-400 hover:text-white"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Start Over
            </Button>
            <Button
              onClick={handleExecute}
              disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating workflow...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Execute Workflow
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* STATE: EXECUTING                                                   */}
      {/* ================================================================= */}
      {state === 'executing' && (
        <div className="space-y-5">
          <div className="rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-6 text-center space-y-3">
            <CheckCircle className="h-10 w-10 text-green-400 mx-auto" />
            <h2 className="text-lg font-semibold text-white">Workflow Created</h2>
            <p className="text-sm text-gray-400">
              Your workflow is now queued and will execute automatically.
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleReset}
              className="border-white/10 text-gray-400 hover:text-white"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              New Instruction
            </Button>
            <Button
              onClick={() => router.push('/dashboard/workflows')}
              className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              View Workflows
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Original instruction reference (visible in preview/executing states) */}
      {(state === 'preview' || state === 'executing') && parsed && (
        <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] px-4 py-3">
          <p className="text-[11px] text-gray-600 font-medium uppercase tracking-wider mb-1">Original Instruction</p>
          <p className="text-xs text-gray-400 italic">&ldquo;{parsed.originalInstruction}&rdquo;</p>
        </div>
      )}
    </div>
  )
}
