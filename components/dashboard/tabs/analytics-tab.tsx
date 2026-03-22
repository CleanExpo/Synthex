'use client';

import { TrendingUp, BarChart3, RefreshCw } from '@/components/icons';
import { AnimatedCard } from '../animated-card';

export function AnalyticsTab() {
  return (
    <AnimatedCard delay={0.1}>
      <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b-[0.5px] border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <TrendingUp className="h-3.5 w-3.5 text-orange-400" />
              <span className="text-[10px] uppercase tracking-[0.25em] text-white/40">
                Real-Time Analytics
              </span>
            </div>
            <p className="text-xs text-white/50 mt-1">
              Live performance metrics across all platforms
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-4 py-2 border-[0.5px] border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] rounded-sm text-xs text-white/50 hover:text-white/70 transition-colors w-full sm:w-auto justify-center"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Engagement Chart Placeholder */}
            <div className="md:col-span-2 order-2 md:order-1">
              <div className="h-48 sm:h-64 border-[0.5px] border-white/[0.04] bg-white/[0.01] rounded-sm flex items-center justify-center">
                <div className="text-center px-4">
                  <BarChart3 className="h-8 w-8 mx-auto mb-3 text-white/40" />
                  <p className="text-xs text-white/70">Engagement Over Time</p>
                  <p className="text-[10px] text-white/70 mt-1">
                    Chart visualisation connected to backend
                  </p>
                </div>
              </div>
            </div>

            {/* Platform Breakdown */}
            <div className="order-1 md:order-2 space-y-3">
              <span className="text-[9px] uppercase tracking-[0.2em] text-white/50">
                Platform Breakdown
              </span>
              <div className="border-[0.5px] border-white/[0.04] bg-white/[0.01] rounded-sm p-4 flex items-center justify-center min-h-[80px]">
                <p className="text-[10px] text-white/50 text-center">
                  No platform data yet. Connect your accounts to see analytics.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AnimatedCard>
  );
}
