'use client';

import { useRef, useState, type FormEvent } from 'react';
import {
  ProposalInputSchema,
  type CaptureProposal,
} from '@/lib/opportunity-review/schema';

export const fieldClass =
  'min-h-11 w-full rounded-sm border border-white/20 bg-slate-950 px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400 disabled:opacity-50';
export const buttonClass =
  'min-h-11 rounded-sm border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400 disabled:cursor-not-allowed disabled:opacity-50';

export function isoDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : '';
}

function Field({
  label,
  name,
  multiline = false,
  type = 'text',
  maxLength = 2000,
  required = true,
}: {
  label: string;
  name: string;
  multiline?: boolean;
  type?: string;
  maxLength?: number;
  required?: boolean;
}) {
  return (
    <label className="block space-y-2 text-sm text-slate-200">
      <span>{label}</span>
      {multiline ? (
        <textarea
          className={fieldClass}
          name={name}
          required={required}
          maxLength={maxLength}
          rows={3}
        />
      ) : (
        <input
          className={fieldClass}
          name={name}
          type={type}
          required={required}
          maxLength={maxLength}
        />
      )}
    </label>
  );
}

export function ProposalCaptureForm({
  onSave,
  busy,
  onCancel,
}: {
  onSave: (capture: CaptureProposal) => Promise<boolean>;
  busy: boolean;
  onCancel: () => void;
}) {
  const [sourceCount, setSourceCount] = useState(1);
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [error, setError] = useState('');
  const retry = useRef<{ key: string; id: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? '').trim();
    const lines = (name: string) =>
      value(name)
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);
    const parsed = ProposalInputSchema.safeParse({
      title: value('title'),
      targetBusiness: value('targetBusiness'),
      targetProject: {
        name: value('projectName'),
        repository: value('repository'),
      },
      customerProblemHypothesis: value('hypothesis'),
      sources: Array.from({ length: sourceCount }, (_, i) => ({
        url: value(`source-${i}-url`),
        capturedAt: isoDate(value(`source-${i}-captured`)),
        ...(value(`source-${i}-published`)
          ? { publishedAt: isoDate(value(`source-${i}-published`)) }
          : {}),
        claims: lines(`source-${i}-claims`),
      })),
      uniteEvidence: Array.from({ length: evidenceCount }, (_, i) => ({
        reference: value(`evidence-${i}-reference`),
        observation: value(`evidence-${i}-observation`),
        capturedAt: isoDate(value(`evidence-${i}-captured`)),
      })),
      confidence:
        value('confidence') === '' ? NaN : Number(value('confidence')) / 100,
      assumptions: lines('assumptions'),
      uncertainties: lines('uncertainties'),
      suggestedOwner: value('owner'),
      kpi: {
        name: value('kpiName'),
        unit: value('kpiUnit'),
        baselineRequirement: value('baseline'),
      },
      successCriteria: value('success'),
      stopCriteria: value('stop'),
      nextValidationStep: value('validation'),
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
    const key = JSON.stringify(parsed.data);
    if (retry.current?.key !== key)
      retry.current = { key, id: crypto.randomUUID() };
    await onSave({ clientRequestId: retry.current.id, proposal: parsed.data });
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-6 rounded-sm border border-white/10 bg-white/[0.02] p-4 sm:p-6"
      aria-label="Capture opportunity proposal"
    >
      <h2 className="text-xl font-semibold">Capture a real opportunity</h2>
      <p className="text-sm text-slate-300">
        Use manually supplied sources and observations. Source claims do not
        validate demand. Dates are recorded at 00:00 UTC on the chosen day.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-200">
          {error}
        </p>
      )}
      <fieldset disabled={busy} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Proposal title" name="title" maxLength={200} />
          <Field
            label="Target business"
            name="targetBusiness"
            maxLength={200}
          />
          <Field label="Project name" name="projectName" maxLength={200} />
          <Field
            label="Repository reference (planning only)"
            name="repository"
            maxLength={200}
          />
        </div>
        <p className="text-sm text-slate-300">
          Use owner/repository. This planning reference grants no access to a
          project.
        </p>
        <Field
          label="Customer problem hypothesis"
          name="hypothesis"
          multiline
        />
        <section className="space-y-4" aria-label="Source claims">
          <h3 className="font-semibold">Sources and creator claims</h3>
          {Array.from({ length: sourceCount }, (_, i) => (
            <fieldset
              key={i}
              className="space-y-4 rounded-sm border border-white/10 p-4"
            >
              <legend className="px-2 text-sm">Source {i + 1}</legend>
              <Field
                label={`Source ${i + 1} URL`}
                name={`source-${i}-url`}
                type="url"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={`Source ${i + 1} captured date`}
                  name={`source-${i}-captured`}
                  type="date"
                />
                <Field
                  label={`Source ${i + 1} published date (optional)`}
                  name={`source-${i}-published`}
                  type="date"
                  required={false}
                />
              </div>
              <Field
                label={`Source ${i + 1} claims (one per line)`}
                name={`source-${i}-claims`}
                multiline
                maxLength={40000}
              />
            </fieldset>
          ))}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={buttonClass}
              disabled={sourceCount >= 20}
              onClick={() => setSourceCount(count => count + 1)}
            >
              Add source
            </button>
            {sourceCount > 1 && (
              <button
                type="button"
                className={buttonClass}
                onClick={() => setSourceCount(count => count - 1)}
              >
                Remove last source
              </button>
            )}
          </div>
        </section>
        <section className="space-y-4" aria-label="Separate Unite evidence">
          <h3 className="font-semibold">Unite-Group evidence</h3>
          <p className="text-sm text-slate-300">
            Keep direct business observations separate from source claims.
            Evidence can be added later, but is required before acceptance.
          </p>
          {Array.from({ length: evidenceCount }, (_, i) => (
            <fieldset
              key={i}
              className="space-y-4 rounded-sm border border-white/10 p-4"
            >
              <legend className="px-2 text-sm">Unite evidence {i + 1}</legend>
              <Field
                label={`Unite evidence ${i + 1} reference`}
                name={`evidence-${i}-reference`}
                maxLength={500}
              />
              <Field
                label={`Unite evidence ${i + 1} observation`}
                name={`evidence-${i}-observation`}
                multiline
              />
              <Field
                label={`Unite evidence ${i + 1} captured date`}
                name={`evidence-${i}-captured`}
                type="date"
              />
            </fieldset>
          ))}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={buttonClass}
              disabled={evidenceCount >= 50}
              onClick={() => setEvidenceCount(count => count + 1)}
            >
              Add Unite evidence
            </button>
            {evidenceCount > 0 && (
              <button
                type="button"
                className={buttonClass}
                onClick={() => setEvidenceCount(count => count - 1)}
              >
                Remove last Unite evidence
              </button>
            )}
          </div>
        </section>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2 text-sm text-slate-200">
            <span>Confidence (%) — operator estimate</span>
            <input
              className={fieldClass}
              name="confidence"
              type="number"
              min={0}
              max={100}
              step="any"
              required
            />
          </label>
          <Field label="Suggested owner" name="owner" maxLength={200} />
          <Field
            label="Assumptions (one per line)"
            name="assumptions"
            multiline
            maxLength={40000}
          />
          <Field
            label="Uncertainties (one per line)"
            name="uncertainties"
            multiline
            maxLength={40000}
          />
          <Field label="KPI name" name="kpiName" maxLength={200} />
          <Field label="KPI unit" name="kpiUnit" maxLength={100} />
        </div>
        <Field label="Baseline requirement" name="baseline" multiline />
        <Field label="Success criteria" name="success" multiline />
        <Field label="Stop criteria" name="stop" multiline />
        <Field label="Next validation step" name="validation" multiline />
        <div className="flex flex-wrap gap-3">
          <button type="submit" className={buttonClass}>
            {busy ? 'Saving proposal…' : 'Save proposal'}
          </button>
          <button type="button" className={buttonClass} onClick={onCancel}>
            Cancel capture
          </button>
        </div>
      </fieldset>
    </form>
  );
}
