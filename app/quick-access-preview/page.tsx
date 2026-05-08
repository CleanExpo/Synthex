/**
 * Quick Access Storyboard · UNAUTHENTICATED PREVIEW route.
 *
 * Mirrors app/dashboard/admin/quick-access/page.tsx but lives outside the
 * admin owner-guard so the storyboard view can be eyeballed without a Synthex
 * session.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { QUICK_ACCESS_LANES } from '@/lib/quick-access/items';
import { StoryboardLane } from '../dashboard/admin/quick-access/StoryboardLane';

export const dynamic = 'force-dynamic';

export default function QuickAccessPreviewPage() {
  const totalItems = QUICK_ACCESS_LANES.reduce((sum, l) => sum + l.items.length, 0);
  const totalApproval =
    QUICK_ACCESS_LANES.find(l => l.status === 'approval-needed')?.items.length ?? 0;
  const totalChanges =
    QUICK_ACCESS_LANES.find(l => l.status === 'changes-required')?.items.length ?? 0;
  const totalHuman =
    QUICK_ACCESS_LANES.find(l => l.status === 'human-action')?.items.length ?? 0;
  const totalHighlights = QUICK_ACCESS_LANES.flatMap(l => l.items).filter(i => i.highlight).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto flex flex-col gap-8 px-6 py-8">
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          PREVIEW ROUTE · auth bypassed for visual review only · production URL is{' '}
          <code className="font-mono">/dashboard/admin/quick-access</code>
        </div>

        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="font-mono text-[10px]">
              QUICK ACCESS
            </Badge>
            <Badge variant="outline" className="font-mono text-[10px]">
              {totalItems} items
            </Badge>
            {totalHighlights > 0 && (
              <Badge variant="secondary" className="font-mono text-[10px]">
                ★ {totalHighlights} highlighted
              </Badge>
            )}
          </div>
          <h1 className="text-3xl font-bold">Quick Access · Storyboard view</h1>
          <p className="text-sm text-muted-foreground">
            The visual companion to{' '}
            <code className="font-mono">~/Desktop/Synthex-Quick-Access/</code>. Each card is one
            item · status colour tells you what kind of attention it needs · click any card to
            open the source file or destination URL.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Today&apos;s pile</CardTitle>
            <CardDescription>
              Scan top-to-bottom. Pick the lane that matches your time and energy.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <div className="flex flex-col gap-1 rounded-lg border border-border bg-background p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xl">🟠</span>
                  <span className="font-mono text-2xl font-semibold">{totalApproval}</span>
                </div>
                <p className="text-xs font-medium">Approval needed</p>
                <p className="text-[10px] text-muted-foreground">≤15 min each</p>
              </div>
              <div className="flex flex-col gap-1 rounded-lg border border-border bg-background p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xl">🟡</span>
                  <span className="font-mono text-2xl font-semibold">{totalChanges}</span>
                </div>
                <p className="text-xs font-medium">Changes required</p>
                <p className="text-[10px] text-muted-foreground">source-pull tasks</p>
              </div>
              <div className="flex flex-col gap-1 rounded-lg border border-border bg-background p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xl">🔵</span>
                  <span className="font-mono text-2xl font-semibold">{totalHuman}</span>
                </div>
                <p className="text-xs font-medium">Human action</p>
                <p className="text-[10px] text-muted-foreground">only you can do these</p>
              </div>
              <div className="flex flex-col gap-1 rounded-lg border border-border bg-background p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xl">⚪️</span>
                  <span className="font-mono text-2xl font-semibold">
                    {QUICK_ACCESS_LANES.find(l => l.status === 'reference')?.items.length ?? 0}
                  </span>
                </div>
                <p className="text-xs font-medium">Reference</p>
                <p className="text-[10px] text-muted-foreground">always-on</p>
              </div>
              <div className="flex flex-col gap-1 rounded-lg border border-border bg-background p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xl">🌐</span>
                  <span className="font-mono text-2xl font-semibold">
                    {QUICK_ACCESS_LANES.find(l => l.status === 'live-link')?.items.length ?? 0}
                  </span>
                </div>
                <p className="text-xs font-medium">Live links</p>
                <p className="text-[10px] text-muted-foreground">quick jumps</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {QUICK_ACCESS_LANES.map(lane => (
          <StoryboardLane
            key={lane.status}
            status={lane.status}
            label={lane.label}
            description={lane.description}
            emoji={lane.emoji}
            items={lane.items}
          />
        ))}
      </div>
    </div>
  );
}
