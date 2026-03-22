'use client';

import { Zap, MessageSquare, Target, Calendar } from '@/components/icons';
import { AnimatedCard } from '../animated-card';
import { aiQuickActions } from '../dashboard-config';

const ACTION_ICONS = [MessageSquare, Target, Calendar];

export function AIStudioTab() {
  return (
    <AnimatedCard delay={0.1}>
      <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b-[0.5px] border-white/[0.06]">
          <div className="flex items-center gap-2 mb-0.5">
            <Zap className="h-3.5 w-3.5 text-orange-400" />
            <span className="text-[10px] uppercase tracking-[0.25em] text-white/40">
              AI Content Studio
            </span>
          </div>
          <p className="text-xs text-white/50 mt-1">
            Generate viral content with AI-powered tools
          </p>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {aiQuickActions.map((action, i) => {
              const Icon = ACTION_ICONS[i] ?? Zap;
              return (
                <button
                  key={i}
                  className="flex items-center sm:flex-col sm:items-center gap-3 sm:gap-2 p-4 border-[0.5px] border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.04] hover:border-white/[0.1] rounded-sm transition-colors text-left sm:text-center"
                >
                  <Icon className="h-4 w-4 text-white/50 shrink-0" />
                  <div>
                    <span className="text-xs text-white/60 block font-light">
                      {action.title}
                    </span>
                    <span className="text-[10px] text-white/50 mt-0.5 block">
                      {action.desc}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Recent AI Generations */}
          <div className="space-y-2">
            <span className="text-[9px] uppercase tracking-[0.2em] text-white/50">
              Recent AI Generations
            </span>
            <div className="border-[0.5px] border-white/[0.04] bg-white/[0.01] rounded-sm p-5 flex items-center justify-center">
              <p className="text-[10px] text-white/50 text-center">
                No AI generations yet. Use the tools above to get started.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AnimatedCard>
  );
}
