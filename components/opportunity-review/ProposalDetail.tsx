'use client';

import { useState, type ReactNode } from 'react';
import {
  ReviewActionSchema,
  type ProposalRecord,
  type ReviewAction,
} from '@/lib/opportunity-review/schema';
import { buttonClass, fieldClass, isoDate } from './ProposalCaptureForm';

export const reviewLabels: Record<ProposalRecord['review']['state'], string> = {
  pending: 'Pending review',
  accepted: 'Accepted',
  rejected: 'Rejected',
  evidence_requested: 'Evidence requested',
};

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-sm text-slate-300">{label}</dt>
      <dd className="whitespace-pre-wrap break-words text-sm text-white">
        {children}
      </dd>
    </div>
  );
}

export function ProposalDetail({
  item,
  busy,
  onReview,
  onExport,
}: {
  item: ProposalRecord;
  busy: boolean;
  onReview: (review: ReviewAction) => Promise<void>;
  onExport: () => Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [reference, setReference] = useState('');
  const [observation, setObservation] = useState('');
  const [capturedDate, setCapturedDate] = useState('');
  const [error, setError] = useState('');
  const p = item.proposal;

  function review(action: ReviewAction['action']) {
    const parsed = ReviewActionSchema.safeParse({
      id: item.id,
      expectedRevision: item.revision,
      action,
      note,
      ...(action === 'add-evidence'
        ? {
            uniteEvidence: [
              { reference, observation, capturedAt: isoDate(capturedDate) },
            ],
          }
        : {}),
    });
    if (!parsed.success) {
      setError(
        parsed.error.issues
          .map(issue => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ')
      );
      return;
    }
    setError('');
    void onReview(parsed.data);
  }

  return (
    <article
      className="min-w-0 space-y-6 rounded-sm border border-white/10 bg-white/[0.02] p-4 sm:p-6"
      aria-label="Proposal detail"
    >
      <header className="space-y-2">
        <h2 className="text-xl font-semibold">{p.title}</h2>
        <p className="text-sm text-orange-200">
          {reviewLabels[item.review.state]}
        </p>
        <p className="text-sm text-slate-300">
          Revision {item.revision} · Created {item.createdAt} · Updated{' '}
          {item.updatedAt}
        </p>
      </header>
      <p className="rounded-sm border border-orange-400/30 bg-orange-500/10 p-4 text-sm text-orange-100">
        Blocked forecast handoff · AUD 0 spend boundary. Demand and revenue
        remain unvalidated. Acceptance and export authorise no execution,
        provider activation or spending.
      </p>
      <dl className="grid gap-4 sm:grid-cols-2">
        <Detail label="Target business">{p.targetBusiness}</Detail>
        <Detail label="Target project (planning reference)">
          {p.targetProject.name} · {p.targetProject.repository}
        </Detail>
        <Detail label="Customer problem hypothesis">
          {p.customerProblemHypothesis}
        </Detail>
        <Detail label="Confidence (operator estimate)">
          {Math.round(p.confidence * 100)}% · Demand unvalidated
        </Detail>
        <Detail label="Assumptions">{p.assumptions.join('\n')}</Detail>
        <Detail label="Uncertainties">{p.uncertainties.join('\n')}</Detail>
        <Detail label="Suggested owner">{p.suggestedOwner}</Detail>
        <Detail label="KPI">
          {p.kpi.name} · {p.kpi.unit}
        </Detail>
        <Detail label="Baseline requirement">
          {p.kpi.baselineRequirement}
        </Detail>
        <Detail label="Success criteria">{p.successCriteria}</Detail>
        <Detail label="Stop criteria">{p.stopCriteria}</Detail>
        <Detail label="Next validation step">{p.nextValidationStep}</Detail>
      </dl>
      <section className="space-y-3" aria-label="Captured source claims">
        <h3 className="font-semibold">Sources and creator claims</h3>
        {p.sources.map((source, i) => (
          <div
            key={i}
            className="space-y-2 rounded-sm border border-white/10 p-4 text-sm"
          >
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-orange-200 underline"
            >
              {source.url}
            </a>
            <p className="text-slate-300">
              Captured {source.capturedAt}
              {source.publishedAt
                ? ` · Published ${source.publishedAt}`
                : ' · Publication date not supplied'}
            </p>
            <ul className="list-inside list-disc space-y-1 whitespace-pre-wrap break-words">
              {source.claims.map((claim, j) => (
                <li key={j}>{claim}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>
      <section className="space-y-3" aria-label="Captured Unite evidence">
        <h3 className="font-semibold">Separate Unite-Group evidence</h3>
        {p.uniteEvidence.length === 0 && (
          <p className="text-sm text-slate-300">
            Add separate Unite-Group evidence before acceptance.
          </p>
        )}
        {p.uniteEvidence.map((evidence, i) => (
          <div
            key={i}
            className="space-y-2 rounded-sm border border-white/10 p-4 text-sm"
          >
            <p className="whitespace-pre-wrap break-words">
              {evidence.reference}
            </p>
            <p className="whitespace-pre-wrap break-words">
              {evidence.observation}
            </p>
            <p className="text-slate-300">Captured {evidence.capturedAt}</p>
          </div>
        ))}
      </section>
      {item.review.note && (
        <dl>
          <Detail label="Latest review note">
            {item.review.note}
            {item.review.reviewedAt && `\nReviewed ${item.review.reviewedAt}`}
          </Detail>
        </dl>
      )}
      {item.review.state === 'rejected' ? (
        <p className="text-sm text-slate-300">
          This proposal is rejected. Further review and export are blocked.
        </p>
      ) : (
        <section className="space-y-4" aria-label="Review decisions">
          <h3 className="font-semibold">Review decision</h3>
          {item.review.state === 'evidence_requested' && (
            <p className="text-sm text-orange-200">
              Add new, nonduplicate evidence to resolve this request, then
              explicitly accept the proposal.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-200">
              {error}
            </p>
          )}
          <fieldset disabled={busy} className="space-y-4">
            <label className="block space-y-2 text-sm">
              <span>Review note</span>
              <textarea
                className={fieldClass}
                maxLength={2000}
                value={note}
                onChange={event => setNote(event.target.value)}
                rows={3}
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                className={buttonClass}
                disabled={
                  item.review.state === 'evidence_requested' ||
                  p.uniteEvidence.length === 0 ||
                  item.review.state === 'accepted'
                }
                onClick={() => review('accept')}
              >
                Accept for blocked handoff
              </button>
              <button className={buttonClass} onClick={() => review('reject')}>
                Reject proposal
              </button>
              <button
                className={buttonClass}
                onClick={() => review('request-evidence')}
              >
                Request evidence
              </button>
            </div>
            <fieldset className="space-y-4 rounded-sm border border-white/10 p-4">
              <legend className="px-2 text-sm">
                Additional Unite-Group evidence
              </legend>
              <label className="block space-y-2 text-sm">
                <span>Additional evidence reference</span>
                <input
                  className={fieldClass}
                  maxLength={500}
                  value={reference}
                  onChange={event => setReference(event.target.value)}
                />
              </label>
              <label className="block space-y-2 text-sm">
                <span>Additional evidence observation</span>
                <textarea
                  className={fieldClass}
                  maxLength={2000}
                  value={observation}
                  onChange={event => setObservation(event.target.value)}
                  rows={3}
                />
              </label>
              <label className="block space-y-2 text-sm">
                <span>Additional evidence captured date</span>
                <input
                  type="date"
                  className={fieldClass}
                  value={capturedDate}
                  onChange={event => setCapturedDate(event.target.value)}
                />
              </label>
              <button
                className={buttonClass}
                disabled={p.uniteEvidence.length >= 50}
                onClick={() => review('add-evidence')}
              >
                Add evidence
              </button>
            </fieldset>
          </fieldset>
        </section>
      )}
      {item.review.state === 'accepted' && (
        <section className="space-y-3" aria-label="Nexus export">
          <p className="text-sm text-slate-300">
            Download the version 1 bundle, then import it manually into Nexus
            for blocked forecasting review.
          </p>
          <button
            className={buttonClass}
            disabled={busy}
            onClick={() => void onExport()}
          >
            Download Nexus v1 export
          </button>
        </section>
      )}
    </article>
  );
}
