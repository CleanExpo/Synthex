'use client';


/**
 * BrandVoicePageClient — Phase 64
 * Client component for /dashboard/brand-voice
 */


import { PageHeader } from '@/components/dashboard/page-header';
import { ReviewQueuePanel } from './ReviewQueuePanel';
import { Shield } from '@/components/icons';
import { HelpVideo } from '@/components/ui/HelpVideo';


export function BrandVoicePageClient() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Brand Voice"
        description="AI content quality review queue. High-confidence content is auto-approved; low-confidence items appear here for human review."
        actions={
          <div className="flex items-center gap-3">
            <HelpVideo videoId="feature-tour-brand-voice" />
            <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5">
              <Shield className="h-3.5 w-3.5" />
              Auto-approve threshold: 85%
            </div>
          </div>
        }
      />


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Review queue */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wide">
            Pending Review
          </h2>
          <ReviewQueuePanel />
