'use client';

/**
 * Report Presets Panel
 *
 * Fetches available report presets from GET /api/analytics/reports and renders
 * them as cards. Clicking "Generate" runs the report via POST and triggers a
 * file download.
 */

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Download,
  BarChart2,
  Users,
  TrendingUp,
  Target,
} from '@/components/icons';
import { fetchJson } from '@/lib/fetcher';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PresetItem {
  id: string;
  name: string;
  type: string;
  description: string;
}

interface PresetsResponse {
  presets: PresetItem[];
  options: {
    exportFormats: string[];
  };
}

type ExportFormat = 'csv' | 'json' | 'pdf';

const PRESET_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  weeklyOverview: BarChart2,
  monthlyEngagement: TrendingUp,
  contentPerformance: FileText,
  audienceGrowth: Users,
  campaignROI: Target,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function generateReport(
  presetId: string,
  format: ExportFormat
): Promise<void> {
  // GET the preset config first
  const presetRes = await fetch(
    `/api/analytics/reports?preset=${encodeURIComponent(presetId)}`,
    { credentials: 'include' }
  );
  if (!presetRes.ok) throw new Error('Failed to load report preset');
  const { config } = await presetRes.json();

  // Build date range: last 30 days
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);

  // POST to generate the report
  const genRes = await fetch('/api/analytics/reports', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...config,
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      exportFormat: format,
    }),
  });

  if (!genRes.ok) {
    const errData = await genRes.json().catch(() => ({}));
    throw new Error(
      (errData as { error?: string }).error ??
        `Report generation failed (${genRes.status})`
    );
  }

  // If the server returned a file stream, trigger download
  const contentType = genRes.headers.get('Content-Type') ?? '';
  if (
    contentType.includes('text/csv') ||
    contentType.includes('application/pdf') ||
    contentType.includes('octet-stream')
  ) {
    const blob = await genRes.blob();
    const contentDisposition = genRes.headers.get('Content-Disposition') ?? '';
    const filenameMatch = contentDisposition.match(/filename="(.+?)"/);
    const filename = filenameMatch?.[1] ?? `report-${presetId}.${format}`;
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }
  // If JSON is returned (inline data), the report was logged server-side — no download needed
}

// ── Preset Card ───────────────────────────────────────────────────────────────

function PresetCard({
  preset,
  defaultFormat,
}: {
  preset: PresetItem;
  defaultFormat: ExportFormat;
}) {
  const [format, setFormat] = useState<ExportFormat>(defaultFormat);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const Icon = PRESET_ICONS[preset.id] ?? FileText;

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    try {
      await generateReport(preset.id, format);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsGenerating(false);
    }
  }, [preset.id, format]);

  return (
    <Card className="bg-white/5 border-white/10 hover:border-white/20 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex-shrink-0">
              <Icon className="h-4 w-4 text-cyan-400" />
            </div>
            <CardTitle className="text-sm font-semibold text-white leading-tight">
              {preset.name}
            </CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          {preset.description}
        </p>
        <div className="flex items-center gap-2">
          <Select
            value={format}
            onValueChange={v => setFormat(v as ExportFormat)}
          >
            <SelectTrigger className="h-8 text-xs bg-white/5 border-white/10 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv" className="text-xs">
                CSV
              </SelectItem>
              <SelectItem value="json" className="text-xs">
                JSON
              </SelectItem>
              <SelectItem value="pdf" className="text-xs">
                PDF
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-white/10 text-slate-300 hover:text-white hover:border-white/30 flex-1"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            <Download className="mr-1.5 h-3 w-3" />
            {isGenerating ? 'Generating…' : 'Generate'}
          </Button>
        </div>
        {error && (
          <p className="text-xs text-red-400 mt-2 truncate" title={error}>
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ReportPresetsPanel() {
  const { data, isLoading, error } = useSWR<PresetsResponse>(
    '/api/analytics/reports',
    fetchJson,
    { revalidateOnFocus: false }
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-5 w-40 bg-white/5 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-36 rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data?.presets?.length) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-cyan-400" />
        <h2 className="text-sm font-semibold text-white">Report Presets</h2>
        <span className="text-xs text-slate-500">
          — generate &amp; download
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {data.presets.map(preset => (
          <PresetCard key={preset.id} preset={preset} defaultFormat="csv" />
        ))}
      </div>
    </div>
  );
}
