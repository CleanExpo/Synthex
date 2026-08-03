'use client';

import { useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Database,
  FileText,
  Globe,
  Link,
  Loader2,
  Plus,
  Shield,
  Sparkles,
  X,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { ContextField } from '@/lib/intentscape/contracts';
import { hostname, splitLines } from './presentation';

export interface EvidenceBatch {
  signals: Array<{
    kind: 'website' | 'social-page' | 'document' | 'note' | 'constraint';
    label: string;
    content: string;
    sourceUrl?: string;
    evidenceState: 'opinion' | 'assumption';
    provenance: string;
  }>;
  contradictions: string[];
  unknowns: string[];
}

type EvidenceSignal = EvidenceBatch['signals'][number];

interface EvidenceBatchPanelProps {
  contextField: ContextField;
  busy: boolean;
  onAddBatch: (batch: EvidenceBatch) => Promise<void>;
}

function normaliseUrl(value: string): string | null {
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    return new URL(candidate).toString();
  } catch {
    return null;
  }
}

function classifyUrl(url: string): 'website' | 'social-page' | 'document' {
  const hostname = new URL(url).hostname.toLowerCase();
  if (
    /(^|\.)(instagram|linkedin|youtube|youtu|x|twitter|facebook|tiktok|reddit)\.com$/.test(
      hostname
    )
  ) {
    return 'social-page';
  }
  if (
    /(^|\.)(github\.com|docs\.|notion\.|drive\.google\.|dropbox\.)/.test(
      hostname
    )
  ) {
    return 'document';
  }
  return 'website';
}

