'use client';

import { useRouter } from 'next/navigation';
import { Users } from '@/components/icons';
import { AnimatedCard } from '../animated-card';

export function TeamTab() {
  const router = useRouter();

  return (
    <AnimatedCard delay={0.1}>
      <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b-[0.5px] border-white/[0.06]">
          <div className="flex items-center gap-2 mb-0.5">
            <Users className="h-3.5 w-3.5 text-orange-400" />
            <span className="text-[10px] uppercase tracking-[0.25em] text-white/40">
              Team Collaboration
            </span>
          </div>
          <p className="text-xs text-white/50 mt-1">
            Manage your team and collaborate on content
          </p>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Team Members */}
          <div className="space-y-2">
            <span className="text-[9px] uppercase tracking-[0.2em] text-white/50">
              Team Members
            </span>
            <div className="border-[0.5px] border-white/[0.04] bg-white/[0.01] rounded-sm p-5 flex items-center justify-center">
              <p className="text-[10px] text-white/50 text-center">
                No team members yet. Visit the Team page to invite members.
              </p>
            </div>
          </div>

          {/* Pending Invites */}
          <div className="space-y-2">
            <span className="text-[9px] uppercase tracking-[0.2em] text-white/50">
              Pending Invites
            </span>
            <div className="border-[0.5px] border-white/[0.04] bg-white/[0.01] rounded-sm px-4 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <span className="text-[10px] text-white/50">
                No pending invites
              </span>
              <button
                onClick={() => router.push('/dashboard/team')}
                className="flex items-center justify-center gap-2 px-4 py-2 border-[0.5px] border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] rounded-sm text-xs text-white/50 hover:text-white/70 transition-colors"
              >
                Invite Member
              </button>
            </div>
          </div>
        </div>
      </div>
    </AnimatedCard>
  );
}
