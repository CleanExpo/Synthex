'use client';

/**
 * PR Journalist CRM — Main Dashboard Page (Phase 92)
 *
 * 4 tabs: Journalists | Pitches | Coverage | Press Releases
 * Tab state synced to URL ?tab= query param for direct linking.
 *
 * @module app/dashboard/pr/page
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Newspaper, Users, Send, Globe, FileText } from '@/components/icons';
import { PROverviewStats } from '@/components/pr/PROverviewStats';
import { JournalistList } from '@/components/pr/JournalistList';
import { PitchKanban } from '@/components/pr/PitchKanban';
import { CoverageFeed } from '@/components/pr/CoverageFeed';
import { PressReleaseEditor } from '@/components/pr/PressReleaseEditor';

// ---------------------------------------------------------------------------
// Valid tab keys
// ---------------------------------------------------------------------------

type PRTab = 'journalists' | 'pitches' | 'coverage' | 'press-releases';

const VALID_TABS: PRTab[] = ['journalists', 'pitches', 'coverage', 'press-releases'];

function isValidTab(value: string | null): value is PRTab {
  return VALID_TABS.includes(value as PRTab);
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function PRManagerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get('tab');
  const initialTab: PRTab = isValidTab(tabParam) ? tabParam : 'journalists';
  const [activeTab, setActiveTab] = useState<PRTab>(initialTab);

  // Sync tab state to URL
  const handleTabChange = (value: string) => {
    const tab = value as PRTab;
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`/dashboard/pr?${params.toString()}`, { scroll: false });
  };

  // Sync URL changes (e.g. back/forward navigation) to state
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (isValidTab(tab) && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [searchParams, activeTab]);

  return (
    <div className="max-w-screen-xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
          <Newspaper className="h-6 w-6 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">PR Manager</h1>
          <p className="text-sm text-gray-400">
            Journalist CRM · Pitch tracking · Coverage monitoring · Press releases
          </p>
        </div>
      </div>

      {/* Overview stats — always visible */}
      <PROverviewStats />

      {/* Tabbed content */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList variant="glass" className="w-full sm:w-auto">
          <TabsTrigger value="journalists" className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            Journalists
          </TabsTrigger>
          <TabsTrigger value="pitches" className="flex items-center gap-1.5">
            <Send className="h-4 w-4" />
            Pitches
          </TabsTrigger>
          <TabsTrigger value="coverage" className="flex items-center gap-1.5">
            <Globe className="h-4 w-4" />
            Coverage
          </TabsTrigger>
          <TabsTrigger value="press-releases" className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            Press Releases
          </TabsTrigger>
        </TabsList>

        {/* Journalists tab */}
        <TabsContent value="journalists">
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6">
            <JournalistList />
          </div>
        </TabsContent>

        {/* Pitches tab */}
        <TabsContent value="pitches">
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6">
            <PitchKanban />
          </div>
        </TabsContent>

        {/* Coverage tab */}
        <TabsContent value="coverage">
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6">
            <CoverageFeed />
          </div>
        </TabsContent>

        {/* Press Releases tab */}
        <TabsContent value="press-releases">
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6">
            <PressReleaseEditor />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
