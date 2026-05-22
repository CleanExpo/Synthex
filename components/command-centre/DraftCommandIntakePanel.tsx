'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Shield as ShieldCheck,
} from '@/components/icons';
import { fetchWithCSRF } from '@/lib/csrf';
import { cn } from '@/lib/utils';
import { buildHermesHandoffPacket } from '@/lib/unite-command-center/hermes/hermes-handoff.service';
import type {
  BoardInputSource,
  CommandPacket,
} from '@/lib/unite-command-center';
import type { DraftCommandResponse } from './types';

const INPUT_SOURCES: Array<{ value: BoardInputSource; label: string }> = [
  { value: 'manual', label: 'Manual' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'plaud', label: 'Plaud' },
  { value: 'meeting_notes', label: 'Meeting Notes' },
  { value: 'obsidian', label: 'Obsidian' },
  { value: 'pipedream', label: 'Pipedream' },
];

const GATE_CLASSES: Record<CommandPacket['approvalGate'], string> = {
  human_review: 'border-amber-500/25 text-amber-300 bg-amber-500/[0.04]',
  client_review: 'border-cyan-500/25 text-cyan-300 bg-cyan-500/[0.04]',
  production_blocked: 'border-red-500/25 text-red-300 bg-red-500/[0.04]',
};

const HERMES_HANDOFF = buildHermesHandoffPacket({
  gatewayRunning: true,
  telegramConfigured: true,
  whatsappConfigured: false,
  scheduledJobsActive: 47,
});

