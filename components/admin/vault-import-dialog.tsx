'use client';

/**
 * Vault Import Dialog — v2
 *
 * Three-stage dialog:
 *   Stage 1: File upload + business selector (which orgs to import to)
 *   Stage 2: Full editable review table (handles 200+ entries, virtualised scroll)
 *   Stage 3: Import complete summary
 *
 * Passwords masked with per-row reveal. Low-confidence rows highlighted.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
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
import {
  FileText,
  Upload,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Shield,
  Building2,
} from '@/components/icons';
import useSWR from 'swr';

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

interface OwnedBusiness {
  id: string;
  organizationId: string;
  displayName: string;
  organization?: { name: string };
}

interface ImportResult {
  created: number;
  skipped: number;
  errors: string[];
  orgCount?: number;
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
// Helpers
// =============================================================================

function fetchJson(url: string) {
  return fetch(url, { credentials: 'include' }).then((r) => r.json());
}

function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  if (confidence === 'high') return (
    <Badge variant="outline" className="border-emerald-500 text-emerald-500 text-xs shrink-0">High</Badge>
  );
  if (confidence === 'medium') return (
    <Badge variant="outline" className="border-blue-500 text-blue-500 text-xs shrink-0">Medium</Badge>
  );
  return (
    <Badge variant="outline" className="border-amber-500 text-amber-500 text-xs shrink-0">Low ⚠</Badge>
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
  const [selectedOrgIds, setSelectedOrgIds] = useState<Set<string>>(new Set([organizationId]));
  const [searchFilter, setSearchFilter] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Load owned businesses for org selector
  const { data: businessData } = useSWR<{ businesses: OwnedBusiness[] }>(
    open ? '/api/businesses' : null,
    fetchJson
  );
  const businesses = businessData?.businesses ?? [];

  // Keep selectedOrgIds in sync if organizationId changes
  useEffect(() => {
    setSelectedOrgIds(new Set([organizationId]));
  }, [organizationId]);

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
          setSearchFilter('');
        }, 300);
      }
      onOpenChange(next);
    },
    [onOpenChange]
  );

  // ---------------------------------------------------------------------------
  // Business selector toggle
  // ---------------------------------------------------------------------------

  function toggleOrg(orgId: string) {
    setSelectedOrgIds((prev) => {
      const next = new Set(prev);
      if (next.has(orgId)) {
        if (next.size === 1) return prev; // must keep at least one
        next.delete(orgId);
      } else {
        next.add(orgId);
      }
      return next;
    });
  }

  function selectAllOrgs() {
    const allIds = businesses.map((b) => b.organizationId);
    allIds.push(organizationId);
    setSelectedOrgIds(new Set(allIds));
  }

  // ---------------------------------------------------------------------------
  // File Upload & Parse
  // ---------------------------------------------------------------------------

  async function uploadFile(file: File) {
    if (!file.name.endsWith('.docx')) {
      toast.error('Only .docx files are supported');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error('File too large. Maximum 25MB.');
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
        if (data.hint) toast.info(data.hint, { duration: 8000 });
        return;
      }

      setEntries(data.entries ?? []);
      setStage('review');
      toast.success(
        `Found ${data.extractedCount} credential${data.extractedCount !== 1 ? 's' : ''} from ${data.rawLineCount} lines`
      );
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setIsParsing(false);
    }
  }

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
  // Row editing
  // ---------------------------------------------------------------------------

  function updateEntry(id: string, field: keyof ImportedCredential, value: string | null) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
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
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // Filtered view
  // ---------------------------------------------------------------------------

  const filteredEntries = searchFilter.trim()
    ? entries.filter(
        (e) =>
          e.service.toLowerCase().includes(searchFilter.toLowerCase()) ||
          (e.username ?? '').toLowerCase().includes(searchFilter.toLowerCase()) ||
          e.category.toLowerCase().includes(searchFilter.toLowerCase())
      )
    : entries;

  const validCount = entries.filter((e) => e.service.trim() && e.password.trim()).length;
  const lowConfidenceCount = entries.filter((e) => e.confidence === 'low').length;

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
        body: JSON.stringify({
          organizationIds: Array.from(selectedOrgIds),
          entries: validEntries,
        }),
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
        const orgText = (result.orgCount ?? 1) > 1 ? ` across ${result.orgCount} businesses` : '';
        toast.success(`${result.created} credential${result.created !== 1 ? 's' : ''} imported${orgText}`);
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
          ${stage === 'review' ? 'max-w-6xl max-h-[92vh]' : 'max-w-xl'}
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
                Upload your Word document. The system will extract ALL credentials,
                categorise them, and let you review before saving anything.
              </DialogDescription>
            </DialogHeader>

            {/* Dropzone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => !isParsing && fileRef.current?.click()}
              className={`
                mt-2 border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3
                cursor-pointer transition-colors
                ${isDragging ? 'border-cyan-400 bg-cyan-400/10' : 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10'}
              `}
            >
              {isParsing ? (
                <>
                  <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
                  <p className="text-zinc-300 text-sm font-medium">Reading and extracting credentials…</p>
                  <p className="text-zinc-500 text-xs">This may take a few seconds for large documents</p>
                </>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-zinc-500" />
                  <p className="text-white font-medium">Drop your .docx file here</p>
                  <p className="text-zinc-500 text-sm">or click to browse</p>
                  <Badge variant="outline" className="border-white/20 text-zinc-400 text-xs mt-1">
                    .docx only — max 25MB
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
                e.target.value = '';
              }}
            />

            {/* Business selector */}
            {businesses.length > 0 && (
              <div className="mt-1">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-zinc-400 text-xs flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    Import to which businesses?
                  </p>
                  <button
                    type="button"
                    onClick={selectAllOrgs}
                    className="text-cyan-400 text-xs hover:text-cyan-300"
                  >
                    Select all
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {businesses.map((b) => {
                    const id = b.organizationId;
                    const selected = selectedOrgIds.has(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleOrg(id)}
                        className={`
                          flex items-center gap-2 rounded-lg px-3 py-2 text-sm border transition-colors text-left
                          ${selected
                            ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                            : 'border-white/10 bg-white/5 text-zinc-400 hover:border-white/30'}
                        `}
                      >
                        <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 ${selected ? 'bg-cyan-500 border-cyan-500' : 'border-white/30'}`}>
                          {selected && <span className="text-white text-[9px] leading-none">✓</span>}
                        </div>
                        <span className="truncate">{b.displayName || b.organization?.name}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-zinc-600 text-xs mt-2">
                  {selectedOrgIds.size} of {businesses.length} businesses selected
                </p>
              </div>
            )}

            {/* Security note */}
            <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
              <Shield className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <p className="text-emerald-300 text-xs leading-relaxed">
                Document processed server-side only — never stored. All credentials encrypted
                AES-256-GCM after your review. Passwords never appear in logs.
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
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2 text-white">
                  <CheckCircle className="w-5 h-5 text-cyan-400" />
                  Review Credentials
                  <Badge className="ml-1 bg-cyan-500/20 text-cyan-300 border-cyan-500/30">
                    {entries.length} found
                  </Badge>
                  {lowConfidenceCount > 0 && (
                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                      {lowConfidenceCount} low confidence
                    </Badge>
                  )}
                </DialogTitle>
                {/* Target orgs summary */}
                <p className="text-zinc-500 text-xs shrink-0">
                  → {selectedOrgIds.size} business{selectedOrgIds.size !== 1 ? 'es' : ''}
                </p>
              </div>
              <DialogDescription className="text-zinc-400 text-xs">
                Edit any field before importing. Passwords masked — click 👁 to reveal per row.
                Low-confidence rows (amber) should be reviewed carefully.
              </DialogDescription>
            </DialogHeader>

            {/* Search filter */}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Filter by service, username, or category…"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder-zinc-600 text-xs h-8"
              />
              {searchFilter && (
                <span className="text-zinc-500 text-xs shrink-0">{filteredEntries.length} shown</span>
              )}
            </div>

            {/* Scrollable table */}
            <div className="overflow-y-auto flex-1 rounded-lg border border-white/10" style={{ maxHeight: 'calc(92vh - 300px)', minHeight: '200px' }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#0f1117] border-b border-white/10 z-10">
                  <tr className="text-zinc-400 text-xs uppercase tracking-wide">
                    <th className="text-left px-3 py-2 w-[20%]">Service</th>
                    <th className="text-left px-3 py-2 w-[22%]">Username / Email</th>
                    <th className="text-left px-3 py-2 w-[22%]">Password</th>
                    <th className="text-left px-3 py-2 w-[18%]">Category</th>
                    <th className="text-left px-3 py-2 w-[10%]">Confidence</th>
                    <th className="px-3 py-2 w-[8%]" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredEntries.map((entry) => (
                    <tr
                      key={entry.id}
                      className={`transition-colors ${entry.confidence === 'low' ? 'bg-amber-500/5' : 'hover:bg-white/5'}`}
                    >
                      <td className="px-3 py-1.5">
                        <Input
                          value={entry.service}
                          onChange={(e) => updateEntry(entry.id, 'service', e.target.value)}
                          placeholder="Service name"
                          className="bg-white/5 border-white/10 text-white placeholder-zinc-600 text-xs h-7"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          value={entry.username ?? ''}
                          onChange={(e) => updateEntry(entry.id, 'username', e.target.value || null)}
                          placeholder="user@email.com"
                          autoComplete="off"
                          className="bg-white/5 border-white/10 text-white placeholder-zinc-600 text-xs h-7"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-1">
                          <Input
                            value={entry.password}
                            type={revealedIds.has(entry.id) ? 'text' : 'password'}
                            onChange={(e) => updateEntry(entry.id, 'password', e.target.value)}
                            placeholder="password"
                            autoComplete="new-password"
                            className="bg-white/5 border-white/10 text-white placeholder-zinc-600 text-xs h-7 flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => toggleReveal(entry.id)}
                            className="p-1 text-zinc-500 hover:text-white transition-colors"
                          >
                            {revealedIds.has(entry.id)
                              ? <EyeOff className="w-3 h-3" />
                              : <Eye className="w-3 h-3" />}
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-1.5">
                        <Select
                          value={entry.category}
                          onValueChange={(val) => updateEntry(entry.id, 'category', val)}
                        >
                          <SelectTrigger className="bg-white/5 border-white/10 text-white text-xs h-7">
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
                      <td className="px-3 py-1.5">
                        <ConfidenceBadge confidence={entry.confidence} />
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => deleteEntry(entry.id)}
                          className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {lowConfidenceCount > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-amber-300 text-xs">
                  {lowConfidenceCount} row{lowConfidenceCount !== 1 ? 's' : ''} have low confidence — review before importing.
                </p>
              </div>
            )}

            <DialogFooter className="flex items-center justify-between gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={addBlankRow}
                className="text-zinc-400 hover:text-white hover:bg-white/10 gap-1.5 mr-auto text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Add row
              </Button>
              <Button
                variant="outline"
                onClick={() => setStage('upload')}
                className="border-white/20 text-zinc-300 hover:bg-white/10 text-xs"
              >
                Back
              </Button>
              <Button
                onClick={confirmImport}
                disabled={isImporting || validCount === 0}
                className="bg-cyan-600 hover:bg-cyan-500 text-white gap-2 text-xs"
              >
                {isImporting ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" />Importing…</>
                ) : (
                  <><Shield className="w-3.5 h-3.5" />
                    Import {validCount} to {selectedOrgIds.size} business{selectedOrgIds.size !== 1 ? 'es' : ''}
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
                  {importResult.created} credential{importResult.created !== 1 ? 's' : ''} securely stored
                  {(importResult.orgCount ?? 1) > 1 ? ` across ${importResult.orgCount} businesses` : ''}
                </p>
                <p className="text-emerald-400/70 text-xs mt-1">
                  Encrypted with AES-256-GCM · Org-scoped · Fully audited
                </p>
              </div>

              {importResult.skipped > 0 && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                  <p className="text-amber-300 text-sm font-medium">{importResult.skipped} skipped</p>
                  {importResult.errors.length > 0 && (
                    <ul className="mt-1.5 space-y-1">
                      {importResult.errors.slice(0, 5).map((err, i) => (
                        <li key={i} className="text-amber-400/70 text-xs">• {err}</li>
                      ))}
                      {importResult.errors.length > 5 && (
                        <li className="text-amber-400/70 text-xs">…and {importResult.errors.length - 5} more</li>
                      )}
                    </ul>
                  )}
                </div>
              )}

              <p className="text-zinc-500 text-xs">
                💡 You can now safely delete the Word document — all credentials are in the Vault.
              </p>
            </div>

            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)} className="bg-cyan-600 hover:bg-cyan-500 text-white">
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
