'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowLeft, CommandLine } from '@/components/icons';
import { PageHeader } from '@/components/dashboard/page-header';
import { MarketingLabPanels } from './MarketingLabPanels';

function MarketingLabSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <div className="flex gap-2 overflow-hidden lg:w-60 lg:flex-col lg:gap-1.5">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-12 min-w-[8rem] rounded-sm border border-white/6 bg-white/2 lg:min-w-0"
            />
          ))}
        </div>
        <div className="min-w-0 flex-1 space-y-5">
          <div className="flex gap-3 border-b border-white/6 pb-5">
            <div className="h-10 w-10 rounded-sm bg-white/4" />
            <div className="space-y-2">
              <div className="h-6 w-36 rounded-sm bg-white/4" />
              <div className="h-4 w-56 rounded-sm bg-white/3" />
            </div>
          </div>
          <div className="h-[28rem] rounded-sm border border-white/6 bg-white/2" />
        </div>
      </div>
    </div>
  );
}

export function MarketingLabPageClient() {
  return (
    <div className="mx-auto max-w-9xl">
      <Link
        href="/dashboard"
        className="mb-5 inline-flex items-center gap-2 text-xs text-white/40 transition-colors hover:text-white/70"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Command Centre
      </Link>

      <PageHeader
        eyebrow="Advanced"
        title="Marketing Lab"
        description="Research, create, refine voice, experiment, and sharpen messaging — separate from day-to-day operations."
        actions={
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-sm border border-white/8 bg-white/2 px-3 py-2 text-xs text-white/60 transition-colors hover:border-white/15 hover:text-white"
          >
            <CommandLine className="h-3.5 w-3.5" />
            Command Centre
          </Link>
        }
      />

      <p className="-mt-2 mb-8 text-xs uppercase tracking-[0.22em] text-white/30">
        Insights · Studio · Voice · Tests · Psychology
      </p>

      <Suspense fallback={<MarketingLabSkeleton />}>
        <MarketingLabPanels />
      </Suspense>
    </div>
  );
}
