/**
 * Quick Access Storyboard · /dashboard/admin/quick-access
 *
 * Visual swim-lane dashboard for everything in flight across the portfolio.
 * Mirrors the structure of ~/Desktop/Synthex-Quick-Access/ — the desktop
 * folder is the markdown view; this page is the visual view. Both read from
 * lib/quick-access/items.ts.
 *
 * Owner-only · inherits auth gate from app/dashboard/admin/layout.tsx.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { QUICK_ACCESS_LANES } from '@/lib/quick-access/items';
import { StoryboardLane } from './StoryboardLane';

export const dynamic = 'force-dynamic';

export default function QuickAccessPage() {
  const totalItems = QUICK_ACCESS_LANES.reduce((sum, l) => sum + l.items.length, 0);
  const totalApproval = QUICK_ACCESS_LANES.find(l => l.status === 'approval-needed')?.items.length ?? 0;
  const totalChanges = QUICK_ACCESS_LANES.find(l => l.status === 'changes-required')?.items.length ?? 0;
  const totalHuman = QUICK_ACCESS_LANES.find(l => l.status === 'human-action')?.items.length ?? 0;
  const totalHighlights = QUICK_ACCESS_LANES.flatMap(l => l.items).filter(i => i.highlight).length;

  return (
    <div className="container mx-auto flex flex-col gap-8 px-6 py-8">
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
          item · status colour tells you what kind of attention it needs · click any card to open
          the source file or destination URL.
        </p>
      </header>

      {/* Summary tiles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Today&apos;s pile</CardTitle>
          <CardDescription>
            Scan top-to-bottom. Pick the lane that matches your time and energy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <SummaryTile
              emoji="🟠"
              label="Approval needed"
              count={totalApproval}
              note="≤15 min each"
            />
            <SummaryTile
              emoji="🟡"
              label="Changes required"
              count={totalChanges}
              note="source-pull tasks"
            />
            <SummaryTile
              emoji="🔵"
              label="Human action"
              count={totalHuman}
              note="only you can do these"
            />
            <SummaryTile
              emoji="⚪️"
              label="Reference"
              count={QUICK_ACCESS_LANES.find(l => l.status === 'reference')?.items.length ?? 0}
              note="always-on"
            />
            <SummaryTile
              emoji="🌐"
              label="Live links"
              count={QUICK_ACCESS_LANES.find(l => l.status === 'live-link')?.items.length ?? 0}
              note="quick jumps"
            />
          </div>
        </CardContent>
      </Card>

      {/* Five swim-lanes */}
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

      {/* Footer · how to use this view */}
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-sm">How to use this view</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-xs text-muted-foreground">
          <p>
            <strong className="text-foreground">Visual scan first.</strong> The colour bar on the
            left of each card tells you the status. The icon tells you the kind of work. The
            highlight star marks pieces that unlock the most downstream value.
          </p>
          <p>
            <strong className="text-foreground">Click any card.</strong> External links (Linear,
            Supabase, source URLs) open in a new tab. Vault paths and code paths drop you into the
            source file when opened from a markdown viewer or terminal.
          </p>
          <p>
            <strong className="text-foreground">Add or close items.</strong> Edit{' '}
            <code className="font-mono">lib/quick-access/items.ts</code> to add/remove items, then
            refresh this page. The desktop folder at{' '}
            <code className="font-mono">~/Desktop/Synthex-Quick-Access/</code> is the markdown
            mirror — both views read from the same conceptual model.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTile({
  emoji,
  label,
  count,
  note,
}: {
  emoji: string;
  label: string;
  count: number;
  note: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-background p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xl" aria-hidden="true">
          {emoji}
        </span>
        <span className="font-mono text-2xl font-semibold">{count}</span>
      </div>
      <p className="text-xs font-medium">{label}</p>
      <p className="text-[10px] text-muted-foreground">{note}</p>
    </div>
  );
}
