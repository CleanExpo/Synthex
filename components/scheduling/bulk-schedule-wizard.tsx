'use client';

/**
 * BulkScheduleWizard
 *
 * Multi-step modal for batch scheduling content. Steps:
 * 1. Add Content (paste / CSV import / use drafts)
 * 2. Platform & Settings (date range, intervals, max per day)
 * 3. Schedule Preview (auto-fill result with ML scores)
 * 4. Confirm (schedule all with progress indicator)
 *
 * @module components/scheduling/bulk-schedule-wizard
 * Linear: SYN-44
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import useSWR from 'swr';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Trash2,
  Upload,
  Download,
  Check,
  AlertTriangle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Clock,
  Calendar,
  RefreshCw,
  FileText,
  Sparkles,
} from '@/components/icons';
import { toast } from 'sonner';
import { fetchWithCSRF } from '@/lib/csrf';
import { autoFillSchedule } from '@/lib/scheduling/auto-fill';
import { parseScheduleCSV, downloadCSVTemplate } from '@/lib/scheduling/csv-parser';
import { useOptimalTimes } from '@/hooks/use-optimal-times';
import { useScheduleConflicts } from '@/hooks/use-schedule-conflicts';
import type {
  ContentItem,
  ScheduleSlot,
  OptimalSlot,
} from '@/lib/scheduling/auto-fill';

// =============================================================================
// Types
// =============================================================================

export interface BulkScheduleWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after wizard completes to refresh parent data */
  onComplete?: () => void;
  /** Pre-fill the wizard with initial content (e.g. from content page) */
  initialContent?: string;
  /** Pre-fill the wizard with initial platform */
  initialPlatform?: string;
}

interface WizardContentItem {
  id: string;
  content: string;
  platform: string;
  hashtags: string[];
  mediaUrls: string[];
  source: 'paste' | 'csv' | 'draft';
  draftId?: string;
}

type WizardStep = 1 | 2 | 3 | 4;

// Draft from API
interface DraftItem {
  id: string;
  content: string;
  platform: string;
  hashtags?: string[];
  title?: string;
}

// =============================================================================
// Constants
// =============================================================================

const SUPPORTED_PLATFORMS = [
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'pinterest', label: 'Pinterest' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'threads', label: 'Threads' },
];

const INTERVAL_OPTIONS = [
  { value: 2, label: '2 hours' },
  { value: 4, label: '4 hours' },
  { value: 6, label: '6 hours' },
  { value: 8, label: '8 hours' },
];

const MAX_PER_DAY_OPTIONS = [
  { value: 3, label: '3 posts' },
  { value: 5, label: '5 posts' },
  { value: 7, label: '7 posts' },
  { value: 10, label: '10 posts' },
];

const STEP_LABELS: Record<WizardStep, string> = {
  1: 'Add Content',
  2: 'Settings',
  3: 'Preview',
  4: 'Confirm',
};

// =============================================================================
// SWR fetcher
// =============================================================================

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

// =============================================================================
// Helpers
// =============================================================================

