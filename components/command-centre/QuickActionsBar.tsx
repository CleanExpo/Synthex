'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

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

const ACTIONS: Array<{
  id: DrawerType;
  label: string;
  icon: string;
  desc: string;
}> = [
  {
    id: 'content',
    label: 'Generate Content',
    icon: '✍️',
    desc: 'Create new AI content',
  },
  {
    id: 'strategy',
    label: 'Adjust Strategy',
    icon: '🎯',
    desc: 'Tune brand voice',
  },
  {
    id: 'ab-test',
    label: 'Run A/B Test',
    icon: '🧪',
    desc: 'Test content variants',
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
      <div className="flex gap-3">
        {ACTIONS.map(action => (
          <button
            key={action.id}
            onClick={() => setActiveDrawer(action.id)}
            className="flex-1 flex items-center gap-3 px-4 py-3 border-[0.5px] border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] rounded-sm transition-colors group"
          >
            <span className="text-lg">{action.icon}</span>
            <div className="text-left">
              <div className="text-xs font-medium text-white/70 group-hover:text-white/90 transition-colors">
                {action.label}
              </div>
              <div className="text-[10px] text-white/50">{action.desc}</div>
            </div>
          </button>
        ))}
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
