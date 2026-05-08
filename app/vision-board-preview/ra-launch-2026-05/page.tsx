/**
 * Vision Board · UNAUTHENTICATED PREVIEW route.
 *
 * Mirrors app/dashboard/admin/vision-board/ra-launch-2026-05/page.tsx but lives
 * outside the admin owner-guard so it can be eyeballed without a Synthex session.
 *
 * Use ONLY for local visual review. The production route is the admin one.
 */

import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  readPositioning,
  readICP,
  readRunbook,
  getWaveStates,
  getBridgeStatus,
} from '@/lib/vision-board/read-research';
import { getConnectionStatus } from '@/lib/quick-access/connection-status';

import { BrandPanel } from '../../dashboard/admin/vision-board/ra-launch-2026-05/panels/BrandPanel';
import { StoryboardPanel } from '../../dashboard/admin/vision-board/ra-launch-2026-05/panels/StoryboardPanel';
import { MotionPanel } from '../../dashboard/admin/vision-board/ra-launch-2026-05/panels/MotionPanel';
import { CopyPanel } from '../../dashboard/admin/vision-board/ra-launch-2026-05/panels/CopyPanel';
import { CompetitivePanel } from '../../dashboard/admin/vision-board/ra-launch-2026-05/panels/CompetitivePanel';
import { RunbookPanel } from '../../dashboard/admin/vision-board/ra-launch-2026-05/panels/RunbookPanel';
import { AICommentaryPanel } from '../../dashboard/admin/vision-board/ra-launch-2026-05/panels/AICommentaryPanel';
import { EvidencePanel } from '../../dashboard/admin/vision-board/ra-launch-2026-05/panels/EvidencePanel';
import { ConnectionStatusPanel } from '../../dashboard/admin/vision-board/ra-launch-2026-05/panels/ConnectionStatusPanel';

export const dynamic = 'force-dynamic';

const T_ZERO_ISO = '2026-05-08';

export default async function VisionBoardPreviewPage() {
  const [positioning, icp, runbook, waveStates, bridge, connectionChecks] = await Promise.all([
    readPositioning(),
    readICP(),
    readRunbook(),
    getWaveStates(),
    getBridgeStatus(),
    getConnectionStatus(),
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto flex flex-col gap-6 px-6 py-8">
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          PREVIEW ROUTE · auth bypassed for visual review only · production URL is{' '}
          <code className="font-mono">/dashboard/admin/vision-board/ra-launch-2026-05</code>
        </div>

        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="font-mono text-[10px]">
              SYN-923
            </Badge>
            <Badge variant="secondary" className="font-mono text-[10px]">
              Parent · SYN-915
            </Badge>
            <Badge variant="outline" className="font-mono text-[10px]">
              T+0 = {T_ZERO_ISO}
            </Badge>
          </div>
          <h1 className="text-3xl font-bold">RestoreAssist · App Store launch</h1>
          <p className="text-sm text-muted-foreground">
            Vision Board over Pi-CEO research artefacts. Brain layer (Pi-CEO/Pi-Dev-Ops)
            writes positioning, ICP, channel plan, copy, runbook. Eyes layer (this page)
            consolidates the output for review and decision.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Wave status</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-3">
              <span>
                Brain-2 vault:{' '}
                {bridge.vault ? (
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">
                    connected
                  </span>
                ) : (
                  <span className="font-mono text-amber-600 dark:text-amber-400">missing</span>
                )}
              </span>
              <span>·</span>
              <span>
                Pi-CEO direct:{' '}
                {bridge.piCeo ? (
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">
                    connected
                  </span>
                ) : (
                  <span className="font-mono text-amber-600 dark:text-amber-400">missing</span>
                )}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {waveStates.map(w => (
                <div
                  key={w.wave}
                  className={
                    'flex flex-col gap-1 rounded-lg border p-3 ' +
                    (w.status === 'ready'
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : w.status === 'in-progress'
                        ? 'border-amber-500/30 bg-amber-500/5'
                        : w.status === 'blocked'
                          ? 'border-destructive/30 bg-destructive/5'
                          : 'border-border bg-muted/20')
                  }
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-xs font-semibold">Wave {w.wave}</span>
                    <Badge variant="outline" className="text-[9px] capitalize">
                      {w.status}
                    </Badge>
                  </div>
                  {w.note && <p className="text-[11px] text-muted-foreground">{w.note}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Suspense fallback={<div>Loading…</div>}>
          <BrandPanel />
        </Suspense>

        <Suspense fallback={<div>Loading…</div>}>
          <StoryboardPanel />
        </Suspense>

        <Suspense fallback={<div>Loading…</div>}>
          <MotionPanel />
        </Suspense>

        <Suspense fallback={<div>Loading…</div>}>
          <CopyPanel
            positioningMd={positioning?.markdown ?? null}
            positioningUpdatedAt={positioning?.updatedAt.toISOString() ?? null}
            positioningSource={positioning?.source ?? null}
            icpMd={icp?.markdown ?? null}
          />
        </Suspense>

        <Suspense fallback={<div>Loading…</div>}>
          <CompetitivePanel />
        </Suspense>

        <Suspense fallback={<div>Loading…</div>}>
          <EvidencePanel />
        </Suspense>

        <Suspense fallback={<div>Loading…</div>}>
          <RunbookPanel runbook={runbook} tZeroIso={T_ZERO_ISO} />
        </Suspense>

        <Suspense fallback={<div>Loading…</div>}>
          <ConnectionStatusPanel checks={connectionChecks} />
        </Suspense>

        <Suspense fallback={<div>Loading…</div>}>
          <AICommentaryPanel />
        </Suspense>
      </div>
    </div>
  );
}
