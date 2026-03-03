'use client'

/**
 * BrandVoicePageClient — Phase 64
 * Client component for /dashboard/brand-voice
 */

import { PageHeader } from '@/components/dashboard/page-header'
import { ReviewQueuePanel } from './ReviewQueuePanel'
import { Shield } from '@/components/icons'

export function BrandVoicePageClient() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Brand Voice"
        description="AI content quality review queue. High-confidence content is auto-approved; low-confidence items appear here for human review."
        actions={
          <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5">
            <Shield className="h-3.5 w-3.5" />
            Auto-approve threshold: 85%
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Review queue */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wide">Pending Review</h2>
          <ReviewQueuePanel />
        </div>

        {/* Info panel */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wide">How It Works</h2>
          <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
            <div className="space-y-3 text-sm text-white/60">
              <div className="flex gap-3">
                <div className="h-6 w-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-emerald-400">1</span>
                </div>
                <div>
                  <p className="font-medium text-white/80">AI generates content</p>
                  <p className="text-xs mt-0.5">Workflow AI steps produce drafts using your configured templates.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="h-6 w-6 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-cyan-400">2</span>
                </div>
                <div>
                  <p className="font-medium text-white/80">Quality scoring</p>
                  <p className="text-xs mt-0.5">Each draft is scored across 4 dimensions: brand alignment, clarity, engagement, and appropriateness.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="h-6 w-6 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-amber-400">3</span>
                </div>
                <div>
                  <p className="font-medium text-white/80">Confidence gate</p>
                  <p className="text-xs mt-0.5">Scores ≥ 85% are auto-approved. Lower scores are routed here for your review.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="h-6 w-6 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-purple-400">4</span>
                </div>
                <div>
                  <p className="font-medium text-white/80">Human decision</p>
                  <p className="text-xs mt-0.5">Approve to continue the workflow. Reject with a reason to stop and surface for revision.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