export function DraftCommandIntakePanel({
  onDraftCreated,
}: {
  onDraftCreated?: (draft: DraftCommandResponse) => void;
}) {
  const [source, setSource] = useState<BoardInputSource>('manual');
  const [speaker, setSpeaker] = useState('Phill');
  const [rawText, setRawText] = useState('');
  const [evidenceRefs, setEvidenceRefs] = useState('');
  const [draft, setDraft] = useState<DraftCommandResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createDraft = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetchWithCSRF('/api/command-centre/intake', {
        method: 'POST',
        body: JSON.stringify({
          source,
          speaker,
          rawText,
          evidenceRefs: evidenceRefs
            .split('\n')
            .map(ref => ref.trim())
            .filter(Boolean),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to create draft packet');
      }

      setDraft(payload);
      onDraftCreated?.(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create draft');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="border-[0.5px] border-white/[0.06] rounded-sm p-5 bg-white/[0.01]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-5">
        <div>
          <h3 className="text-sm font-medium text-white/70 uppercase tracking-widest">
            Draft Command Intake
          </h3>
          <p className="text-xs text-white/45 mt-1 max-w-2xl">
            Capture Board, client, Obsidian, Plaud, and Telegram inputs as
            review-only command packets.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 self-start border-[0.5px] border-emerald-500/25 bg-emerald-500/[0.04] px-2 py-1 text-[10px] uppercase tracking-wider text-emerald-300 rounded-sm">
          <ShieldCheck className="h-3 w-3" />
          Draft only
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] gap-4">
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1.5">
              <span className="text-[10px] uppercase tracking-wider text-white/45">
                Source
              </span>
              <select
                value={source}
                onChange={event =>
                  setSource(event.target.value as BoardInputSource)
                }
                className="w-full bg-white/[0.03] border-[0.5px] border-white/[0.08] rounded-sm px-3 py-2 text-sm text-white/75 outline-none focus:border-cyan-400/40"
              >
                {INPUT_SOURCES.map(inputSource => (
                  <option key={inputSource.value} value={inputSource.value}>
                    {inputSource.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-[10px] uppercase tracking-wider text-white/45">
                Speaker
              </span>
              <input
                value={speaker}
                onChange={event => setSpeaker(event.target.value)}
                className="w-full bg-white/[0.03] border-[0.5px] border-white/[0.08] rounded-sm px-3 py-2 text-sm text-white/75 outline-none focus:border-cyan-400/40"
              />
            </label>
          </div>

          <label className="space-y-1.5 block">
            <span className="text-[10px] uppercase tracking-wider text-white/45">
              Raw input
            </span>
            <textarea
              value={rawText}
              onChange={event => setRawText(event.target.value)}
              rows={5}
              placeholder="Paste or type the founder, Board, client, Plaud, Telegram, or Obsidian input."
              className="w-full resize-y bg-white/[0.03] border-[0.5px] border-white/[0.08] rounded-sm px-3 py-2 text-sm text-white/75 placeholder:text-white/25 outline-none focus:border-cyan-400/40"
            />
          </label>

          <label className="space-y-1.5 block">
            <span className="text-[10px] uppercase tracking-wider text-white/45">
              Evidence refs
            </span>
            <textarea
              value={evidenceRefs}
              onChange={event => setEvidenceRefs(event.target.value)}
              rows={3}
              placeholder="One wiki link, source URL, product ref, or meeting ref per line."
              className="w-full resize-y bg-white/[0.03] border-[0.5px] border-white/[0.08] rounded-sm px-3 py-2 text-sm text-white/75 placeholder:text-white/25 outline-none focus:border-cyan-400/40"
            />
          </label>

          {error && (
            <div className="flex items-start gap-2 border-[0.5px] border-red-500/20 bg-red-500/[0.04] rounded-sm p-3 text-xs text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={createDraft}
            disabled={isSubmitting || !rawText.trim() || !speaker.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-sm border-[0.5px] border-cyan-500/25 bg-cyan-500/[0.08] px-4 py-2 text-xs font-medium uppercase tracking-wider text-cyan-200 transition-colors hover:bg-cyan-500/[0.14] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FileText className="h-4 w-4" />
            {isSubmitting ? 'Creating draft' : 'Create draft packet'}
          </button>
        </div>

        <DraftPacketPreview draft={draft} />
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {HERMES_HANDOFF.sourceMap.map(sourceMap => (
          <div
            key={sourceMap.channel}
            className="border-[0.5px] border-white/[0.06] rounded-sm p-3 bg-white/[0.015]"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] uppercase tracking-widest text-white/35">
                {sourceMap.channel}
              </div>
              <span
                className={cn(
                  'border-[0.5px] px-1.5 py-0.5 rounded-sm text-[9px] uppercase tracking-wider',
                  sourceMap.mode === 'blocked'
                    ? 'border-red-500/20 text-red-300'
                    : 'border-emerald-500/20 text-emerald-300'
                )}
              >
                {sourceMap.mode.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="mt-2 text-xs text-white/65">{sourceMap.label}</div>
            <p className="mt-1 text-[11px] leading-relaxed text-white/40">
              {sourceMap.guardrail}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DraftPacketPreview({ draft }: { draft: DraftCommandResponse | null }) {
  if (!draft) {
    return (
      <div className="border-[0.5px] border-dashed border-white/[0.08] rounded-sm p-4 min-h-[320px] flex flex-col justify-center">
        <div className="text-xs uppercase tracking-widest text-white/35">
          Waiting for draft
        </div>
        <p className="text-sm text-white/50 mt-2">
          New inputs become review packets with ontology refs, team route,
          risks, and approval gate status.
        </p>
      </div>
    );
  }

  const { commandPacket, boardInput } = draft;

  return (
    <div className="border-[0.5px] border-white/[0.06] rounded-sm p-4 min-h-[320px] bg-black/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-white/35">
            Command Packet
          </div>
          <h4 className="text-sm text-white/80 mt-1 leading-snug">
            {commandPacket.title}
          </h4>
        </div>
        <span
          className={cn(
            'shrink-0 border-[0.5px] px-2 py-1 rounded-sm text-[10px] uppercase tracking-wider',
            GATE_CLASSES[commandPacket.approvalGate]
          )}
        >
          {commandPacket.approvalGate.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <Metric label="State" value={commandPacket.scenarioState} />
        <Metric label="Sensitivity" value={boardInput.sensitivity} />
      </div>

      <Section title="@team route" items={commandPacket.teamRoute} />
      <Section title="Ontology refs" items={commandPacket.ontologyRefs} />

      <div className="mt-4">
        <div className="text-[10px] uppercase tracking-widest text-white/35 mb-2">
          Gate checks
        </div>
        {commandPacket.risks.length === 0 ? (
          <div className="inline-flex items-center gap-2 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            Ready for review
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {commandPacket.risks.map(risk => (
              <span
                key={risk}
                className="border-[0.5px] border-amber-500/20 bg-amber-500/[0.04] px-2 py-1 rounded-sm text-[10px] uppercase tracking-wider text-amber-300"
              >
                {risk.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-white/[0.06] pt-3 text-xs text-white/55 leading-relaxed">
        {commandPacket.nextAction}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-[0.5px] border-white/[0.06] rounded-sm p-2">
      <div className="text-[10px] uppercase tracking-widest text-white/35">
        {label}
      </div>
      <div className="mt-1 text-white/70 text-xs">{value.replace(/_/g, ' ')}</div>
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-4">
      <div className="text-[10px] uppercase tracking-widest text-white/35 mb-2">
        {title}
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map(item => (
          <span
            key={item}
            className="border-[0.5px] border-white/[0.08] bg-white/[0.03] px-2 py-1 rounded-sm text-[10px] uppercase tracking-wider text-white/55"
          >
            {item.replace(/[-_:]/g, ' ')}
          </span>
        ))}
      </div>
    </div>
  );
}
