'use client';

import { useRouter } from 'next/navigation';
import { Plus } from '@/components/icons';
import { cn } from '@/lib/utils';

interface DashboardHeaderProps {
  showNotifications: boolean;
  onToggleNotifications: () => void;
  isNewUser?: boolean;
}

/** Dashboard page header — Scientific Luxury: extralight heading, sharp CTA */
export function DashboardHeader({ isNewUser }: DashboardHeaderProps) {
  const router = useRouter();

  return (
    <div className="mb-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/50 mb-2 block">
            Overview
          </span>
          <h1 className="text-3xl sm:text-4xl font-extralight tracking-tight text-white">
            {isNewUser ? 'Welcome to Synthex.' : 'Command Centre'}
          </h1>
          <p className="mt-1.5 text-sm text-white/40 leading-relaxed">
            {isNewUser
              ? "Let's get your first content published and platforms connected."
              : 'Your marketing, running autonomously.'}
          </p>
        </div>

        <button
          onClick={() => router.push('/dashboard/content')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-400',
            'text-[#050505] text-xs font-semibold tracking-wide rounded-sm',
            'transition-colors duration-200 flex-shrink-0'
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          New Post
        </button>
      </div>

      {/* Divider */}
      <div className="mt-5 h-px bg-white/[0.06]" />
    </div>
  );
}
