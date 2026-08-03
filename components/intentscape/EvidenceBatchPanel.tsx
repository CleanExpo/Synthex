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

export function EvidenceBatchPanel({
  contextField,
  busy,
  onAddBatch,
}: EvidenceBatchPanelProps) {
  const [open, setOpen] = useState(false);
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
    return {
      sources: nonOrigin.filter(signal => signal.sourceUrl).length,
      notes: nonOrigin.filter(signal => !signal.sourceUrl).length,
      gaps: contextField.unknowns.length,
      tensions: contextField.contradictions.length,
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
    setValidation(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setValidation(null);
    const invalidUrls: string[] = [];
    const urlSignals = (
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

    const noteSignals = splitLines(notes).map((content, index) => ({
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
    const signals = [...urlSignals, ...noteSignals, ...constraintSignals];
    const contradictionLines = splitLines(contradictions);
    const unknownLines = splitLines(unknowns);
    if (!signals.length) {
      setValidation(
        'Add at least one source, context note or constraint. Tensions and unknowns can accompany that evidence batch.'
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
      className="rounded-[20px] border border-white/[0.12] bg-[rgba(15,23,42,0.90)] shadow-[0_8px_32px_rgba(0,0,0,0.37)] backdrop-blur-xl"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 p-4 md:p-5">
        <div>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-sky-300" aria-hidden="true" />
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-sky-300/70">
              Context Field v{contextField.version}
            </p>
          </div>
          <h2
            id="context-field-title"
            className="mt-1 font-[var(--font-space-grotesk)] text-lg font-medium text-slate-50"
          >
            Give the agents the whole situation at once
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
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
            <p className="font-mono text-lg text-slate-100">{value}</p>
            <p className="text-[11px] text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      {open && (
        <form onSubmit={submit} className="space-y-5 p-4 md:p-5">
          <div className="grid gap-4 xl:grid-cols-3">
            <BatchField
              icon={<Globe className="h-4 w-4" />}
              label="Company + product URLs"
              hint="One URL per line"
              value={websites}
              onChange={setWebsites}
              placeholder={'https://company.com\nhttps://company.com/product'}
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
              placeholder={'https://docs.product.com\nhttps://github.com/...'}
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

          {validation && (
            <p role="alert" className="text-sm text-rose-300">
              {validation}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-4">
            <p className="max-w-xl text-xs leading-5 text-slate-500">
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
              Add the full batch
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
              <p className="font-mono text-xs uppercase tracking-wider text-sky-300/60">
                {signal.kind.replace('-', ' ')}
              </p>
              <p className="mt-1 truncate text-xs text-slate-300">
                {signal.label}
              </p>
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
      <span className="flex items-center gap-2 text-sm text-slate-200">
        {icon && <span className="text-sky-300">{icon}</span>}
        {label}
      </span>
      <span className="mb-2 mt-1 block text-[11px] text-slate-500">{hint}</span>
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