let idCounter = 0;
function genId(): string {
  return `bulk-${Date.now()}-${++idCounter}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function toInputDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function platformLabel(value: string): string {
  return SUPPORTED_PLATFORMS.find((p) => p.value === value)?.label ?? value;
}

function scoreColour(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-cyan-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-red-400';
}

// =============================================================================
// Component
// =============================================================================

export function BulkScheduleWizard({
  open,
  onOpenChange,
  onComplete,
  initialContent,
  initialPlatform,
}: BulkScheduleWizardProps) {
  // ---------------------------------------------------------------------------
  // Step state
  // ---------------------------------------------------------------------------
  const [step, setStep] = useState<WizardStep>(1);

  // ---------------------------------------------------------------------------
  // Step 1: Content items
  // ---------------------------------------------------------------------------
  const [items, setItems] = useState<WizardContentItem[]>(() => {
    if (initialContent) {
      return [
        {
          id: genId(),
          content: initialContent,
          platform: initialPlatform ?? 'twitter',
          hashtags: [],
          mediaUrls: [],
          source: 'paste',
        },
      ];
    }
    return [];
  });

  const [activeTab, setActiveTab] = useState<'paste' | 'csv' | 'drafts'>('paste');
  const [csvErrors, setCsvErrors] = useState<Array<{ row: number; message: string }>>([]);
  const [csvWarnings, setCsvWarnings] = useState<Array<{ row: number; message: string }>>([]);
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Step 2: Settings
  // ---------------------------------------------------------------------------
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  const [startDate, setStartDate] = useState(toInputDate(today));
  const [endDate, setEndDate] = useState(toInputDate(nextWeek));
  const [minInterval, setMinInterval] = useState(4);
  const [maxPerDay, setMaxPerDay] = useState(5);
  const [defaultPlatform, setDefaultPlatform] = useState('twitter');

  // ---------------------------------------------------------------------------
  // Step 3: Preview (auto-fill result)
  // ---------------------------------------------------------------------------
  const [scheduleResult, setScheduleResult] = useState<ScheduleSlot[]>([]);

  // ---------------------------------------------------------------------------
  // Step 4: Confirm progress
  // ---------------------------------------------------------------------------
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleProgress, setScheduleProgress] = useState(0);
  const [scheduleDone, setScheduleDone] = useState(false);

  // ---------------------------------------------------------------------------
  // Hooks for ML data
  // ---------------------------------------------------------------------------
  const uniquePlatforms = useMemo(
    () => [...new Set(items.map((i) => i.platform))],
    [items]
  );

  const { slots: optimalSlots, isLoading: slotsLoading } = useOptimalTimes({
    platforms: uniquePlatforms.length > 0 ? uniquePlatforms : ['twitter'],
    enabled: step >= 2 && open,
  });

  const scheduleStart = useMemo(() => new Date(startDate + 'T00:00:00'), [startDate]);
  const scheduleEnd = useMemo(() => new Date(endDate + 'T23:59:59'), [endDate]);

  const { existingPosts, isLoading: conflictsLoading } = useScheduleConflicts({
    startDate: scheduleStart,
    endDate: scheduleEnd,
    enabled: step >= 2 && open,
  });

  // ---------------------------------------------------------------------------
  // Drafts SWR
  // ---------------------------------------------------------------------------
  const { data: draftsData, isLoading: draftsLoading } = useSWR(
    activeTab === 'drafts' && open ? '/api/content-drafts?status=draft&limit=50' : null,
    fetchJson,
    { revalidateOnFocus: false }
  );

  const drafts: DraftItem[] = useMemo(() => {
    if (!draftsData?.drafts) return [];
    return draftsData.drafts.map((d: Record<string, unknown>) => ({
      id: String(d.id),
      content: String(d.content ?? ''),
      platform: String(d.platform ?? 'twitter'),
      hashtags: (d.hashtags as string[]) ?? [],
      title: d.title ? String(d.title) : undefined,
    }));
  }, [draftsData]);

  // ---------------------------------------------------------------------------
  // Step 1 handlers
  // ---------------------------------------------------------------------------

  const addEmptyItem = useCallback(() => {
    setItems((prev) => [
      ...prev,
      {
        id: genId(),
        content: '',
        platform: defaultPlatform,
        hashtags: [],
        mediaUrls: [],
        source: 'paste',
      },
    ]);
  }, [defaultPlatform]);

  const updateItem = useCallback(
    (id: string, updates: Partial<WizardContentItem>) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
      );
    },
    []
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleCSVUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const result = parseScheduleCSV(text);
      setCsvErrors(result.errors);
      setCsvWarnings(result.warnings);

      if (result.items.length > 0) {
        const newItems: WizardContentItem[] = result.items.map((row) => ({
          id: genId(),
          content: row.content,
          platform: row.platform,
          hashtags: row.hashtags ?? [],
          mediaUrls: [],
          source: 'csv' as const,
        }));

        setItems((prev) => [...prev, ...newItems]);
        toast.success(`Imported ${newItems.length} items from CSV`);
      }

      if (result.errors.length > 0) {
        toast.error(`${result.errors.length} rows had errors and were skipped`);
      }
    };
    reader.readAsText(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleAddDrafts = useCallback(() => {
    const selected = drafts.filter((d) => selectedDraftIds.has(d.id));
    if (selected.length === 0) {
      toast.error('Select at least one draft');
      return;
    }

    const newItems: WizardContentItem[] = selected.map((d) => ({
      id: genId(),
      content: d.content,
      platform: d.platform,
      hashtags: d.hashtags ?? [],
      mediaUrls: [],
      source: 'draft' as const,
      draftId: d.id,
    }));

    setItems((prev) => [...prev, ...newItems]);
    setSelectedDraftIds(new Set());
    toast.success(`Added ${selected.length} drafts`);
  }, [drafts, selectedDraftIds]);

  const toggleDraft = useCallback((draftId: string) => {
    setSelectedDraftIds((prev) => {
      const next = new Set(prev);
      if (next.has(draftId)) {
        next.delete(draftId);
      } else {
        next.add(draftId);
      }
      return next;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Step 3: Run auto-fill
  // ---------------------------------------------------------------------------

  const runAutoFill = useCallback(() => {
    const contentItems: ContentItem[] = items.map((i) => ({
      content: i.content,
      platform: i.platform,
      hashtags: i.hashtags,
      mediaUrls: i.mediaUrls,
    }));

    const mappedOptimalSlots: OptimalSlot[] = optimalSlots.map((s) => ({
      day: s.day,
      hour: s.hour,
      score: s.score,
      platform: s.platform,
    }));

    const mappedExisting = existingPosts.map((p) => ({
      platform: p.platform,
      scheduledAt: p.scheduledAt,
    }));

    const timezone =
      typeof window !== 'undefined'
        ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
        : 'UTC';

    const result = autoFillSchedule(contentItems, mappedOptimalSlots, mappedExisting, {
      startDate: scheduleStart,
      endDate: scheduleEnd,
      minIntervalHours: minInterval,
      timezone,
      maxPostsPerDay: maxPerDay,
    });

    setScheduleResult(result);

    if (result.length < items.length) {
      toast.warning(
        `Only ${result.length} of ${items.length} items could be scheduled in the selected range. Try expanding the date range or reducing the minimum interval.`
      );
    }
  }, [items, optimalSlots, existingPosts, scheduleStart, scheduleEnd, minInterval, maxPerDay]);

  // ---------------------------------------------------------------------------
  // Step 4: Schedule all
  // ---------------------------------------------------------------------------

  const handleScheduleAll = useCallback(async () => {
    if (scheduleResult.length === 0) return;

    setIsScheduling(true);
    setScheduleProgress(0);
    setScheduleDone(false);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < scheduleResult.length; i++) {
      const slot = scheduleResult[i];
      try {
        const res = await fetchWithCSRF('/api/scheduler/posts', {
          method: 'POST',
          body: JSON.stringify({
            content: slot.contentItem.content,
            platform: slot.contentItem.platform,
            scheduledAt: slot.scheduledAt.toISOString(),
            metadata: {
              hashtags: slot.contentItem.hashtags ?? [],
              bulkScheduled: true,
              mlScore: slot.score,
              ...(slot.contentItem.mediaUrls?.length
                ? { images: slot.contentItem.mediaUrls }
                : {}),
            },
          }),
        });

        if (res.ok) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch {
        errorCount++;
      }

      setScheduleProgress(i + 1);
    }

    setIsScheduling(false);
    setScheduleDone(true);

    if (errorCount === 0) {
      toast.success(`Successfully scheduled ${successCount} posts!`);
    } else {
      toast.warning(
        `Scheduled ${successCount} posts. ${errorCount} failed.`
      );
    }

    onComplete?.();
  }, [scheduleResult, onComplete]);

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  const canProceed = useMemo(() => {
    switch (step) {
      case 1:
        return items.length > 0 && items.every((i) => i.content.trim().length > 0);
      case 2:
        return startDate && endDate && new Date(startDate) <= new Date(endDate);
      case 3:
        return scheduleResult.length > 0;
      case 4:
        return scheduleDone;
      default:
        return false;
    }
  }, [step, items, startDate, endDate, scheduleResult, scheduleDone]);

  const goNext = useCallback(() => {
    if (step === 2) {
      // Auto-run auto-fill when entering step 3
      setStep(3);
      // Schedule auto-fill for next tick so state updates first
      setTimeout(() => runAutoFill(), 0);
      return;
    }
    if (step < 4) {
      setStep((s) => (s + 1) as WizardStep);
    }
  }, [step, runAutoFill]);

  const goBack = useCallback(() => {
    if (step > 1) {
      setStep((s) => (s - 1) as WizardStep);
    }
  }, [step]);

  const handleClose = useCallback(() => {
    // Reset state on close
    if (scheduleDone) {
      setStep(1);
      setItems([]);
      setScheduleResult([]);
      setScheduleProgress(0);
      setScheduleDone(false);
      setCsvErrors([]);
      setCsvWarnings([]);
    }
    onOpenChange(false);
  }, [scheduleDone, onOpenChange]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const validItemCount = items.filter((i) => i.content.trim().length > 0).length;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        variant="glass-solid"
        className="max-w-4xl max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Bulk Schedule</DialogTitle>
          <DialogDescription>
            Schedule multiple posts at once with ML-optimised time slots
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-4">
          {([1, 2, 3, 4] as WizardStep[]).map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={`
                  flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium
                  ${step === s ? 'bg-cyan-500 text-white' : ''}
                  ${step > s ? 'bg-green-500/20 text-green-400 border border-green-500/30' : ''}
                  ${step < s ? 'bg-white/5 text-white/40 border border-white/10' : ''}
                `}
              >
                {step > s ? <Check className="h-3.5 w-3.5" /> : s}
              </div>
              <span
                className={`text-xs hidden sm:inline ${
                  step === s ? 'text-white' : 'text-white/40'
                }`}
              >
                {STEP_LABELS[s]}
              </span>
              {s < 4 && (
                <div
                  className={`flex-1 h-px ${
                    step > s ? 'bg-green-500/30' : 'bg-white/10'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* ================================================================= */}
        {/* Step 1: Add Content */}
        {/* ================================================================= */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Tab selector */}
            <div className="flex gap-2 border-b border-white/10 pb-2">
              {(
                [
                  { key: 'paste', label: 'Paste', icon: FileText },
                  { key: 'csv', label: 'Import CSV', icon: Upload },
                  { key: 'drafts', label: 'Use Drafts', icon: Sparkles },
                ] as const
              ).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    activeTab === key
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Paste tab */}
            {activeTab === 'paste' && (
              <div className="space-y-3">
                {items
                  .filter((i) => i.source === 'paste')
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-3 bg-white/5 rounded-lg p-3 border border-white/10"
                    >
                      <div className="flex-1 space-y-2">
                        <textarea
                          value={item.content}
                          onChange={(e) =>
                            updateItem(item.id, { content: e.target.value })
                          }
                          placeholder="Enter your post content..."
                          className="w-full bg-transparent border border-white/10 rounded-lg p-2 text-sm text-white placeholder-white/30 resize-none focus:ring-1 focus:ring-cyan-500/30 focus:outline-none"
                          rows={3}
                        />
                        <select
                          value={item.platform}
                          onChange={(e) =>
                            updateItem(item.id, { platform: e.target.value })
                          }
                          className="bg-[#0f172a] border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:ring-1 focus:ring-cyan-500/30 focus:outline-none"
                        >
                          {SUPPORTED_PLATFORMS.map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-white/30 hover:text-red-400 p-1 self-start"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}

                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white/5 border-white/10 text-white hover:bg-white/10"
                  onClick={addEmptyItem}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Item
                </Button>
              </div>
            )}

            {/* CSV tab */}
            {activeTab === 'csv' && (
              <div className="space-y-3">
                <div className="border-2 border-dashed border-white/10 rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 text-white/30 mx-auto mb-2" />
                  <p className="text-sm text-white/60 mb-2">
                    Upload a CSV file with columns: content, platform, scheduledAt
                    (optional), hashtags (optional)
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-white/5 border-white/10 text-white hover:bg-white/10"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-3.5 w-3.5 mr-1" />
                      Choose File
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-white/5 border-white/10 text-white hover:bg-white/10"
                      onClick={downloadCSVTemplate}
                    >
                      <Download className="h-3.5 w-3.5 mr-1" />
                      Download Template
                    </Button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleCSVUpload}
                    className="hidden"
                  />
                </div>

                {/* CSV errors */}
                {csvErrors.length > 0 && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 space-y-1">
                    <p className="text-xs font-medium text-red-400 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {csvErrors.length} error(s)
                    </p>
                    {csvErrors.slice(0, 5).map((err, i) => (
                      <p key={i} className="text-xs text-red-300">
                        Row {err.row}: {err.message}
                      </p>
                    ))}
                    {csvErrors.length > 5 && (
                      <p className="text-xs text-red-300/60">
                        ...and {csvErrors.length - 5} more
                      </p>
                    )}
                  </div>
                )}

                {/* CSV warnings */}
                {csvWarnings.length > 0 && (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 space-y-1">
                    <p className="text-xs font-medium text-yellow-400 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {csvWarnings.length} warning(s)
                    </p>
                    {csvWarnings.slice(0, 3).map((w, i) => (
                      <p key={i} className="text-xs text-yellow-300">
                        Row {w.row}: {w.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Drafts tab */}
            {activeTab === 'drafts' && (
              <div className="space-y-3">
                {draftsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
                    <span className="ml-2 text-sm text-white/60">
                      Loading drafts...
                    </span>
                  </div>
                ) : drafts.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-8 w-8 text-white/20 mx-auto mb-2" />
                    <p className="text-sm text-white/40">No drafts available</p>
                    <p className="text-xs text-white/30 mt-1">
                      Create drafts from the Content page first
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {drafts.map((draft) => {
                        const alreadyAdded = items.some(
                          (i) => i.draftId === draft.id
                        );
                        return (
                          <label
                            key={draft.id}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                              selectedDraftIds.has(draft.id)
                                ? 'bg-cyan-500/10 border-cyan-500/30'
                                : 'bg-white/5 border-white/10 hover:bg-white/10'
                            } ${alreadyAdded ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedDraftIds.has(draft.id)}
                              onChange={() => !alreadyAdded && toggleDraft(draft.id)}
                              disabled={alreadyAdded}
                              className="mt-1 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/30"
                            />
                            <div className="flex-1 min-w-0">
                              {draft.title && (
                                <p className="text-xs font-medium text-white/80 mb-0.5">
                                  {draft.title}
                                </p>
                              )}
                              <p className="text-xs text-white/60 line-clamp-2">
                                {draft.content}
                              </p>
                              <span className="text-[10px] text-cyan-400 mt-1 inline-block">
                                {platformLabel(draft.platform)}
                              </span>
                              {alreadyAdded && (
                                <span className="text-[10px] text-green-400 ml-2">
                                  Already added
                                </span>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-white/5 border-white/10 text-white hover:bg-white/10"
                      onClick={handleAddDrafts}
                      disabled={selectedDraftIds.size === 0}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add {selectedDraftIds.size} Draft
                      {selectedDraftIds.size !== 1 ? 's' : ''}
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* All items preview (from any source) */}
            {items.length > 0 && (
              <div className="border-t border-white/10 pt-3">
                <p className="text-sm text-white/80 mb-2">
                  <span className="font-medium text-cyan-400">
                    {validItemCount}
                  </span>{' '}
                  item{validItemCount !== 1 ? 's' : ''} ready
                </p>
                {items.filter((i) => i.source !== 'paste').length > 0 && (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {items
                      .filter((i) => i.source !== 'paste')
                      .map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 text-xs bg-white/5 rounded px-2 py-1"
                        >
                          <span className="text-white/60 truncate flex-1">
                            {item.content.slice(0, 60)}
                            {item.content.length > 60 ? '...' : ''}
                          </span>
                          <span className="text-cyan-400 text-[10px]">
                            {platformLabel(item.platform)}
                          </span>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-white/30 hover:text-red-400"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* Step 2: Platform & Settings */}
        {/* ================================================================= */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Default platform for items without one */}
            <div>
              <label className="text-xs text-white/60 mb-1 block">
                Default Platform (for items without a platform)
              </label>
              <select
                value={defaultPlatform}
                onChange={(e) => {
                  setDefaultPlatform(e.target.value);
                  // Update items that don't have a platform
                  setItems((prev) =>
                    prev.map((item) =>
                      !item.platform
                        ? { ...item, platform: e.target.value }
                        : item
                    )
                  );
                }}
                className="bg-[#0f172a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white w-full focus:ring-1 focus:ring-cyan-500/30 focus:outline-none"
              >
                {SUPPORTED_PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/60 mb-1 block">
                  <Calendar className="h-3 w-3 inline mr-1" />
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-[#0f172a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white w-full focus:ring-1 focus:ring-cyan-500/30 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-white/60 mb-1 block">
                  <Calendar className="h-3 w-3 inline mr-1" />
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-[#0f172a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white w-full focus:ring-1 focus:ring-cyan-500/30 focus:outline-none"
                />
              </div>
            </div>

            {/* Interval & max per day */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/60 mb-1 block">
                  <Clock className="h-3 w-3 inline mr-1" />
                  Min Interval Between Posts
                </label>
                <select
                  value={minInterval}
                  onChange={(e) => setMinInterval(Number(e.target.value))}
                  className="bg-[#0f172a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white w-full focus:ring-1 focus:ring-cyan-500/30 focus:outline-none"
                >
                  {INTERVAL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/60 mb-1 block">
                  Max Posts Per Day
                </label>
                <select
                  value={maxPerDay}
                  onChange={(e) => setMaxPerDay(Number(e.target.value))}
                  className="bg-[#0f172a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white w-full focus:ring-1 focus:ring-cyan-500/30 focus:outline-none"
                >
                  {MAX_PER_DAY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Platform summary */}
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <p className="text-xs text-white/60 mb-2">Content Summary</p>
              <div className="flex flex-wrap gap-2">
                {uniquePlatforms.map((platform) => {
                  const count = items.filter(
                    (i) => i.platform === platform
                  ).length;
                  return (
                    <span
                      key={platform}
                      className="text-xs bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded-full border border-cyan-500/20"
                    >
                      {platformLabel(platform)} ({count})
                    </span>
                  );
                })}
              </div>
              <p className="text-xs text-white/40 mt-2">
                {items.length} items across{' '}
                {uniquePlatforms.length} platform
                {uniquePlatforms.length !== 1 ? 's' : ''}
              </p>
            </div>

            {(slotsLoading || conflictsLoading) && (
              <div className="flex items-center gap-2 text-xs text-white/40">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading optimal time data...
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* Step 3: Schedule Preview */}
        {/* ================================================================= */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/80">
                {scheduleResult.length} of {items.length} items scheduled
              </p>
              <Button
                variant="outline"
                size="sm"
                className="bg-white/5 border-white/10 text-white hover:bg-white/10"
                onClick={runAutoFill}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Regenerate
              </Button>
            </div>

            {scheduleResult.length === 0 ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-cyan-400 mx-auto mb-2" />
                <p className="text-sm text-white/40">
                  Generating optimal schedule...
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {scheduleResult.map((slot, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      slot.conflict
                        ? 'bg-yellow-500/5 border-yellow-500/20'
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/80 line-clamp-2">
                        {slot.contentItem.content}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-500/20">
                          {platformLabel(slot.contentItem.platform)}
                        </span>
                        <span className="text-[10px] text-white/40 flex items-center gap-1">
                          <Calendar className="h-2.5 w-2.5" />
                          {formatDate(slot.scheduledAt)}
                        </span>
                        <span
                          className={`text-[10px] font-medium ${scoreColour(
                            slot.score
                          )}`}
                        >
                          Score: {slot.score}
                        </span>
                        {slot.conflict && (
                          <span className="text-[10px] text-yellow-400 flex items-center gap-0.5">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            Fallback slot
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {scheduleResult.length > 0 &&
              scheduleResult.length < items.length && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                  <p className="text-xs text-yellow-400 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {items.length - scheduleResult.length} item(s) could not be
                    scheduled. Try expanding the date range or adjusting
                    settings.
                  </p>
                </div>
              )}
          </div>
        )}

        {/* ================================================================= */}
        {/* Step 4: Confirm */}
        {/* ================================================================= */}
        {step === 4 && (
          <div className="space-y-4">
            {!isScheduling && !scheduleDone && (
              <>
                <div className="bg-white/5 rounded-lg p-4 border border-white/10 text-center space-y-2">
                  <p className="text-lg font-semibold text-white">
                    Schedule {scheduleResult.length} Post
                    {scheduleResult.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-white/60">
                    Across {uniquePlatforms.length} platform
                    {uniquePlatforms.length !== 1 ? 's' : ''} from{' '}
                    {new Date(startDate).toLocaleDateString('en-AU')} to{' '}
                    {new Date(endDate).toLocaleDateString('en-AU')}
                  </p>
                </div>
                <Button
                  className="w-full gradient-primary text-white"
                  onClick={handleScheduleAll}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Schedule All
                </Button>
              </>
            )}

            {isScheduling && (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
                  <p className="text-sm text-white">
                    Creating {scheduleProgress}/{scheduleResult.length}...
                  </p>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div
                    className="bg-cyan-500 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${(scheduleProgress / scheduleResult.length) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {scheduleDone && (
              <div className="text-center space-y-3">
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                  <Check className="h-6 w-6 text-green-400" />
                </div>
                <p className="text-lg font-semibold text-white">All Done!</p>
                <p className="text-sm text-white/60">
                  {scheduleResult.length} posts have been scheduled
                </p>
                <Button
                  className="gradient-primary text-white"
                  onClick={handleClose}
                >
                  Close
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* Footer navigation */}
        {/* ================================================================= */}
        {!scheduleDone && (
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <Button
              variant="outline"
              size="sm"
              className="bg-white/5 border-white/10 text-white hover:bg-white/10"
              onClick={step === 1 ? handleClose : goBack}
              disabled={isScheduling}
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              {step === 1 ? 'Cancel' : 'Back'}
            </Button>

            {step < 4 && (
              <Button
                size="sm"
                className="gradient-primary text-white"
                onClick={goNext}
                disabled={!canProceed || isScheduling}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
