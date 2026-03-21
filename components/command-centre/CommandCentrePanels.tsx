'use client';

import dynamic from 'next/dynamic';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InsightsWidget } from '@/components/insights/InsightsWidget';

// Dynamic imports — orphan components wired into tabs
const AIContentStudio = dynamic(
  () =>
    import('@/components/ai-content-studio').then(m => ({
      default: m.AIContentStudio,
    })),
  { ssr: false, loading: () => <TabLoading /> }
);
const AIPersonaManager = dynamic(
  () =>
    import('@/components/AIPersonaManager').then(m => ({
      default: m.AIPersonaManager,
    })),
  { ssr: false, loading: () => <TabLoading /> }
);
const AIABTesting = dynamic(
  () =>
    import('@/components/AIABTesting').then(m => ({ default: m.AIABTesting })),
  { ssr: false, loading: () => <TabLoading /> }
);
const PsychologyBrandGenerator = dynamic(
  () => import('@/components/strategic-marketing/PsychologyBrandGenerator'),
  { ssr: false, loading: () => <TabLoading /> }
);

function TabLoading() {
  return (
    <div className="h-48 flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-white/10 border-t-cyan-400/60 rounded-full animate-spin" />
    </div>
  );
}

const TABS = [
  { id: 'insights', label: 'Insights' },
  { id: 'studio', label: 'Content Studio' },
  { id: 'voice', label: 'Brand Voice' },
  { id: 'ab-tests', label: 'A/B Tests' },
  { id: 'psychology', label: 'Psychology' },
] as const;

export function CommandCentrePanels() {
  return (
    <div className="border-[0.5px] border-white/[0.06] rounded-sm">
      <Tabs defaultValue="insights">
        <TabsList className="w-full justify-start border-b border-white/[0.06] bg-transparent rounded-none p-0">
          {TABS.map(tab => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="text-xs text-white/40 data-[state=active]:text-white/80 data-[state=active]:border-b-2 data-[state=active]:border-cyan-400/60 rounded-none px-4 py-3"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="p-5">
          <TabsContent value="insights" className="mt-0">
            <InsightsWidget />
          </TabsContent>
          <TabsContent value="studio" className="mt-0">
            <AIContentStudio />
          </TabsContent>
          <TabsContent value="voice" className="mt-0">
            <AIPersonaManager />
          </TabsContent>
          <TabsContent value="ab-tests" className="mt-0">
            <AIABTesting />
          </TabsContent>
          <TabsContent value="psychology" className="mt-0">
            <PsychologyBrandGenerator />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
