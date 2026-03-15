'use client';

/**
 * Vault Import Dialog — v3
 *
 * Three-stage dialog:
 *   Stage 1: File upload + business selector (which orgs to import to)
 *   Stage 2: Full editable review table with AI Smart Cleanup
 *   Stage 3: Import complete summary
 *
 * Passwords masked with per-row reveal. Low-confidence rows highlighted.
 * Smart Cleanup analyses entries for duplicates, test data, weak passwords,
 * missing fields, and flags them for review or automatic removal.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
  Sparkles,
  X,
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

interface AiFlag {
  id: string;
  reasons: string[];
  action: 'remove' | 'review';
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

const COMMON_PASSWORDS = new Set([
  'password', 'password1', '123456', '1234567', '12345678', '123456789',
  '1234', '12345', 'qwerty', 'abc123', 'letmein', 'admin', 'welcome',
  'monkey', 'dragon', 'master', 'login', 'pass', 'test', 'demo', 'temp',
  '111111', '000000', 'iloveyou', 'sunshine', '1q2w3e', 'changeme',
]);

const TEST_SERVICE_PATTERN = /^(test|demo|temp|example|sample|dummy|xxx|yyy|zzz|aaa|placeholder|n\/a|na|none|unknown|untitled)\s*\d*$/i;

// =============================================================================
// Smart Cleanup Analyser
// =============================================================================

function analyseCredentials(entries: ImportedCredential[]): Map<string, AiFlag> {
  const flagMap = new Map<string, AiFlag>();

  function addFlag(id: string, reason: string, action: 'remove' | 'review') {
    const existing = flagMap.get(id);
    if (!existing) {
      flagMap.set(id, { id, reasons: [reason], action });
    } else {
      existing.reasons.push(reason);
      // Escalate to remove if any reason requires it
      if (action === 'remove') existing.action = 'remove';
    }
  }

  // 1. Duplicates — same service + username combination
  const seenKeys = new Map<string, string>();
  for (const e of entries) {
    const key = `${e.service.toLowerCase().trim()}|${(e.username ?? '').toLowerCase().trim()}`;
    if (seenKeys.has(key)) {
      addFlag(e.id, `Duplicate of "${e.service}" with same username`, 'remove');
    } else {
      seenKeys.set(key, e.id);
    }
  }

  // 2. Duplicate passwords across different services (same password reused)
  const passwordCount = new Map<string, number>();
  for (const e of entries) {
    if (e.password.trim().length >= 6) {
      passwordCount.set(e.password, (passwordCount.get(e.password) ?? 0) + 1);
    }
  }
  for (const e of entries) {
    const count = passwordCount.get(e.password) ?? 0;
    if (count > 3) {
      addFlag(e.id, `Same password used across ${count} accounts — likely placeholder or test password`, 'review');
    }
  }

  // 3. Missing service name
  for (const e of entries) {
    if (!e.service.trim()) {
      addFlag(e.id, 'No service name — entry cannot be identified', 'remove');
    }
  }

  // 4. Missing password
  for (const e of entries) {
    if (!e.password.trim()) {
      addFlag(e.id, 'Empty password — nothing to store', 'remove');
    }
  }

  // 5. Very short or common passwords
  for (const e of entries) {
    if (!e.password.trim()) continue;
    if (e.password.trim().length < 4) {
      addFlag(e.id, `Password is only ${e.password.trim().length} characters — likely a placeholder`, 'review');
    } else if (COMMON_PASSWORDS.has(e.password.toLowerCase().trim())) {
      addFlag(e.id, `Password "${e.password}" is a commonly used weak/test password`, 'review');
    }
  }

  // 6. Password equals username (obvious security issue or test data)
  for (const e of entries) {
    if (e.username && e.password && e.password.toLowerCase().trim() === e.username.toLowerCase().trim()) {
      addFlag(e.id, 'Password is identical to username — invalid or test credential', 'review');
    }
  }

  // 7. Test / placeholder service names
  for (const e of entries) {
    if (e.service.trim() && TEST_SERVICE_PATTERN.test(e.service.trim())) {
      addFlag(e.id, `Service name "${e.service}" looks like test or placeholder data`, 'review');
    }
  }

  // 8. Garbage service name (all special chars or numbers only)
  for (const e of entries) {
    if (e.service.trim() && /^[\d\s\W]+$/.test(e.service.trim())) {
      addFlag(e.id, `Service name "${e.service}" appears to be garbled text`, 'review');
    }
  }

  // 9. Low-confidence extraction with no offsetting info
  for (const e of entries) {
    if (e.confidence === 'low' && !e.username && !e.url) {
      addFlag(e.id, 'Parser had low confidence and no username or URL to verify against', 'review');
    }
  }

  return flagMap;
}

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
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedOrgIds, setSelectedOrgIds] = useState<Set<string>>(new Set([organizationId]));
  const [searchFilter, setSearchFilter] = useState('');
  // AI Smart Cleanup
  const [aiFlags, setAiFlags] = useState<Map<string, AiFlag>>(new Map());
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [isAnalysing, setIsAnalysing] = useState(false);
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
          setCheckedIds(new Set());
          setImportResult(null);
          setIsParsing(false);
          setIsImporting(false);
          setSearchFilter('');
          setAiFlags(new Map());
          setShowAiPanel(false);
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

      const parsed: ImportedCredential[] = data.entries ?? [];
      setEntries(parsed);
      setStage('review');
      toast.success(
        `Found ${data.extractedCount} credential${data.extractedCount !== 1 ? 's' : ''} from ${data.rawLineCount} lines`
      );

      // Auto-run Smart Cleanup after parse so user sees it immediately
      if (parsed.length > 0) {
        setTimeout(() => {
          const flags = analyseCredentials(parsed);
          setAiFlags(flags);
          if (flags.size > 0) {
            setShowAiPanel(true);
          }
        }, 400);
      }
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
    // Clear AI flag for this entry when user edits it
    setAiFlags((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }

  function deleteEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setAiFlags((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // Checkbox + bulk delete
  // ---------------------------------------------------------------------------

  function toggleCheck(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleCheckAll() {
    const visibleIds = filteredEntries.map((e) => e.id);
    const allChecked = visibleIds.every((id) => checkedIds.has(id));
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (allChecked) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function deleteChecked() {
    const count = checkedIds.size;
    const toDelete = new Set(checkedIds);
    setEntries((prev) => prev.filter((e) => !toDelete.has(e.id)));
    setCheckedIds(new Set());
    setAiFlags((prev) => {
      const next = new Map(prev);
      toDelete.forEach((id) => next.delete(id));
      return next;
    });
    toast.success(`Removed ${count} entr${count !== 1 ? 'ies' : 'y'}`);
  }

  function skipLowConfidence() {
    const lowIds = entries.filter((e) => e.confidence === 'low').map((e) => e.id);
    const lowSet = new Set(lowIds);
    setEntries((prev) => prev.filter((e) => e.confidence !== 'low'));
    setCheckedIds((prev) => {
      const next = new Set(prev);
      lowIds.forEach((id) => next.delete(id));
      return next;
    });
    setAiFlags((prev) => {
      const next = new Map(prev);
      lowSet.forEach((id) => next.delete(id));
      return next;
    });
    toast.success(`Removed ${lowIds.length} low-confidence entr${lowIds.length !== 1 ? 'ies' : 'y'}`);
  }

  function skipByCategory(category: string) {
    const toRemove = entries.filter((e) => e.category === category).map((e) => e.id);
    const toRemoveSet = new Set(toRemove);
    setEntries((prev) => prev.filter((e) => !toRemoveSet.has(e.id)));
    setCheckedIds((prev) => {
      const next = new Set(prev);
      toRemove.forEach((id) => next.delete(id));
      return next;
    });
    setAiFlags((prev) => {
      const next = new Map(prev);
      toRemove.forEach((id) => next.delete(id));
      return next;
    });
    toast.success(`Removed ${toRemove.length} ${CATEGORY_LABELS[category as CredentialCategory] ?? category} entries`);
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
  // AI Smart Cleanup
  // ---------------------------------------------------------------------------

  function runSmartCleanup() {
    setIsAnalysing(true);
    // Run analysis synchronously but defer state update for smooth UX
    setTimeout(() => {
      const flags = analyseCredentials(entries);
      setAiFlags(flags);
      setShowAiPanel(true);
      setIsAnalysing(false);

      const removable = Array.from(flags.values()).filter((f) => f.action === 'remove').length;
      const reviewable = Array.from(flags.values()).filter((f) => f.action === 'review').length;

      if (flags.size === 0) {
        toast.success('No issues found — all credentials look clean!');
      } else {
        toast.info(`Smart Cleanup found ${removable} to remove, ${reviewable} to review`);
      }
    }, 150);
  }

  function applyRemoveFlagged() {
    const toRemove = new Set(
      Array.from(aiFlags.values())
        .filter((f) => f.action === 'remove')
        .map((f) => f.id)
    );
    const count = toRemove.size;
    setEntries((prev) => prev.filter((e) => !toRemove.has(e.id)));
    setAiFlags((prev) => {
      const next = new Map(prev);
      toRemove.forEach((id) => next.delete(id));
      return next;
    });
    setCheckedIds((prev) => {
      const next = new Set(prev);
      toRemove.forEach((id) => next.delete(id));
      return next;
    });
    toast.success(`Removed ${count} flagged entr${count !== 1 ? 'ies' : 'y'}`);
  }

  function selectFlaggedForReview() {
    const reviewIds = Array.from(aiFlags.values())
      .filter((f) => f.action === 'review')
      .map((f) => f.id);
    setCheckedIds((prev) => {
      const next = new Set(prev);
      reviewIds.forEach((id) => next.add(id));
      return next;
    });
    toast.info(`${reviewIds.length} entries selected — review and delete as needed`);
  }

  function dismissAiFlag(id: string) {
    setAiFlags((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // Filtered view
  // ---------------------------------------------------------------------------

  const filteredEntries = useMemo(() =>
    searchFilter.trim()
      ? entries.filter(
          (e) =>
            e.service.toLowerCase().includes(searchFilter.toLowerCase()) ||
            (e.username ?? '').toLowerCase().includes(searchFilter.toLowerCase()) ||
            e.category.toLowerCase().includes(searchFilter.toLowerCase())
        )
      : entries,
    [entries, searchFilter]
  );

  const validCount = entries.filter((e) => e.service.trim() && e.password.trim()).length;
  const lowConfidenceCount = entries.filter((e) => e.confidence === 'low').length;
  const checkedVisibleCount = filteredEntries.filter((e) => checkedIds.has(e.id)).length;
  const allVisibleChecked = filteredEntries.length > 0 && filteredEntries.every((e) => checkedIds.has(e.id));

  const aiRemoveCount = Array.from(aiFlags.values()).filter((f) => f.action === 'remove').length;
  const aiReviewCount = Array.from(aiFlags.values()).filter((f) => f.action === 'review').length;

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
                  {aiFlags.size > 0 && (
                    <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                      {aiFlags.size} flagged
                    </Badge>
                  )}
                </DialogTitle>
                <p className="text-zinc-500 text-xs shrink-0">
                  → {selectedOrgIds.size} business{selectedOrgIds.size !== 1 ? 'es' : ''}
                </p>
              </div>
              <DialogDescription className="text-zinc-400 text-xs">
                Edit any field before importing. Use Smart Cleanup to auto-remove duplicates and test entries.
              </DialogDescription>
            </DialogHeader>

            {/* Search + bulk actions toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                placeholder="Filter by service, username, or category…"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder-zinc-600 text-xs h-8 flex-1 min-w-[180px]"
              />
              {searchFilter && (
                <span className="text-zinc-500 text-xs shrink-0">{filteredEntries.length} shown</span>
              )}

              {/* Smart Cleanup button */}
              <Button
                type="button" variant="outline" size="sm"
                onClick={runSmartCleanup}
                disabled={isAnalysing}
                className="border-purple-500/40 text-purple-300 hover:bg-purple-500/10 text-xs h-7 shrink-0 gap-1"
              >
                {isAnalysing
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <Sparkles className="w-3 h-3" />
                }
                Smart Cleanup
              </Button>

              {/* Quick cleanup buttons */}
              {lowConfidenceCount > 0 && (
                <Button
                  type="button" variant="outline" size="sm"
                  onClick={skipLowConfidence}
                  className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 text-xs h-7 shrink-0"
                >
                  Remove {lowConfidenceCount} low-confidence
                </Button>
              )}
              {checkedIds.size > 0 && (
                <Button
                  type="button" variant="outline" size="sm"
                  onClick={deleteChecked}
                  className="border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs h-7 shrink-0"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete {checkedIds.size} selected
                </Button>
              )}
            </div>

            {/* AI Smart Cleanup panel */}
            {showAiPanel && (
              <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 overflow-hidden">
                {/* Panel header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-purple-500/20">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-purple-300 text-xs font-medium">Smart Cleanup Analysis</span>
                    {aiFlags.size === 0 && (
                      <span className="text-emerald-400 text-xs">— All clean ✓</span>
                    )}
                    {aiRemoveCount > 0 && (
                      <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-[10px]">
                        {aiRemoveCount} to remove
                      </Badge>
                    )}
                    {aiReviewCount > 0 && (
                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">
                        {aiReviewCount} to review
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {aiRemoveCount > 0 && (
                      <button
                        type="button"
                        onClick={applyRemoveFlagged}
                        className="text-red-400 hover:text-red-300 text-xs font-medium underline-offset-2 hover:underline"
                      >
                        Remove {aiRemoveCount} now
                      </button>
                    )}
                    {aiReviewCount > 0 && (
                      <button
                        type="button"
                        onClick={selectFlaggedForReview}
                        className="text-amber-400 hover:text-amber-300 text-xs underline-offset-2 hover:underline"
                      >
                        Select {aiReviewCount} for review
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowAiPanel(false)}
                      className="text-zinc-500 hover:text-white p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Flagged entries list */}
                {aiFlags.size > 0 && (
                  <div className="max-h-44 overflow-y-auto divide-y divide-purple-500/10">
                    {Array.from(aiFlags.values()).map((flag) => {
                      const entry = entries.find((e) => e.id === flag.id);
                      if (!entry) return null;
                      return (
                        <div
                          key={flag.id}
                          className={`flex items-start gap-2 px-3 py-1.5 text-xs ${
                            flag.action === 'remove' ? 'bg-red-500/5' : 'bg-amber-500/5'
                          }`}
                        >
                          <span className={`shrink-0 mt-0.5 font-bold ${flag.action === 'remove' ? 'text-red-400' : 'text-amber-400'}`}>
                            {flag.action === 'remove' ? '✕' : '⚠'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className="text-white font-medium truncate">
                              {entry.service || '(no name)'}
                            </span>
                            {entry.username && (
                              <span className="text-zinc-500 ml-1">· {entry.username}</span>
                            )}
                            <p className="text-zinc-500 mt-0.5 leading-tight">
                              {flag.reasons.join('; ')}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => dismissAiFlag(flag.id)}
                            className="text-zinc-600 hover:text-zinc-400 shrink-0 mt-0.5"
                            title="Dismiss this flag"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Scrollable table */}
            <div
              className="overflow-y-auto flex-1 rounded-lg border border-white/10"
              style={{ maxHeight: 'calc(92vh - 360px)', minHeight: '200px' }}
            >
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#0f1117] border-b border-white/10 z-10">
                  <tr className="text-zinc-400 text-xs uppercase tracking-wide">
                    <th className="px-3 py-2 w-[4%]">
                      <input
                        type="checkbox"
                        checked={allVisibleChecked}
                        onChange={toggleCheckAll}
                        className="rounded border-white/20 bg-white/5 accent-cyan-500 cursor-pointer"
                        title="Select all visible"
                      />
                    </th>
                    <th className="text-left px-3 py-2 w-[19%]">Service</th>
                    <th className="text-left px-3 py-2 w-[21%]">Username / Email</th>
                    <th className="text-left px-3 py-2 w-[21%]">Password</th>
                    <th className="text-left px-3 py-2 w-[17%]">Category</th>
                    <th className="text-left px-3 py-2 w-[10%]">Confidence</th>
                    <th className="px-3 py-2 w-[8%]" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredEntries.map((entry) => {
                    const aiFlag = aiFlags.get(entry.id);
                    return (
                      <tr
                        key={entry.id}
                        className={`transition-colors ${
                          checkedIds.has(entry.id)
                            ? 'bg-red-500/5 border-l-2 border-l-red-500/40'
                            : aiFlag?.action === 'remove'
                            ? 'bg-red-500/5 border-l-2 border-l-red-500/20'
                            : aiFlag?.action === 'review'
                            ? 'bg-amber-500/5 border-l-2 border-l-amber-500/20'
                            : entry.confidence === 'low'
                            ? 'bg-amber-500/5'
                            : 'hover:bg-white/5'
                        }`}
                        title={aiFlag ? aiFlag.reasons.join('; ') : undefined}
                      >
                        {/* Checkbox */}
                        <td className="px-3 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={checkedIds.has(entry.id)}
                            onChange={() => toggleCheck(entry.id)}
                            className="rounded border-white/20 bg-white/5 accent-cyan-500 cursor-pointer"
                          />
                        </td>
                        {/* Service */}
                        <td className="px-3 py-1.5">
                          <Input
                            value={entry.service}
                            onChange={(e) => updateEntry(entry.id, 'service', e.target.value)}
                            placeholder="Service name"
                            className="bg-white/5 border-white/10 text-white placeholder-zinc-600 text-xs h-7"
                          />
                        </td>
                        {/* Username */}
                        <td className="px-3 py-1.5">
                          <Input
                            value={entry.username ?? ''}
                            onChange={(e) => updateEntry(entry.id, 'username', e.target.value || null)}
                            placeholder="user@email.com"
                            autoComplete="off"
                            className="bg-white/5 border-white/10 text-white placeholder-zinc-600 text-xs h-7"
                          />
                        </td>
                        {/* Password */}
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
                        {/* Category */}
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
                        {/* Confidence */}
                        <td className="px-3 py-1.5">
                          <ConfidenceBadge confidence={entry.confidence} />
                        </td>
                        {/* Delete */}
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
                    );
                  })}
                </tbody>
              </table>
            </div>

            {lowConfidenceCount > 0 && aiFlags.size === 0 && (
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
