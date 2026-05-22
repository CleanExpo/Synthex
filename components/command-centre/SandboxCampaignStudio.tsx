'use client';

import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Image,
  Lock,
  Megaphone,
  Search,
  Video,
} from '@/components/icons';
import { cn } from '@/lib/utils';
import {
  createGenMediaBrief,
  createPresentationPacket,
  evaluateProductionGate,
} from '@/lib/unite-command-center';
import type { DraftCommandResponse } from './types';

type StudioPhase = {
  id: string;
  title: string;
  detail: string;
  state: 'current' | 'next' | 'recommended' | 'complete' | 'blocked';
  Icon: typeof Search;
};

const STATE_CLASSES: Record<StudioPhase['state'], string> = {
  current: 'border-cyan-500/35 bg-cyan-500/[0.07] text-cyan-200',
  next: 'border-amber-500/35 bg-amber-500/[0.06] text-amber-200',
  recommended: 'border-violet-500/35 bg-violet-500/[0.06] text-violet-200',
  complete: 'border-emerald-500/35 bg-emerald-500/[0.06] text-emerald-200',
  blocked: 'border-red-500/35 bg-red-500/[0.06] text-red-200',
};

export function SandboxCampaignStudio({
  draft,
}: {
  draft: DraftCommandResponse | null;
}) {
  const evidenceRefs = draft?.boardInput.evidenceRefs ?? [];
  const presentation = draft
    ? createPresentationPacket({
        commandPacket: draft.commandPacket,
        evidenceRefs,
      })
    : null;
  const mediaBrief = draft
    ? createGenMediaBrief({
        commandPacket: draft.commandPacket,
        assetGate: {
          evidenceRefs,
          consentState: 'pending',
          licenseState: 'pending',
        },
      })
    : null;
  const productionGate = evaluateProductionGate({
    localTestsPassed: false,
    buildPassed: false,
    previewReady: false,
    authenticatedBrowserReviewPassed: false,
    securityReviewPassed: true,
    rollbackPathDocumented: false,
    publishSpendDefaultsDisabled: true,
    humanApprovalRecorded: false,
  });

  const phases = buildPhases(draft, presentation?.state, mediaBrief?.state);

  return (
    <section className="border-[0.5px] border-white/[0.06] bg-white/[0.015] rounded-sm p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">
            Sandbox Campaign Studio
          </div>
          <h3 className="mt-1 text-lg font-medium text-white/85">
            Idea to reviewed production packet
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/50">
            A client input becomes a draft command packet, then a research path,
            storyboard brief, asset gate, and production decision. Publishing and
            spend remain blocked until review gates pass.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="safe" label="Sandbox only" />
          <Badge tone="blocked" label="No public publish" />
          <Badge tone="blocked" label="No ad spend" />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)] gap-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          {phases.map((phase, index) => (
            <PhaseCard
              key={phase.id}
              phase={phase}
              showArrow={index < phases.length - 1}
            />
          ))}
        </div>

        <div className="border-[0.5px] border-white/[0.06] rounded-sm bg-black/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-white/35">
                Production Gate
              </div>
              <div className="mt-1 text-sm text-white/75">
                {productionGate.allowed ? 'Ready for approval' : 'Blocked'}
              </div>
            </div>
            <Lock className="h-5 w-5 text-red-300" />
          </div>

          <div className="mt-4 space-y-2">
            {(draft
              ? productionGate.blockers
              : ['draft_packet_missing', ...productionGate.blockers]
            ).slice(0, 5).map(blocker => (
              <div
                key={blocker}
                className="flex items-center gap-2 text-xs text-white/55"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-red-300/70" />
                {blocker.replace(/_/g, ' ')}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
        <StudioSignal
          title="Research Grounding"
          value={draft ? draft.commandPacket.ontologyRefs.length : 0}
          label="ontology refs"
          empty="Create a packet to map the source data."
        />
        <StudioSignal
          title="Presentation Pack"
          value={presentation?.slides.length ?? 0}
          label={presentation?.state ?? 'waiting'}
          empty="Storyboard slides appear after intake."
        />
        <StudioSignal
          title="Gen Media Brief"
          value={mediaBrief?.requiredAssets.length ?? 0}
          label={mediaBrief?.productionMode ?? 'waiting'}
          empty="Asset requirements appear after intake."
        />
      </div>
    </section>
  );
}

function buildPhases(
  draft: DraftCommandResponse | null,
  presentationState?: 'draft' | 'blocked',
  mediaState?: 'draft' | 'blocked'
): StudioPhase[] {
  const hasDraft = Boolean(draft);
  return [
    {
      id: 'idea',
      title: 'Idea intake',
      detail: hasDraft ? 'Captured as a command packet.' : 'Capture the client idea.',
      state: hasDraft ? 'complete' : 'current',
      Icon: Megaphone,
    },
    {
      id: 'research',
      title: 'Research map',
      detail: hasDraft ? 'Ontology and team route generated.' : 'Ground claims in wiki and sources.',
      state: hasDraft ? 'complete' : 'recommended',
      Icon: Search,
    },
    {
      id: 'storyboard',
      title: 'Storyboard',
      detail:
        presentationState === 'draft'
          ? 'Review deck can be drafted.'
          : 'Needs evidence before export.',
      state: presentationState === 'draft' ? 'complete' : hasDraft ? 'next' : 'recommended',
      Icon: FileText,
    },
    {
      id: 'assets',
      title: 'Assets',
      detail:
        mediaState === 'draft'
          ? 'Media brief is ready.'
          : 'Consent and licence gates remain pending.',
      state: mediaState === 'draft' ? 'complete' : hasDraft ? 'next' : 'recommended',
      Icon: Image,
    },
    {
      id: 'production',
      title: 'Production',
      detail: 'Remotion, HeyGen, and publishing stay gated.',
      state: 'blocked',
      Icon: Video,
    },
  ];
}

function PhaseCard({
  phase,
  showArrow,
}: {
  phase: StudioPhase;
  showArrow: boolean;
}) {
  const Icon = phase.Icon;
  return (
    <div className="relative min-h-[148px] rounded-sm border-[0.5px] border-white/[0.06] bg-black/10 p-3">
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-sm border-[0.5px]',
            STATE_CLASSES[phase.state]
          )}
        >
          {phase.state === 'complete' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Icon className="h-4 w-4" />
          )}
        </span>
        {showArrow && (
          <ArrowRight className="hidden md:block h-4 w-4 text-white/25 mt-2 -mr-4" />
        )}
      </div>
      <div className="mt-4 text-sm font-medium text-white/78">{phase.title}</div>
      <p className="mt-2 text-xs leading-relaxed text-white/45">{phase.detail}</p>
      <div
        className={cn(
          'mt-3 inline-flex rounded-sm border-[0.5px] px-2 py-1 text-[9px] uppercase tracking-wider',
          STATE_CLASSES[phase.state]
        )}
      >
        {phase.state}
      </div>
    </div>
  );
}

function StudioSignal({
  title,
  value,
  label,
  empty,
}: {
  title: string;
  value: number;
  label: string;
  empty: string;
}) {
  return (
    <div className="rounded-sm border-[0.5px] border-white/[0.06] bg-black/10 p-4">
      <div className="text-[10px] uppercase tracking-widest text-white/35">
        {title}
      </div>
      {value > 0 ? (
        <div className="mt-2 flex items-end gap-2">
          <span className="text-2xl font-medium text-white/85">{value}</span>
          <span className="pb-1 text-xs uppercase tracking-wider text-white/45">
            {label.replace(/_/g, ' ')}
          </span>
        </div>
      ) : (
        <p className="mt-2 text-xs leading-relaxed text-white/45">{empty}</p>
      )}
    </div>
  );
}

function Badge({ tone, label }: { tone: 'safe' | 'blocked'; label: string }) {
  return (
    <span
      className={cn(
        'rounded-sm border-[0.5px] px-2.5 py-1 text-[10px] uppercase tracking-wider',
        tone === 'safe'
          ? 'border-emerald-500/25 bg-emerald-500/[0.04] text-emerald-300'
          : 'border-red-500/25 bg-red-500/[0.04] text-red-300'
      )}
    >
      {label}
    </span>
  );
}
