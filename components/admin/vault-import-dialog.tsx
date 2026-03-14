'use client';

/**
 * Vault Import Dialog
 *
 * Two-stage dialog for importing credentials from a .docx file:
 *   Stage 1: File upload dropzone
 *   Stage 2: Editable review table with confidence indicators
 *
 * Passwords are masked by default with per-row reveal toggles.
 * Low-confidence rows are highlighted in amber.
 * User edits, deletes, or adds rows before confirming import to Vault.
 */

import { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { FileText, Upload, Eye, EyeOff, Trash2, Plus, CheckCircle, AlertTriangle, Loader2, Shield } from '@/components/icons';

// =============================================================================
// Types
// =============================================================================

type CredentialCategory =
  | 'social_media'
  | 'email'
  | 'hosting'
  | 'domain'
  | 'banking'
  | 'ecommerce'
  | 'crm'
  | 'analytics'
  | 'api_key'
  | 'vpn'
  | 'other';

interface ImportedCredential {
  id: string;
  service: string;
  url: string | null;
  username: string | null;
  password: string;
  category: CredentialCategory;
  confidence: 'high' | 'medium' | 'low';
  rawLine?: string;
}

interface ImportResult {
  created: number;
  skipped: number;
  errors: string[];
}

// =============================================================================
// Constants
// =============================================================================

const CATEGORY_LABELS: Record<CredentialCategory, string> = {
  social_media: 'Social Media',
  email: 'Email',
  hosting: 'Hosting / Server',
  domain: 'Domain / DNS',
  banking: 'Banking / Finance',
  ecommerce: 'eCommerce',
  crm: 'CRM',
  analytics: 'Analytics',
  api_key: 'API Key',
  vpn: 'VPN',
  other: 'Other',
};

const CATEGORIES = Object.entries(CATEGORY_LABELS) as [CredentialCategory, string][];

// =============================================================================
// Sub-components
// =============================================================================

function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  if (confidence === 'high') {
    return (
      <Badge variant="outline" className="border-emerald-500 text-emerald-500 text-xs shrink-0">
        High
      </Badge>
    );
  }
  if (confidence === 'medium') {
    return (
      <Badge variant="outline" className="border-blue-500 text-blue-500 text-xs shrink-0">
        Medium
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-amber-500 text-amber-500 text-xs shrink-0">
      Low ⚠
    </Badge>
  );
}

// =============================================================================
// VaultImportDialog
// =============================================================================

interface VaultImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  onImported: () => void;
}

