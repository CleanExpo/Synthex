'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { FlaskConical, Palette, Sparkles } from '@/components/icons';
import type { ComponentType, SVGProps } from 'react';

// Dynamic imports for orphan components (large bundles, lazy-loaded)
const AIContentStudio = dynamic(
  () =>
    import('@/components/ai-content-studio').then(m => ({
      default: m.AIContentStudio,
    })),
  { ssr: false }
);
const AIPersonaManager = dynamic(
  () =>
    import('@/components/AIPersonaManager').then(m => ({
      default: m.AIPersonaManager,
    })),
  { ssr: false }
);
const AIABTesting = dynamic(
  () =>
    import('@/components/AIABTesting').then(m => ({ default: m.AIABTesting })),
  { ssr: false }
);

type DrawerType = 'content' | 'strategy' | 'ab-test' | null;
type ActionIcon = ComponentType<SVGProps<SVGSVGElement>>;

const ACTIONS: Array<{
  id: Exclude<DrawerType, null>;
  label: string;
  icon: ActionIcon;
  desc: string;
  action: string;
}> = [
  {
    id: 'content',
    label: 'Build Campaign',
    icon: Sparkles,
    desc: 'Draft posts, angles, scripts and assets.',
    action: 'Generate',
  },
  {
    id: 'strategy',
    label: 'Shape Brand',
    icon: Palette,
    desc: 'Tune persona, voice and positioning.',
    action: 'Refine',
  },
  {
    id: 'ab-test',
    label: 'Test Variant',
    icon: FlaskConical,
    desc: 'Compare hooks, offers and creative routes.',
    action: 'Compare',
  },
];

const DRAWER_TITLES: Record<string, string> = {
  content: 'AI Content Studio',
  strategy: 'Brand Voice Manager',
  'ab-test': 'A/B Testing',
};

export function QuickActionsBar() {
  const [activeDrawer, setActiveDrawer] = useState<DrawerType>(null);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {ACTIONS.map(action => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={() => setActiveDrawer(action.id)}
              className="flex min-w-0 items-start gap-3 rounded-md border-[0.5px] border-white/[0.07] bg-white/[0.025] px-4 py-3 text-left transition-colors hover:border-cyan-400/25 hover:bg-white/[0.045]"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-[0.5px] border-cyan-400/15 bg-cyan-400/[0.06] text-cyan-200">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="truncate text-xs font-medium uppercase tracking-wider text-white/75">
                    {action.label}
                  </div>
                  <div className="shrink-0 text-[10px] uppercase tracking-wider text-cyan-200/70">
                    {action.action}
                  </div>
                </div>
                <div className="mt-1 text-[11px] leading-relaxed text-white/45">
                  {action.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Sheet drawers */}
      <Sheet
        open={activeDrawer !== null}
        onOpenChange={() => setActiveDrawer(null)}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-[600px] overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>
              {activeDrawer ? DRAWER_TITLES[activeDrawer] : ''}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {activeDrawer === 'content' && <AIContentStudio />}
            {activeDrawer === 'strategy' && <AIPersonaManager />}
            {activeDrawer === 'ab-test' && <AIABTesting />}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
