'use client';

/**
 * OutreachPanel — Outreach email editor and tracker (Phase 95)
 *
 * Renders a pre-filled email template for the selected opportunity type.
 * No actual email sending — shows draft for user to copy and send manually.
 *
 * @module components/backlinks/OutreachPanel
 */

import { useState, useEffect } from 'react';
import { Check, Copy, Mail, X } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { BacklinkOpportunityType, OutreachDraft, ScoredProspect, BrandIdentityBrief } from '@/lib/backlinks/types';
import { OPPORTUNITY_TYPE_LABELS } from '@/lib/backlinks/outreach-templates';
import type { ProspectCardData } from './BacklinkProspectCard';

// ─── Props ─────────────────────────────────────────────────────────────────

export interface OutreachPanelProps {
  prospect: ProspectCardData | null;
  brandName: string;
  brandWebsiteUrl?: string;
  onClose: () => void;
  onOutreachSaved: () => void;
}

// ─── Helper: generate template on the client (mirrors server logic) ──────────

function buildClientTemplate(
  type: BacklinkOpportunityType,
  prospect: ProspectCardData,
  brandName: string,
  brandUrl: string
): OutreachDraft {
  const brand: BrandIdentityBrief = {
    name: brandName,
    description: `${brandName} is an AI-powered marketing automation platform.`,
    websiteUrl: brandUrl,
  };

  // Build a minimal ScoredProspect for the template
  const scoredProspect: ScoredProspect = {
    url: prospect.targetUrl,
    domain: prospect.targetDomain,
    title: prospect.targetDomain,
    snippet: '',
    opportunityType: type,
    domainAuthority: prospect.domainAuthority ?? 30,
    pageRank: prospect.pageRank ?? 0,
    authorityTier: (prospect.domainAuthority ?? 0) >= 70 ? 'high' : (prospect.domainAuthority ?? 0) >= 40 ? 'medium' : 'low',
    outreachEmail: prospect.outreachEmail ?? undefined,
  };

  // Inline the templates here to avoid importing server-only code
  const subjectByType: Record<BacklinkOpportunityType, string> = {
    'resource-page':      `Resource page suggestion for ${prospect.targetDomain}`,
    'guest-post':         `Guest post pitch for ${prospect.targetDomain}`,
    'broken-link':        `Broken link found on ${prospect.targetDomain}`,
    'competitor-link':    `Alternative resource recommendation for ${prospect.targetDomain}`,
    'journalist-mention': `Re: your content on ${prospect.targetDomain}`,
  };

  const bodyLines: Record<BacklinkOpportunityType, string[]> = {
    'resource-page': [
      'Hi there,',
      '',
      `I came across your resource page at ${scoredProspect.url} and noticed you've curated some excellent links for your readers.`,
      '',
      `I wanted to suggest a resource that might be a great fit: ${brand.name} (${brand.websiteUrl}).`,
      '',
      brand.description,
      '',
      'I think it would be a valuable addition to your list. Happy to provide more detail if helpful.',
      '',
      'Best regards,',
      '[Your Name]',
      brand.name,
      brand.websiteUrl,
    ],
    'guest-post': [
      'Hi there,',
      '',
      `I'm a regular reader of ${prospect.targetDomain} and really enjoy the quality of content you publish.`,
      '',
      `I noticed you accept guest contributions and I'd love to write for your audience. ${brand.description}`,
      '',
      'Some article ideas I had in mind:',
      '1. [Article idea 1 — specific, actionable, fits their audience]',
      '2. [Article idea 2 — data-driven, with original insights]',
      '3. [Article idea 3 — how-to guide relevant to their niche]',
      '',
      'All articles would be 100% original and tailored specifically to your audience.',
      '',
      'Would you be open to reviewing a full pitch?',
      '',
      'Best regards,',
      '[Your Name]',
      brand.name,
      brand.websiteUrl,
    ],
    'broken-link': [
      'Hi there,',
      '',
      `I was browsing ${scoredProspect.url} and noticed a broken link that might be affecting your readers' experience.`,
      '',
      `I have content on ${brand.websiteUrl} that covers the same topic and would be a great replacement.`,
      '',
      brand.description,
      '',
      'Happy to send through more details. Fixing broken links is usually a quick win for user experience!',
      '',
      'Best regards,',
      '[Your Name]',
      brand.name,
      brand.websiteUrl,
    ],
    'competitor-link': [
      'Hi there,',
      '',
      `I noticed your page at ${scoredProspect.url} links to some tools and resources in this space.`,
      '',
      `I wanted to introduce ${brand.name} as another option your readers might find valuable.`,
      '',
      brand.description,
      '',
      `You can see it in action at ${brand.websiteUrl}.`,
      '',
      'Would you be open to adding it to your list?',
      '',
      'Best regards,',
      '[Your Name]',
      brand.name,
      brand.websiteUrl,
    ],
    'journalist-mention': [
      'Hi there,',
      '',
      `I really enjoyed your coverage at ${scoredProspect.url}.`,
      '',
      `I'm reaching out because ${brand.name} is doing something relevant to what you covered. ${brand.description}`,
      '',
      'I have some fresh data/insights on this topic that might be useful for a follow-up.',
      '',
      'Happy to offer an exclusive data cut, a briefing call, or access to a spokesperson.',
      '',
      'Best regards,',
      '[Your Name]',
      brand.name,
      brand.websiteUrl,
    ],
  };

  return {
    subject: subjectByType[type],
    body: bodyLines[type].join('\n'),
    recipientEmail: prospect.outreachEmail ?? '',
    opportunityType: type,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function OutreachPanel({
  prospect,
  brandName,
  brandWebsiteUrl = '',
  onClose,
  onOutreachSaved,
}: OutreachPanelProps) {
  const [selectedType, setSelectedType] = useState<BacklinkOpportunityType>(
    (prospect?.opportunityType as BacklinkOpportunityType) ?? 'resource-page'
  );
  const [subject, setSubject]     = useState('');
  const [body, setBody]           = useState('');
  const [toEmail, setToEmail]     = useState('');
  const [copied, setCopied]       = useState(false);
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved]         = useState(false);

  // Re-generate template when prospect or type changes
  useEffect(() => {
    if (!prospect) return;
    const draft = buildClientTemplate(selectedType, prospect, brandName, brandWebsiteUrl);
    setSubject(draft.subject);
    setBody(draft.body);
    setToEmail(prospect.outreachEmail ?? '');
    setSelectedType((prospect.opportunityType as BacklinkOpportunityType) ?? 'resource-page');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospect?.id]);

  useEffect(() => {
    if (!prospect) return;
    const draft = buildClientTemplate(selectedType, prospect, brandName, brandWebsiteUrl);
    setSubject(draft.subject);
    setBody(draft.body);
  }, [selectedType, prospect, brandName, brandWebsiteUrl]);

  async function handleCopy() {
    const text = `To: ${toEmail}\nSubject: ${subject}\n\n${body}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function handleMarkContacted() {
    if (!prospect) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/backlinks/outreach', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospectId:    prospect.id,
          orgId:         'default',
          outreachEmail: toEmail || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSaveError(data.error ?? 'Failed to save');
        return;
      }
      setSaved(true);
      onOutreachSaved();
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setSaveError('Network error — please try again');
    } finally {
      setSaving(false);
    }
  }

  if (!prospect) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-slate-500">
        Select a prospect to generate an outreach email.
      </div>
    );
  }

  const typeOptions = Object.entries(OPPORTUNITY_TYPE_LABELS) as [BacklinkOpportunityType, string][];

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Outreach Email</h3>
          <p className="text-xs text-slate-400 mt-0.5">{prospect.targetDomain}</p>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Template selector */}
      <div className="mb-3">
        <label className="block text-xs text-slate-400 mb-1">Template type</label>
        <select
          value={selectedType}
          onChange={e => setSelectedType(e.target.value as BacklinkOpportunityType)}
          className="w-full rounded-lg bg-white/8 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {typeOptions.map(([val, label]) => (
            <option key={val} value={val} className="bg-slate-900">{label}</option>
          ))}
        </select>
      </div>

      {/* To email */}
      <div className="mb-3">
        <label className="block text-xs text-slate-400 mb-1">To</label>
        <input
          type="email"
          value={toEmail}
          onChange={e => setToEmail(e.target.value)}
          placeholder="recipient@example.com"
          className="w-full rounded-lg bg-white/8 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-600"
        />
      </div>

      {/* Subject */}
      <div className="mb-3">
        <label className="block text-xs text-slate-400 mb-1">Subject</label>
        <input
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          className="w-full rounded-lg bg-white/8 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Body */}
      <div className="mb-4">
        <label className="block text-xs text-slate-400 mb-1">Body</label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={12}
          className="w-full rounded-lg bg-white/8 border border-white/10 text-white text-sm px-3 py-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
        />
      </div>

      {saveError && (
        <p className="mb-3 text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded-lg px-3 py-2">
          {saveError}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleCopy}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors',
            copied
              ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700/40'
              : 'bg-white/8 text-slate-300 border-white/10 hover:bg-white/15'
          )}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied!' : 'Copy to clipboard'}
        </button>

        <button
          onClick={handleMarkContacted}
          disabled={saving || saved || prospect.status === 'published'}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors',
            saved
              ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700/40'
              : 'bg-blue-900/40 text-blue-300 border-blue-700/40 hover:bg-blue-900/70 disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <Mail className="h-3.5 w-3.5" />
          {saving ? 'Saving…' : saved ? 'Marked Contacted' : 'Mark as Contacted'}
        </button>
      </div>
    </div>
  );
}
