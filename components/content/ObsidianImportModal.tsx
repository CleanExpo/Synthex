'use client';

/**
 * ObsidianImportModal
 *
 * 3-step modal for importing Obsidian notes into Synthex drafts.
 *
 * Step 1 — Source selection (Paste / Upload / Vault)
 * Step 2 — Preview + editable fields before importing
 * Step 3 — Success confirmation
 *
 * UNI-1633
 */

import { useState, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, CheckCircle, Upload, FileText } from '@/components/icons';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

interface ObsidianParseResult {
  title: string;
  content: string;
  platform: string;
  tone?: string;
  topic?: string;
  hashtags: string[];
  frontMatter: Record<string, unknown>;
}

export interface ObsidianImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new draft ID after a successful import */
  onImported?: (draftId: string) => void;
}

// =============================================================================
// Constants
// =============================================================================

type SourceTab = 'paste' | 'upload' | 'vault';

const PLATFORM_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'threads', label: 'Threads' },
  { value: 'pinterest', label: 'Pinterest' },
];

// =============================================================================
// Component
// =============================================================================

export function ObsidianImportModal({
  open,
  onOpenChange,
  onImported,
}: ObsidianImportModalProps) {
  // ---- Step tracking ----
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // ---- Step 1 state ----
  const [activeTab, setActiveTab] = useState<SourceTab>('paste');
  const [pasteContent, setPasteContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [vaultPath, setVaultPath] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- Step 2 state ----
  const [parseResult, setParseResult] = useState<ObsidianParseResult | null>(
    null
  );
  const [editTitle, setEditTitle] = useState('');
  const [editPlatform, setEditPlatform] = useState('general');
  const [editTone, setEditTone] = useState('');
  const [editHashtags, setEditHashtags] = useState('');
  const [editTopic, setEditTopic] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');

  // ---- Step 3 state ----
  const [createdDraftId, setCreatedDraftId] = useState('');

  const vaultEnabled = process.env.NEXT_PUBLIC_OBSIDIAN_ENABLED === 'true';

  // ---- Helpers ----

  const resetAll = useCallback(() => {
    setStep(1);
    setActiveTab('paste');
    setPasteContent('');
    setSelectedFile(null);
    setVaultPath('');
    setPreviewLoading(false);
    setPreviewError('');
    setParseResult(null);
    setEditTitle('');
    setEditPlatform('general');
    setEditTone('');
    setEditHashtags('');
    setEditTopic('');
    setImportLoading(false);
    setImportError('');
    setCreatedDraftId('');
  }, []);

  function handleOpenChange(value: boolean) {
    if (!value) resetAll();
    onOpenChange(value);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setPreviewError('');
  }

  // ---- Step 1 → preview ----

  async function handlePreview() {
    setPreviewError('');

    // Validate before sending
    if (activeTab === 'paste' && !pasteContent.trim()) {
      setPreviewError('Please paste some markdown content first.');
      return;
    }
    if (activeTab === 'upload') {
      if (!selectedFile) {
        setPreviewError('Please select a file to upload.');
        return;
      }
      if (!selectedFile.name.match(/\.(md|markdown|txt)$/i)) {
        setPreviewError('Only .md, .markdown, and .txt files are accepted.');
        return;
      }
      if (selectedFile.size > 512 * 1024) {
        setPreviewError('File is too large (maximum 512 KB).');
        setPreviewLoading(false);
        return;
      }
    }
    if (activeTab === 'vault' && !vaultPath.trim()) {
      setPreviewError('Please enter the vault note path.');
      return;
    }

    setPreviewLoading(true);

    try {
      let res: Response;

      if (activeTab === 'upload' && selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        res = await fetch('/api/content/import-obsidian', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });
      } else if (activeTab === 'vault') {
        res = await fetch('/api/content/import-obsidian', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notePath: vaultPath }),
          credentials: 'include',
        });
      } else {
        res = await fetch('/api/content/import-obsidian', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ markdown: pasteContent }),
          credentials: 'include',
        });
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setPreviewError(
          (body as { error?: string }).error ??
            `Preview failed (${res.status}).`
        );
        return;
      }

      const result = (await res.json()) as ObsidianParseResult;
      setParseResult(result);

      // Pre-populate editable fields
      setEditTitle(result.title);
      setEditPlatform(result.platform || 'general');
      setEditTone(result.tone ?? '');
      setEditHashtags(result.hashtags.join(', '));
      setEditTopic(result.topic ?? '');

      setStep(2);
    } catch {
      setPreviewError('Network error — please try again.');
    } finally {
      setPreviewLoading(false);
    }
  }

  // ---- Step 2 → import ----

  async function handleImport() {
    if (!parseResult) return;
    setImportError('');
    setImportLoading(true);

    // Re-split hashtags from the editable string
    const hashtagsArray = editHashtags
      .split(',')
      .map(h => h.trim())
      .filter(Boolean);

    try {
      const res = await fetch('/api/content/import-obsidian/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          content: parseResult.content,
          platform: editPlatform,
          tone: editTone || undefined,
          topic: editTopic.trim() || undefined,
          hashtags: hashtagsArray,
          frontMatter: parseResult.frontMatter,
        }),
        credentials: 'include',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setImportError(
          (body as { error?: string }).error ?? `Import failed (${res.status}).`
        );
        return;
      }

      const data = (await res.json()) as { draftId: string };
      setCreatedDraftId(data.draftId);
      if (onImported) onImported(data.draftId);
      setStep(3);
    } catch {
      setImportError('Network error — please try again.');
    } finally {
      setImportLoading(false);
    }
  }

  // =============================================================================
  // Render helpers
  // =============================================================================

  const tabConfig: Array<{ id: SourceTab; label: string }> = [
    { id: 'paste', label: 'Paste' },
    { id: 'upload', label: 'Upload' },
    ...(vaultEnabled ? [{ id: 'vault' as SourceTab, label: 'Vault' }] : []),
  ];

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-gray-900 border border-white/10 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <FileText className="w-5 h-5 text-cyan-400" />
            Import from Obsidian
          </DialogTitle>
        </DialogHeader>

        {/* ------------------------------------------------------------------ */}
        {/* STEP 1 — Source selection                                           */}
        {/* ------------------------------------------------------------------ */}

        {step === 1 && (
          <div className="space-y-4 pt-2">
            {/* Step indicator */}
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">
              Step 1 of 3 — Choose source
            </p>

            {/* Manual tabs */}
            <div className="flex gap-1 p-1 bg-white/5 rounded-xl border border-white/10 w-fit">
              {tabConfig.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setPreviewError('');
                  }}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    activeTab === tab.id
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Paste */}
            {activeTab === 'paste' && (
              <div className="space-y-2">
                <Label className="text-gray-300">Markdown content</Label>
                <Textarea
                  value={pasteContent}
                  onChange={e => setPasteContent(e.target.value)}
                  placeholder="Paste your Obsidian note markdown here…"
                  className="min-h-[220px] bg-gray-800 border-white/10 text-white placeholder:text-white/30 font-mono text-sm resize-y"
                />
              </div>
            )}

            {/* Upload */}
            {activeTab === 'upload' && (
              <div className="space-y-2">
                <Label className="text-gray-300">Select file</Label>
                <div
                  className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-white/10 bg-gray-800/50 p-8 cursor-pointer hover:border-cyan-500/40 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-8 h-8 text-gray-500" />
                  {selectedFile ? (
                    <p className="text-sm text-cyan-400">{selectedFile.name}</p>
                  ) : (
                    <p className="text-sm text-gray-500">
                      Click to select a .md, .markdown, or .txt file
                    </p>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".md,.markdown,.txt"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            )}

            {/* Vault */}
            {activeTab === 'vault' && (
              <div className="space-y-2">
                <Label className="text-gray-300">Vault note path</Label>
                <Input
                  value={vaultPath}
                  onChange={e => setVaultPath(e.target.value)}
                  placeholder="e.g. Marketing/campaign-brief.md"
                  className="bg-gray-800 border-white/10 text-white placeholder:text-white/30"
                />
                <p className="text-xs text-gray-500">
                  Relative path from your vault root.
                </p>
              </div>
            )}

            {/* Inline error */}
            {previewError && (
              <p className="text-sm text-red-400">{previewError}</p>
            )}

            <DialogFooter className="pt-2">
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="border-white/10 text-gray-300 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handlePreview}
                disabled={previewLoading}
                className="gradient-primary text-white"
              >
                {previewLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Previewing…
                  </>
                ) : (
                  'Preview'
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STEP 2 — Preview + editable fields                                  */}
        {/* ------------------------------------------------------------------ */}

        {step === 2 && parseResult && (
          <div className="space-y-4 pt-2">
            {/* Step indicator */}
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">
              Step 2 of 3 — Review &amp; edit
            </p>

            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="import-title" className="text-gray-300">
                Title
              </Label>
              <Input
                id="import-title"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="bg-gray-800 border-white/10 text-white"
              />
            </div>

            {/* Platform */}
            <div className="space-y-1.5">
              <Label htmlFor="import-platform" className="text-gray-300">
                Platform
              </Label>
              <Select value={editPlatform} onValueChange={setEditPlatform}>
                <SelectTrigger
                  id="import-platform"
                  className="bg-gray-800 border-white/10 text-white"
                >
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-white/10">
                  {PLATFORM_OPTIONS.map(opt => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      className="text-white hover:bg-white/5"
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tone */}
            <div className="space-y-1.5">
              <Label htmlFor="import-tone" className="text-gray-300">
                Tone{' '}
                <span className="text-gray-500 font-normal">(optional)</span>
              </Label>
              <Input
                id="import-tone"
                value={editTone}
                onChange={e => setEditTone(e.target.value)}
                placeholder="e.g. professional, casual, witty"
                className="bg-gray-800 border-white/10 text-white placeholder:text-white/30"
              />
            </div>

            {/* Topic */}
            <div className="space-y-1">
              <Label htmlFor="topic">Topic (optional)</Label>
              <Input
                id="topic"
                value={editTopic}
                onChange={e => setEditTopic(e.target.value)}
                placeholder="e.g. product launch"
              />
            </div>

            {/* Hashtags */}
            <div className="space-y-1.5">
              <Label htmlFor="import-hashtags" className="text-gray-300">
                Hashtags{' '}
                <span className="text-gray-500 font-normal">
                  (comma-separated)
                </span>
              </Label>
              <Input
                id="import-hashtags"
                value={editHashtags}
                onChange={e => setEditHashtags(e.target.value)}
                placeholder="#product, #launch"
                className="bg-gray-800 border-white/10 text-white placeholder:text-white/30"
              />
            </div>

            {/* Content preview */}
            <div className="space-y-1.5">
              <Label className="text-gray-300">Content preview</Label>
              <div className="rounded-xl border border-white/10 bg-gray-800/50 p-4 max-h-48 overflow-y-auto prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{parseResult.content}</ReactMarkdown>
              </div>
            </div>

            {/* Inline error */}
            {importError && (
              <p className="text-sm text-red-400">{importError}</p>
            )}

            <DialogFooter className="pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setImportError('');
                  setStep(1);
                }}
                className="border-white/10 text-gray-300 hover:text-white"
              >
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={importLoading}
                className="gradient-primary text-white"
              >
                {importLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing…
                  </>
                ) : (
                  'Import as Draft'
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STEP 3 — Success                                                    */}
        {/* ------------------------------------------------------------------ */}

        {step === 3 && (
          <div className="space-y-6 pt-4 pb-2 text-center">
            {/* Step indicator */}
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium text-left">
              Step 3 of 3 — Done
            </p>

            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-green-500/15 border border-green-500/30">
                <CheckCircle className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">
                Draft created successfully!
              </h3>
              {createdDraftId && (
                <p className="text-xs text-gray-500">
                  Draft ID: {createdDraftId}
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button asChild className="gradient-primary text-white">
                <Link href="/dashboard/content/drafts">View Drafts</Link>
              </Button>
              <Button
                variant="outline"
                onClick={resetAll}
                className="border-white/10 text-gray-300 hover:text-white"
              >
                Import Another
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
