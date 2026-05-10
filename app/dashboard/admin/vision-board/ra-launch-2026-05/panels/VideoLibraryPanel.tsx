'use client';

/**
 * Video Library panel — rendered brand videos for RA launch + portfolio.
 * Sources MP4s from /public/videos/ (Synthex-hosted) so they preview locally
 * and ship with the deployed Vision Board.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface VideoEntry {
  brand: string;
  title: string;
  src: string;
  durationSec: number;
  scenes: number;
  jobId: string;
}

const VIDEOS: VideoEntry[] = [
  {
    brand: 'RestoreAssist',
    title: 'App Store preview',
    src: '/videos/ra-app-store-preview-30s.mp4',
    durationSec: 20.3,
    scenes: 4,
    jobId: 'ra-appstore-001',
  },
  {
    brand: 'RestoreAssist',
    title: 'Day in the life — real screens',
    src: '/videos/ra-day-in-life.mp4',
    durationSec: 44.3,
    scenes: 6,
    jobId: 'ra-day-in-life-001',
  },
  {
    brand: 'RestoreAssist',
    title: 'Field to PDF — 5-step product walkthrough',
    src: '/videos/ra-field-to-pdf.mp4',
    durationSec: 53.5,
    scenes: 7,
    jobId: 'ra-field-to-pdf-001',
  },
  {
    brand: 'RestoreAssist',
    title: 'Dispute Defence Pack — IICRC evidence',
    src: '/videos/ra-dispute-defence.mp4',
    durationSec: 29.2,
    scenes: 4,
    jobId: 'ra-dispute-defence-001',
  },
  {
    brand: 'RestoreAssist',
    title: 'BYOK — Your AI. Your key. Your control.',
    src: '/videos/ra-byok.mp4',
    durationSec: 57.9,
    scenes: 7,
    jobId: 'ra-byok-001',
  },
  {
    brand: 'Disaster Recovery',
    title: 'Platform demo',
    src: '/videos/dr-platform-demo-60s.mp4',
    durationSec: 39.8,
    scenes: 5,
    jobId: 'dr-demo-001',
  },
  {
    brand: 'NRPG',
    title: 'Community intro',
    src: '/videos/nrpg-community-intro-60s.mp4',
    durationSec: 40.4,
    scenes: 5,
    jobId: 'nrpg-intro-001',
  },
  {
    brand: 'CARSI',
    title: 'Compliance explainer',
    src: '/videos/carsi-compliance-explainer-45s.mp4',
    durationSec: 28.0,
    scenes: 4,
    jobId: 'carsi-explainer-001',
  },
  {
    brand: 'CCW',
    title: 'Trade signup',
    src: '/videos/ccw-trade-signup-60s.mp4',
    durationSec: 35.1,
    scenes: 5,
    jobId: 'ccw-signup-001',
  },
  {
    brand: 'Synthex',
    title: 'Product demo',
    src: '/videos/synthex-product-demo-60s.mp4',
    durationSec: 42.2,
    scenes: 6,
    jobId: 'synthex-demo-001',
  },
  {
    brand: 'Unite Group',
    title: 'Build update · 8 May',
    src: '/videos/unite-group-build-update-20260508.mp4',
    durationSec: 105.4,
    scenes: 8,
    jobId: 'unite-update-20260508',
  },
];

export function VideoLibraryPanel() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Video Library — rendered + live</CardTitle>
            <CardDescription>
              7 brand videos · ElevenLabs voiceover · no dead air · 1080p · ready for distribution.
            </CardDescription>
          </div>
          <Badge variant="outline" className="font-mono text-[10px]">
            {VIDEOS.length} videos · {VIDEOS.reduce((s, v) => s + v.durationSec, 0).toFixed(0)}s total
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {VIDEOS.map(v => (
            <article
              key={v.jobId}
              className="overflow-hidden rounded-lg border border-border bg-card"
            >
              <div className="bg-black">
                <video
                  src={v.src}
                  controls
                  preload="metadata"
                  className="block h-auto w-full"
                />
              </div>
              <div className="flex items-start justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{v.brand}</p>
                  <p className="truncate text-xs text-muted-foreground">{v.title}</p>
                </div>
                <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                  {v.durationSec}s · {v.scenes} scenes
                </Badge>
              </div>
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
