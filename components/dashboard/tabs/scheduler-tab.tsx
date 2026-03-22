'use client';

import { Calendar, Plus } from '@/components/icons';
import { AnimatedCard } from '../animated-card';
import { useRouter } from 'next/navigation';

export function SchedulerTab() {
  const router = useRouter();

  return (
    <AnimatedCard delay={0.1}>
      <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b-[0.5px] border-white/[0.06]">
          <div className="flex items-center gap-2 mb-0.5">
            <Calendar className="h-3.5 w-3.5 text-orange-400" />
            <span className="text-[10px] uppercase tracking-[0.25em] text-white/40">
              Post Scheduler
            </span>
          </div>
          <p className="text-xs text-white/50 mt-1">
            Schedule and manage your upcoming posts
          </p>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Upcoming Posts */}
          <div className="space-y-2">
            <span className="text-[9px] uppercase tracking-[0.2em] text-white/50">
              Upcoming Posts
            </span>
            <div className="border-[0.5px] border-white/[0.04] bg-white/[0.01] rounded-sm p-5 flex items-center justify-center">
              <p className="text-[10px] text-white/50 text-center">
                No scheduled posts yet. Create your first post to get started.
              </p>
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={() => router.push('/dashboard/content')}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-medium tracking-wide rounded-sm transition-colors bg-orange-500 hover:bg-orange-400 text-[#050505]"
          >
            <Plus className="h-3.5 w-3.5" />
            Schedule New Post
          </button>
        </div>
      </div>
    </AnimatedCard>
  );
}