export function VaultImportDialog({
  open,
  onOpenChange,
  organizationId,
  onImported,
}: VaultImportDialogProps) {
  const [stage, setStage] = useState<'upload' | 'review' | 'done'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [entries, setEntries] = useState<ImportedCredential[]>([]);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Reset on close
  // ---------------------------------------------------------------------------

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setTimeout(() => {
          setStage('upload');
          setEntries([]);
          setRevealedIds(new Set());
          setImportResult(null);
          setIsParsing(false);
          setIsImporting(false);
        }, 300);
      }
      onOpenChange(next);
    },
    [onOpenChange]
  );

  // ---------------------------------------------------------------------------
  // File Upload & Parse
  // ---------------------------------------------------------------------------

  async function uploadFile(file: File) {
    if (!file.name.endsWith('.docx')) {
      toast.error('Only .docx files are supported');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum 10MB.');
      return;
    }

    setIsParsing(true);
    try {
      const form = new FormData();
      form.append('file', file);

      const res = await fetch('/api/admin/vault/import-doc', {
        method: 'POST',
        credentials: 'include',
        body: form,
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? 'Failed to parse document');
        if (data.hint) {
          toast.info(data.hint);
        }
        return;
      }

      setEntries(data.entries ?? []);
      setStage('review');
      toast.success(`Found ${data.extractedCount} credential${data.extractedCount !== 1 ? 's' : ''}`);
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setIsParsing(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Drag & Drop Handlers
  // ---------------------------------------------------------------------------

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ---------------------------------------------------------------------------
  // Row Editing
  // ---------------------------------------------------------------------------

  function updateEntry(id: string, field: keyof ImportedCredential, value: string | null) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
  }

  function deleteEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function addBlankRow() {
    const newEntry: ImportedCredential = {
      id: globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
      service: '',
      url: null,
      username: null,
      password: '',
      category: 'other',
      confidence: 'medium',
    };
    setEntries((prev) => [...prev, newEntry]);
  }

  function toggleReveal(id: string) {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // Import Confirmation
  // ---------------------------------------------------------------------------

  async function confirmImport() {
    const validEntries = entries.filter((e) => e.service.trim() && e.password.trim());
    if (validEntries.length === 0) {
      toast.error('No valid entries to import');
      return;
    }

    setIsImporting(true);
    try {
      const res = await fetch('/api/admin/vault/import-doc/confirm', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, entries: validEntries }),
      });

      const result: ImportResult = await res.json();

      if (!res.ok) {
        toast.error('Import failed');
        return;
      }

      setImportResult(result);
      setStage('done');
      onImported();

      if (result.created > 0) {
        toast.success(`${result.created} credential${result.created !== 1 ? 's' : ''} imported to Vault`);
      }
    } catch {
      toast.error('Import failed. Please try again.');
    } finally {
      setIsImporting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={`
          bg-[#0f1117] border border-white/10 text-white
          ${stage === 'review' ? 'max-w-5xl max-h-[90vh]' : 'max-w-lg'}
        `}
      >
        {/* ── Stage: Upload ─────────────────────────────────────────────── */}
        {stage === 'upload' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-white">
                <FileText className="w-5 h-5 text-cyan-400" />
                Import Credentials from Document
              </DialogTitle>
              <DialogDescription className="text-zinc-400">
                Upload a Word document (.docx) containing usernames and passwords. The system
                will extract and categorise credentials for your review before saving anything.
              </DialogDescription>
            </DialogHeader>

            {/* Dropzone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`
                mt-2 border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3
                cursor-pointer transition-colors
                ${isDragging
                  ? 'border-cyan-400 bg-cyan-400/10'
                  : 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10'}
              `}
            >
              {isParsing ? (
                <>
                  <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
                  <p className="text-zinc-300 text-sm">Reading document...</p>
                </>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-zinc-500" />
                  <p className="text-white font-medium">Drop your .docx file here</p>
                  <p className="text-zinc-500 text-sm">or click to browse</p>
                  <Badge variant="outline" className="border-white/20 text-zinc-400 text-xs mt-1">
                    .docx only — max 10MB
                  </Badge>
                </>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadFile(file);
              }}
            />

            {/* Security note */}
            <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 mt-1">
              <Shield className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <p className="text-emerald-300 text-xs leading-relaxed">
                Your document is processed server-side and never stored. After review and import,
                all credentials are encrypted with AES-256-GCM. Passwords never appear in logs.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)} className="border-white/20 text-zinc-300 hover:bg-white/10">
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── Stage: Review ─────────────────────────────────────────────── */}
        {stage === 'review' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-white">
                <CheckCircle className="w-5 h-5 text-cyan-400" />
                Review Extracted Credentials
                <Badge className="ml-2 bg-cyan-500/20 text-cyan-300 border-cyan-500/30">
                  {entries.length} found
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-zinc-400">
                Review and edit the credentials below. Low-confidence rows are highlighted — check
                them before importing. Nothing is saved until you click Import.
              </DialogDescription>
            </DialogHeader>

            {/* Scrollable table */}
            <div className="overflow-y-auto max-h-[55vh] mt-2 rounded-lg border border-white/10">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#0f1117] border-b border-white/10">
                  <tr className="text-zinc-400 text-xs uppercase tracking-wide">
                    <th className="text-left px-3 py-2 w-[22%]">Service</th>
                    <th className="text-left px-3 py-2 w-[22%]">Username / Email</th>
                    <th className="text-left px-3 py-2 w-[22%]">Password</th>
                    <th className="text-left px-3 py-2 w-[18%]">Category</th>
                    <th className="text-left px-3 py-2 w-[10%]">Confidence</th>
                    <th className="px-3 py-2 w-[6%]" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {entries.map((entry) => {
                    const isLow = entry.confidence === 'low';
                    return (
                      <tr
                        key={entry.id}
                        className={`transition-colors ${isLow ? 'bg-amber-500/5' : 'hover:bg-white/5'}`}
                      >
                        {/* Service */}
                        <td className="px-3 py-2">
                          <Input
                            value={entry.service}
                            onChange={(e) => updateEntry(entry.id, 'service', e.target.value)}
                            placeholder="Service name"
                            className="bg-white/5 border-white/10 text-white placeholder-zinc-600 text-xs h-8"
                          />
                        </td>
                        {/* Username */}
                        <td className="px-3 py-2">
                          <Input
                            value={entry.username ?? ''}
                            onChange={(e) => updateEntry(entry.id, 'username', e.target.value || null)}
                            placeholder="username@email.com"
                            autoComplete="off"
                            className="bg-white/5 border-white/10 text-white placeholder-zinc-600 text-xs h-8"
                          />
                        </td>
                        {/* Password */}
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <Input
                              value={entry.password}
                              type={revealedIds.has(entry.id) ? 'text' : 'password'}
                              onChange={(e) => updateEntry(entry.id, 'password', e.target.value)}
                              placeholder="password"
                              autoComplete="off"
                              className="bg-white/5 border-white/10 text-white placeholder-zinc-600 text-xs h-8 flex-1"
                            />
                            <button
                              type="button"
                              onClick={() => toggleReveal(entry.id)}
                              className="p-1 text-zinc-500 hover:text-white transition-colors"
                              title={revealedIds.has(entry.id) ? 'Hide' : 'Show'}
                            >
                              {revealedIds.has(entry.id)
                                ? <EyeOff className="w-3.5 h-3.5" />
                                : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                        {/* Category */}
                        <td className="px-3 py-2">
                          <Select
                            value={entry.category}
                            onValueChange={(val) => updateEntry(entry.id, 'category', val)}
                          >
                            <SelectTrigger className="bg-white/5 border-white/10 text-white text-xs h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1a1d27] border-white/10 text-white">
                              {CATEGORIES.map(([value, label]) => (
                                <SelectItem key={value} value={value} className="text-xs hover:bg-white/10">
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        {/* Confidence */}
                        <td className="px-3 py-2">
                          <ConfidenceBadge confidence={entry.confidence} />
                        </td>
                        {/* Delete */}
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => deleteEntry(entry.id)}
                            className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
                            title="Remove row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Low-confidence warning */}
            {entries.some((e) => e.confidence === 'low') && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-amber-300 text-xs leading-relaxed">
                  Some rows have low confidence — the parser wasn&apos;t certain about the extraction.
                  Review these carefully before importing.
                </p>
              </div>
            )}

            <DialogFooter className="flex items-center justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={addBlankRow}
                className="text-zinc-400 hover:text-white hover:bg-white/10 gap-1.5 mr-auto"
              >
                <Plus className="w-4 h-4" />
                Add row
              </Button>
              <Button
                variant="outline"
                onClick={() => setStage('upload')}
                className="border-white/20 text-zinc-300 hover:bg-white/10"
              >
                Back
              </Button>
              <Button
                onClick={confirmImport}
                disabled={isImporting || entries.filter((e) => e.service && e.password).length === 0}
                className="bg-cyan-600 hover:bg-cyan-500 text-white gap-2"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    Import {entries.filter((e) => e.service && e.password).length} to Vault
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── Stage: Done ───────────────────────────────────────────────── */}
        {stage === 'done' && importResult && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-white">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                Import Complete
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4">
                <p className="text-emerald-300 font-medium text-sm">
                  {importResult.created} credential{importResult.created !== 1 ? 's' : ''} securely stored in Vault
                </p>
                <p className="text-emerald-400/70 text-xs mt-1">
                  All credentials are encrypted with AES-256-GCM and org-scoped.
                </p>
              </div>

              {importResult.skipped > 0 && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4">
                  <p className="text-amber-300 text-sm font-medium">
                    {importResult.skipped} skipped
                  </p>
                  {importResult.errors.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {importResult.errors.slice(0, 5).map((err, i) => (
                        <li key={i} className="text-amber-400/70 text-xs">• {err}</li>
                      ))}
                      {importResult.errors.length > 5 && (
                        <li className="text-amber-400/70 text-xs">
                          …and {importResult.errors.length - 5} more
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              )}

              <p className="text-zinc-500 text-xs">
                💡 Tip: You can now delete your Word document — all credentials are safely stored
                and encrypted in the Vault.
              </p>
            </div>

            <DialogFooter>
              <Button
                onClick={() => handleOpenChange(false)}
                className="bg-cyan-600 hover:bg-cyan-500 text-white"
              >
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
