'use client';

import { useMemo, useState, type FormEvent } from 'react';
import {
  BadgeCheck,
  Download,
  Loader2,
  Send,
  Shield,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type {
  GoalContract,
  VisionMap,
  WorkPacket,
} from '@/lib/intentscape/contracts';
import { buildMarketingExtenderBrief } from './marketing-extender';

interface MarketingExtenderHandoffProps {
  originSignal: string;
  visionMap: VisionMap;
  goalContract: GoalContract;
  workPacket: WorkPacket;
}

export function MarketingExtenderHandoff({
  originSignal,
  visionMap,
  goalContract,
  workPacket,
}: MarketingExtenderHandoffProps) {
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const brief = useMemo(
    () =>
      buildMarketingExtenderBrief({
        originSignal,
        visionMap,
        goalContract,
        workPacket,
      }),
    [goalContract, originSignal, visionMap, workPacket]
  );

  function downloadBrief() {
    const blob = new Blob([brief], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'synthex-idea-explorer-brief.md';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!consent) {
      setError(
        'Confirm that you want the Synthex strategy team to review this brief.'
      );
      return;
    }
    setBusy(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const response = await fetch('/api/internal/sign-lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contactMethod: 'form_submission',
          source: params.get('utm_source') ?? 'intentscape',
          medium: params.get('utm_medium') ?? 'free-tool',
          campaign: params.get('utm_campaign') ?? 'marketing-extender',
          occurredAt: new Date().toISOString(),
          capturedFrom: 'intentscape-marketing-extender',
          rawPayload: {
            email,
            businessName,
            intentscape: {
              briefVersion: 'marketing-extender-v1',
              workspaceId: workPacket.workspaceId,
              originSignal,
              goal: workPacket.goal,
              selectedHypothesisId: goalContract.hypothesisId,
              contextVersion: visionMap.contextVersion,
              briefMarkdown: brief,
              consentToNexusReview: true,
            },
          },
        }),
      });
      if (!response.ok) throw new Error('The handoff could not be completed.');
      setSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Handoff failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-5 overflow-hidden rounded-card border border-sx-accent/20 bg-sx-bg-panel shadow-[var(--sx-shadow-elevated)]">
      <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
        <div className="border-b border-white/[0.08] p-5 lg:border-b-0 lg:border-r lg:p-7">
          <div className="flex items-center gap-2 text-sx-accent">
            <BadgeCheck className="h-4 w-4" />
            <p className="font-mono text-xs uppercase tracking-[0.2em]">
              Your useful result
            </p>
          </div>
          <h2 className="mt-2 font-[var(--font-space-grotesk)] text-2xl text-sx-text-primary">
            Keep the vision brief without giving us your details.
          </h2>
          <p className="mt-2 text-sm leading-6 text-sx-text-muted">
            The Markdown file preserves your signal, expanded direction, success
            criteria and approval limits. It is yours whether or not you contact
            the Synthex strategy team.
          </p>
          <Button
            type="button"
            variant="premium-primary"
            size="xl"
            onClick={downloadBrief}
            className="mt-5 min-h-11"
          >
            <Download className="h-4 w-4" />
            Download my vision brief
          </Button>
        </div>

        <form onSubmit={submit} className="space-y-4 p-5 lg:p-7">
          <div className="flex items-center gap-2 text-sx-intelligence">
            <Shield className="h-4 w-4" />
            <p className="font-mono text-xs uppercase tracking-[0.2em]">
              Optional strategy handoff
            </p>
          </div>
          <h2 className="font-[var(--font-space-grotesk)] text-xl text-sx-text-primary">
            Put the whole idea in front of a strategist.
          </h2>
          <p className="text-sm leading-6 text-sx-text-muted">
            No retyping. The Synthex strategy team receives the same brief you
            reviewed here.
          </p>

          {sent ? (
            <div className="rounded-btn border border-sx-success/25 bg-sx-success/[0.06] p-5 text-sm text-sx-text-secondary">
              <BadgeCheck className="mb-3 h-5 w-5 text-sx-success" />
              Your brief has been sent to the Synthex strategy team for review.
            </div>
          ) : (
            <>
              <label className="block text-sm text-sx-text-secondary">
                Business or project name
                <Input
                  required
                  value={businessName}
                  onChange={event => setBusinessName(event.target.value)}
                  maxLength={200}
                  className="mt-2 min-h-11 border-white/[0.1] bg-sx-bg-primary/70"
                />
              </label>
              <label className="block text-sm text-sx-text-secondary">
                Email
                <Input
                  required
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  maxLength={254}
                  className="mt-2 min-h-11 border-white/[0.1] bg-sx-bg-primary/70"
                />
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-btn border border-white/[0.08] bg-white/[0.025] p-3 text-xs leading-5 text-sx-text-muted">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={event => setConsent(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-[var(--sx-accent)]"
                />
                Share this brief and my contact details with the Synthex
                strategy team, operated by Unite-Group, for review.
              </label>
              {error && (
                <p role="alert" className="text-sm text-rose-300">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                variant="glass-primary"
                size="xl"
                disabled={busy}
                className="min-h-11 w-full"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send to the Synthex strategy team
              </Button>
            </>
          )}
        </form>
      </div>
    </section>
  );
}