export function EvidenceBatchPanel({
  contextField,
  busy,
  onAddBatch,
}: EvidenceBatchPanelProps) {
  const [open, setOpen] = useState(contextField.signals.length === 1);
  const [intakeMode, setIntakeMode] = useState<'quick' | 'structured'>('quick');
  const [smartPaste, setSmartPaste] = useState('');
  const [websites, setWebsites] = useState('');
  const [socials, setSocials] = useState('');
  const [documents, setDocuments] = useState('');
  const [notes, setNotes] = useState('');
  const [constraints, setConstraints] = useState('');
  const [contradictions, setContradictions] = useState('');
  const [unknowns, setUnknowns] = useState('');
  const [validation, setValidation] = useState<string | null>(null);

  const evidenceSummary = useMemo(() => {
    const nonOrigin = contextField.signals.filter(
      signal => signal.kind !== 'origin-signal'
    );
    const autoLabels = nonOrigin.flatMap(signal => signal.autoLabels ?? []);
    return {
      sources: nonOrigin.filter(signal => signal.sourceUrl).length,
      notes: nonOrigin.filter(signal => !signal.sourceUrl).length,
      gaps: contextField.unknowns.length,
      tensions: contextField.contradictions.length,
      appliedLabels: autoLabels.filter(label => label.status === 'applied')
        .length,
      labelsToCheck: autoLabels.filter(label => label.status === 'check')
        .length,
      policyName: autoLabels[0]?.policyName,
    };
  }, [contextField]);

  function clearForm() {
    setWebsites('');
    setSocials('');
    setDocuments('');
    setNotes('');
    setConstraints('');
    setContradictions('');
    setUnknowns('');
    setSmartPaste('');
    setValidation(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setValidation(null);
    const invalidUrls: string[] = [];
    const structuredUrlSignals = (
      [
        ['website', websites, 'Business website'],
        ['social-page', socials, 'Social page'],
        ['document', documents, 'Reference document'],
      ] as const
    ).flatMap(([kind, raw, prefix]) =>
      splitLines(raw).flatMap(value => {
        const url = normaliseUrl(value);
        if (!url) {
          invalidUrls.push(value);
          return [];
        }
        return [
          {
            kind,
            label: `${prefix}: ${hostname(url)}`,
            content: url,
            sourceUrl: url,
            evidenceState: 'assumption' as const,
            provenance: 'Authenticated human evidence batch',
          },
        ];
      })
    );
    if (invalidUrls.length) {
      setValidation(`Check these links: ${invalidUrls.join(', ')}`);
      return;
    }

    const structuredNoteSignals = splitLines(notes).map((content, index) => ({
      kind: 'note' as const,
      label: `Context note ${index + 1}`,
      content,
      evidenceState: 'opinion' as const,
      provenance: 'Authenticated human evidence batch',
    }));
    const constraintSignals = splitLines(constraints).map((content, index) => ({
      kind: 'constraint' as const,
      label: `Operating constraint ${index + 1}`,
      content,
      evidenceState: 'opinion' as const,
      provenance: 'Authenticated human evidence batch',
    }));
    const quickSignals: EvidenceBatch['signals'] = splitLines(smartPaste).map(
      (content, index): EvidenceSignal => {
        const url = normaliseUrl(content);
        if (!url) {
          return {
            kind: 'note',
            label: `Context note ${index + 1}`,
            content,
            evidenceState: 'opinion',
            provenance: 'Authenticated smart-paste evidence batch',
          };
        }
        const kind = classifyUrl(url);
        const label =
          kind === 'social-page'
            ? 'Social page'
            : kind === 'document'
              ? 'Reference document'
              : 'Business website';
        return {
          kind,
          label: `${label}: ${hostname(url)}`,
          content: url,
          sourceUrl: url,
          evidenceState: 'assumption',
          provenance: 'Authenticated smart-paste evidence batch',
        };
      }
    );
    const signals =
      intakeMode === 'quick'
        ? quickSignals
        : [
            ...structuredUrlSignals,
            ...structuredNoteSignals,
            ...constraintSignals,
          ];
    const contradictionLines = splitLines(contradictions);
    const unknownLines = splitLines(unknowns);
    if (!signals.length) {
      setValidation(
        intakeMode === 'quick'
          ? 'Paste at least one link or useful piece of context.'
          : 'Add at least one source, context note or constraint. Tensions and unknowns can accompany that evidence batch.'
      );
      return;
    }
    await onAddBatch({
      signals,
      contradictions: contradictionLines,
      unknowns: unknownLines,
    });
    clearForm();
    setOpen(false);
  }

  return (
    <section
      aria-labelledby="context-field-title"
      className="rounded-card border border-white/[0.08] bg-sx-bg-panel/95 shadow-[var(--sx-shadow-elevated)] backdrop-blur-xl"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 p-4 md:p-5">
        <div>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-sx-info" aria-hidden="true" />
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-sx-info">
              Context Field v{contextField.version}
            </p>
          </div>
          <h2
            id="context-field-title"
            className="mt-1 font-[var(--font-space-grotesk)] text-lg font-medium text-sx-text-primary"
          >
            Give the agents the whole situation at once
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-sx-text-muted">
            Add URLs, social pages, documents, constraints and uncertainty as a
            batch. IntentScape will not force you through a question-by-question
            interview.
          </p>
        </div>
        <Button
          type="button"
          variant="glass-primary"
          size="lg"
          onClick={() => setOpen(current => !current)}
          aria-expanded={open}
          className="min-h-11 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {open ? 'Close intake' : 'Add an evidence batch'}
        </Button>
      </div>

      <div className="grid grid-cols-2 border-y border-white/[0.08] sm:grid-cols-4">
        {[
          ['Linked sources', evidenceSummary.sources],
          ['Notes + constraints', evidenceSummary.notes],
          ['Open unknowns', evidenceSummary.gaps],
          ['Known tensions', evidenceSummary.tensions],
        ].map(([label, value]) => (
          <div
            key={label}
            className="border-b border-r border-white/[0.07] px-4 py-3 last:border-r-0 sm:border-b-0"
          >
            <p className="font-mono text-lg tabular-nums text-sx-text-primary">
              {value}
            </p>
            <p className="text-[11px] text-sx-text-muted">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] bg-sx-intelligence/[0.035] px-4 py-3 text-xs md:px-5">
        <span className="flex items-center gap-2 text-sx-text-secondary">
          <Sparkles className="h-4 w-4 text-sx-intelligence" />
          <span>
            <strong className="font-medium text-sx-text-primary">
              Client-specific labels
            </strong>{' '}
            {evidenceSummary.policyName
              ? `use ${evidenceSummary.policyName}.`
              : 'use the saved client profile and operating method.'}
          </span>
        </span>
        <span className="text-sx-text-muted">
          {evidenceSummary.appliedLabels || evidenceSummary.labelsToCheck
            ? `${evidenceSummary.appliedLabels} applied · ${evidenceSummary.labelsToCheck} optional suggestions`
            : 'Labels appear after the next batch'}
          {' · '}never blocks the next step or grants permission to act
        </span>
      </div>

      {open && (
        <form onSubmit={submit} className="space-y-5 p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-btn border border-white/[0.08] bg-sx-bg-primary/50 p-2">
            <div
              className="flex rounded-[10px] bg-sx-bg-primary p-1"
              role="group"
              aria-label="Evidence intake mode"
            >
              {(
                [
                  ['quick', 'Paste everything'],
                  ['structured', 'Sort manually'],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={intakeMode === mode}
                  onClick={() => setIntakeMode(mode)}
                  className={`min-h-10 rounded-[8px] px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sx-accent ${
                    intakeMode === mode
                      ? 'bg-sx-accent text-sx-bg-primary shadow-sm'
                      : 'text-sx-text-muted hover:text-sx-text-primary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="max-w-lg px-2 text-xs leading-5 text-sx-text-muted">
              {intakeMode === 'quick'
                ? 'URLs and notes are sorted automatically. Synthex also applies the client’s saved workflow labels and keeps uncertain matches as optional suggestions.'
                : 'Use this when the distinction between evidence, constraints and unknowns matters now.'}
            </p>
          </div>

          {intakeMode === 'quick' ? (
            <label htmlFor="intentscape-smart-paste" className="block">
              <span className="flex items-center gap-2 text-sm text-sx-text-primary">
                <Sparkles className="h-4 w-4 text-sx-intelligence" />
                Paste everything you have
              </span>
              <span className="mb-2 mt-1 block text-xs text-sx-text-muted">
                Company pages, social links, developer docs, GitHub URLs and
                rough notes — one item per line.
              </span>
              <Textarea
                id="intentscape-smart-paste"
                variant="glass-solid"
                resize="vertical"
                value={smartPaste}
                onChange={event => setSmartPaste(event.target.value)}
                placeholder={
                  'https://company.com\nhttps://github.com/product/docs\nCustomers cannot compare the options quickly.'
                }
                className="min-h-[190px] text-base leading-7 focus-visible:ring-sx-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              />
            </label>
          ) : (
            <>
              <div className="grid gap-4 xl:grid-cols-3">
                <BatchField
                  icon={<Globe className="h-4 w-4" />}
                  label="Company + product URLs"
                  hint="One URL per line"
                  value={websites}
                  onChange={setWebsites}
                  placeholder={
                    'https://company.com\nhttps://company.com/product'
                  }
                />
                <BatchField
                  icon={<Link className="h-4 w-4" />}
                  label="Social pages"
                  hint="LinkedIn, Instagram, YouTube, X and more"
                  value={socials}
                  onChange={setSocials}
                  placeholder={
                    'https://linkedin.com/company/...\nhttps://instagram.com/...'
                  }
                />
                <BatchField
                  icon={<FileText className="h-4 w-4" />}
                  label="Docs + references"
                  hint="Developer docs, competitor pages or research"
                  value={documents}
                  onChange={setDocuments}
                  placeholder={
                    'https://docs.product.com\nhttps://github.com/...'
                  }
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <BatchField
                  label="Context notes"
                  hint="One complete thought per line"
                  value={notes}
                  onChange={setNotes}
                  placeholder={
                    'The customer is time-poor and non-technical.\nThe current workflow loses context between teams.'
                  }
                />
                <BatchField
                  icon={<Shield className="h-4 w-4" />}
                  label="Operating constraints"
                  hint="Budget, authority, compliance, timing or technical limits"
                  value={constraints}
                  onChange={setConstraints}
                  placeholder={
                    'No automatic publishing.\nMust work with the existing stack.'
                  }
                />
                <BatchField
                  icon={<AlertTriangle className="h-4 w-4" />}
                  label="Contradictions or tensions"
                  hint="What does not fit cleanly?"
                  value={contradictions}
                  onChange={setContradictions}
                  placeholder="Users want autonomy, but also need control over every final decision."
                />
                <BatchField
                  label="Important unknowns"
                  hint="What should research resolve?"
                  value={unknowns}
                  onChange={setUnknowns}
                  placeholder="Which intervention produces the highest-value behaviour change?"
                />
              </div>
            </>
          )}

          {validation && (
            <p role="alert" className="text-sm text-rose-300">
              {validation}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-4">
            <p className="max-w-xl text-xs leading-5 text-sx-text-muted">
              Links are recorded as unverified source leads. Research agents
              must still fetch and verify them before relying on their claims.
            </p>
            <Button
              type="submit"
              variant="glass-success"
              size="lg"
              disabled={busy}
              className="min-h-11 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {intakeMode === 'quick' ? 'Add everything' : 'Add the full batch'}
            </Button>
          </div>
        </form>
      )}

      {!open && contextField.signals.length > 1 && (
        <div
          className="flex gap-2 overflow-x-auto p-4"
          aria-label="Context signals"
        >
          {contextField.signals.slice(1).map(signal => (
            <div
              key={signal.id}
              className="min-w-[190px] max-w-[260px] rounded-[10px] border border-white/[0.08] bg-white/[0.03] p-3"
            >
              <p className="font-mono text-xs uppercase tracking-wider text-sx-info/70">
                {signal.kind.replace('-', ' ')}
              </p>
              <p className="mt-1 truncate text-xs text-sx-text-secondary">
                {signal.label}
              </p>
              {!!signal.autoLabels?.length && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {signal.autoLabels.slice(0, 3).map(autoLabel => (
                    <span
                      key={autoLabel.labelId}
                      title={`${autoLabel.reason} Confidence ${Math.round(autoLabel.confidence * 100)}%.`}
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        autoLabel.status === 'check'
                          ? 'border-amber-400/25 bg-amber-400/[0.08] text-amber-200'
                          : 'border-sx-intelligence/20 bg-sx-intelligence/[0.08] text-sx-intelligence'
                      }`}
                    >
                      {autoLabel.status === 'check' ? 'Suggested · ' : ''}
                      {autoLabel.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function BatchField({
  icon,
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  icon?: React.ReactNode;
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const id = `intentscape-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <label htmlFor={id} className="block">
      <span className="flex items-center gap-2 text-sm text-sx-text-secondary">
        {icon && <span className="text-sx-info">{icon}</span>}
        {label}
      </span>
      <span className="mb-2 mt-1 block text-[11px] text-sx-text-muted">
        {hint}
      </span>
      <Textarea
        id={id}
        variant="glass-solid"
        resize="vertical"
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-[112px] focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      />
    </label>
  );
}
