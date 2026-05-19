import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import type { ExportManifest } from '@/lib/marketing-agency/types';

interface ExportManifestPanelProps {
  manifest: ExportManifest;
}

export function ExportManifestPanel({ manifest }: ExportManifestPanelProps) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-light leading-none tracking-tight text-white">
          Export Manifest
        </h2>
        <CardDescription>Draft package metadata for channel variants and asset gates.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-white/60">Formats</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {manifest.formats.map((format) => (
              <span key={format} className="rounded-sm border border-white/10 px-3 py-1 text-sm text-white/75">
                {format}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-white/60">Assets</p>
          <div className="mt-2 grid gap-2">
            {manifest.assets.map((asset) => (
              <div key={asset.id} className="rounded-sm border border-white/10 px-3 py-2 text-sm text-white/75">
                {asset.assetType} · {asset.provider} · {asset.licenceStatus}
              </div>
            ))}
          </div>
        </div>
        {manifest.blockedReasons.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wide text-white/60">Blocked Reasons</p>
            <ul className="mt-2 grid gap-2 text-sm text-white/75">
              {manifest.blockedReasons.map((reason) => (
                <li key={reason} className="rounded-sm border border-red-500/20 px-3 py-2">
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
