'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ComponentType } from 'react';
import {
  Beaker,
  Brain,
  BrainCircuit,
  Lightbulb,
  Sparkles,
} from '@/components/icons';
import { InsightsWidget } from '@/components/insights/InsightsWidget';
import { cn } from '@/lib/utils';

const AIContentStudio = dynamic(
  () =>
    import('@/components/ai-content-studio').then(m => ({
      default: m.AIContentStudio,
    })),
  { ssr: false, loading: () => <PanelLoading /> }
);
const AIPersonaManager = dynamic(
  () =>
    import('@/components/AIPersonaManager').then(m => ({
      default: m.AIPersonaManager,
    })),
  { ssr: false, loading: () => <PanelLoading /> }
);
const AIABTesting = dynamic(
  () =>
    import('@/components/AIABTesting').then(m => ({ default: m.AIABTesting })),
  { ssr: false, loading: () => <PanelLoading /> }
);
const PsychologyBrandGenerator = dynamic(
  () => import('@/components/strategic-marketing/PsychologyBrandGenerator'),
  { ssr: false, loading: () => <PanelLoading /> }
);

function PanelLoading() {
  return (
    <div className="flex min-h-[16rem] items-center justify-center">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-[#FF6B35]/70" />
    </div>
  );
}

export const MARKETING_LAB_TABS = [
  {
    id: 'insights',
    label: 'Insights',
    description: 'AI-surfaced content opportunities on a four-hour cadence.',
    icon: Lightbulb,
    relatedHref: '/dashboard/insights',
    relatedLabel: 'Full insights history',
  },
  {
    id: 'studio',
    label: 'Content Studio',
    description: 'Generate platform-ready drafts from a single brief.',
    icon: Sparkles,
    relatedHref: '/dashboard/content',
    relatedLabel: 'Content workspace',
  },
  {
    id: 'voice',
    label: 'Brand Voice',
    description: 'Train personas and keep output aligned with your tone.',
    icon: Brain,
    relatedHref: '/dashboard/brand-voice',
    relatedLabel: 'Brand voice settings',
  },
  {
    id: 'ab-tests',
    label: 'A/B Tests',
    description: 'Run variants, measure lift, and pick winners with confidence.',
    icon: Beaker,
    relatedHref: '/dashboard/experiments',
    relatedLabel: 'Experiments hub',
  },
  {
    id: 'psychology',
    label: 'Psychology',
    description: 'Apply persuasion principles to messaging and brand positioning.',
    icon: BrainCircuit,
    relatedHref: '/dashboard/psychology',
    relatedLabel: 'Psychology analyser',
  },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  relatedHref: string;
  relatedLabel: string;
}>;

export type MarketingLabTabId = (typeof MARKETING_LAB_TABS)[number]['id'];

function isMarketingLabTab(value: string | null): value is MarketingLabTabId {
  return MARKETING_LAB_TABS.some(tab => tab.id === value);
}

function PanelContent({ tab }: { tab: MarketingLabTabId }) {
  switch (tab) {
    case 'insights':
      return <InsightsWidget />;
    case 'studio':
      return <AIContentStudio embedded />;
    case 'voice':
      return <AIPersonaManager embedded />;
    case 'ab-tests':
      return <AIABTesting embedded />;
    case 'psychology':
      return <PsychologyBrandGenerator embedded />;
    default:
      return null;
  }
}

export function MarketingLabPanels() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: MarketingLabTabId = isMarketingLabTab(tabParam)
    ? tabParam
    : 'insights';

  const setTab = useCallback(
    (tab: MarketingLabTabId) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', tab);
      router.replace(`/dashboard/marketing-lab?${params.toString()}`, {
        scroll: false,
      });
    },
    [router, searchParams]
  );

  const activeMeta = MARKETING_LAB_TABS.find(tab => tab.id === activeTab)!;
  const ActiveIcon = activeMeta.icon;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
      <aside className="lg:w-60 lg:shrink-0">
        <p className="mb-2 hidden px-1 text-xs uppercase tracking-[0.2em] text-white/35 lg:block">
          Tools
        </p>
        <nav
          aria-label="Marketing Lab sections"
          className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:rounded-sm lg:border lg:border-white/6 lg:bg-white/2 lg:p-1.5 lg:pb-1.5"
        >
          {MARKETING_LAB_TABS.map(tab => {
            const isActive = tab.id === activeTab;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTab(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex min-w-[8.5rem] items-start gap-2.5 rounded-sm border px-3 py-2.5 text-left transition-colors lg:min-w-0 lg:w-full lg:border-transparent lg:px-2.5',
                  isActive
                    ? 'border-[#FF6B35]/25 bg-[#FF6B35]/8 text-white lg:bg-[#FF6B35]/10'
                    : 'border-white/6 bg-white/2 text-white/55 hover:border-white/10 hover:text-white/80 lg:hover:bg-white/4'
                )}
              >
                <TabIcon
                  className={cn(
                    'mt-0.5 h-4 w-4 shrink-0',
                    isActive ? 'text-[#FF6B35]' : 'text-white/40'
                  )}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium leading-tight">
                    {tab.label}
                  </span>
                  <span className="mt-0.5 hidden text-[11px] leading-snug text-white/40 lg:block">
                    {tab.description.split('.')[0]}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="min-w-0 flex-1">
        <header className="mb-5 flex flex-col gap-4 border-b border-white/6 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-[#FF6B35]/20 bg-[#FF6B35]/8">
              <ActiveIcon className="h-4 w-4 text-[#FF6B35]" />
            </div>
            <div>
              <h2 className="text-xl font-light tracking-tight text-white">
                {activeMeta.label}
              </h2>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-white/40">
                {activeMeta.description}
              </p>
            </div>
          </div>
          <Link
            href={activeMeta.relatedHref}
            className="shrink-0 text-xs text-[#FF6B35]/80 transition-colors hover:text-[#FF6B35]"
          >
            {activeMeta.relatedLabel} →
          </Link>
        </header>

        <div
          key={activeTab}
          className="rounded-sm border border-white/6 bg-[#0a0a12]/60 p-4 sm:p-6"
        >
          <PanelContent tab={activeTab} />
        </div>
      </section>
    </div>
  );
}
