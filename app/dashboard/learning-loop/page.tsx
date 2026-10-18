'use client';

/**
 * Learning loop — /dashboard/learning-loop?experimentId=…
 *
 * One screen for the whole chain: the need and hypothesis, the challenge, the
 * authorised experiment, the observed outcome (with data class and
 * uncertainty), the rule-based recommendation, and the owner's decision.
 */
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type Json = Record<string, any>;

const pct = (x: number | null | undefined) =>
  x === null || x === undefined ? '—' : `${Math.round(x * 100)}%`;

export default function LearningLoopPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6" aria-busy="true">
          Loading…
        </div>
      }
    >
      <LearningLoop />
    </Suspense>
  );
}

function LearningLoop() {
  const params = useSearchParams();
  const experimentId =
    params.get('experimentId') ?? 'exp-white-rabbit-front-door';
  const [loop, setLoop] = useState<Json | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dataClass, setDataClass] = useState('preview');
  const [form, setForm] = useState({
    decision: 'continue_observing',
    rationale: '',
    nextDecision: '',
  });
  const [notice, setNotice] = useState<string | null>(null);
  // One request at a time: a decision must never bind to a recommendation that a
  // snapshot in flight is about to supersede.
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/learning-loop?experimentId=${encodeURIComponent(experimentId)}`
    );
    const body = await res.json();
    if (!res.ok) {
      setError(body.message ?? body.error ?? `Request failed (${res.status})`);
      setLoop(null);
    } else {
      setError(null);
      setLoop(body);
    }
  }, [experimentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const observe = async () => {
    setBusy(true);
    const res = await fetch('/api/learning-loop/observe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ experimentId, dataClass }),
    });
    setNotice(
      res.ok ? 'Outcome snapshot recorded.' : `Snapshot failed (${res.status}).`
    );
    await load();
    setBusy(false);
  };

  const latestRec = loop?.recommendations?.at(-1);
  const decide = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/learning-loop/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        experimentId,
        recommendationEventId: latestRec?.id,
        ...form,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setNotice(
      res.ok
        ? 'Decision recorded.'
        : `Decision refused: ${body.message ?? body.error ?? res.status}`
    );
    await load();
    setBusy(false);
  };

  if (error)
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Learning loop</h1>
        <p role="alert" className="mt-4">
          {error}
        </p>
      </div>
    );
  if (!loop)
    return (
      <div className="p-6" aria-busy="true">
        Loading…
      </div>
    );

  const rec = loop.experiment.record;
  const latest = loop.outcomes.at(-1);
  return (
    <div
      data-testid="learning-loop"
      className="mx-auto max-w-4xl space-y-6 p-6"
    >
      <h1 className="text-2xl font-bold">Learning loop: {experimentId}</h1>
      {notice && (
        <p role="status" className="rounded bg-slate-100 p-3 text-slate-900">
          {notice}
        </p>
      )}

      <section aria-labelledby="h1" className="space-y-1">
        <h2 id="h1" className="text-lg font-semibold">
          1. Customer need and hypothesis
        </h2>
        <p>
          <strong>Customer benefit:</strong> {rec.customerBenefit}
        </p>
        <p>
          <strong>Hypothesis:</strong>{' '}
          {loop.hypothesis?.title ?? rec.hypothesis}
        </p>
        <p>
          <strong>Baseline / comparison:</strong> {rec.baseline} /{' '}
          {rec.comparison}
        </p>
      </section>

      <section aria-labelledby="h2" className="space-y-1">
        <h2 id="h2" className="text-lg font-semibold">
          2. Challenge
        </h2>
        <p>
          <strong>What would prove it wrong:</strong>{' '}
          {loop.hypothesis?.invalidatingAssumption ?? '—'}
        </p>
        <p>
          <strong>Main risk:</strong> {loop.hypothesis?.mainRisk ?? '—'}
        </p>
      </section>

      <section aria-labelledby="h3" className="space-y-1">
        <h2 id="h3" className="text-lg font-semibold">
          3. Authorised experiment
        </h2>
        <p>
          <strong>Goal contract:</strong> {loop.goalContract?.id} (approved by{' '}
          {loop.goalContract?.approvedBy})
        </p>
        <p>
          <strong>Owner:</strong> {rec.owner} · <strong>Approval:</strong>{' '}
          {rec.approvalReference}
        </p>
        <p>
          <strong>Success measure:</strong> {rec.successMeasure}
        </p>
        <p>
          <strong>Observation period:</strong> {rec.observationPeriod?.start} to{' '}
          {rec.observationPeriod?.end}
        </p>
        <p>
          <strong>Stop conditions:</strong>{' '}
          {(rec.stopConditions ?? []).join('; ')}
        </p>
        <p>
          <strong>Pilot:</strong>{' '}
          {rec.pilotStatus === 'launched'
            ? 'launched'
            : 'not launched — events are preview data, not customer results'}
        </p>
        <p>
          <strong>Delivery cost:</strong> {rec.deliveryCost}
        </p>
      </section>

      <section aria-labelledby="h4" className="space-y-2">
        <h2 id="h4" className="text-lg font-semibold">
          4. Observed outcome
        </h2>
        <p>
          Card events recorded: {loop.cardEvents.total} (synthetic{' '}
          {loop.cardEvents.byDataClass.synthetic}, preview{' '}
          {loop.cardEvents.byDataClass.preview}, pilot{' '}
          {loop.cardEvents.byDataClass.pilot})
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="dc">Data class</label>
          <select
            id="dc"
            value={dataClass}
            onChange={e => setDataClass(e.target.value)}
            className="rounded border bg-white p-1 text-slate-900"
          >
            <option value="preview">preview</option>
            <option value="synthetic">synthetic</option>
            <option value="pilot">pilot</option>
          </select>
          <button
            onClick={observe}
            disabled={busy}
            className="rounded bg-slate-900 px-3 py-1 text-white disabled:opacity-60"
          >
            Snapshot outcome
          </button>
        </div>
        {latest && (
          <div data-testid="outcome">
            <p>
              <strong>{latest.summary.dataClass}</strong> data · claim:{' '}
              <strong>{latest.summary.claim}</strong> ·{' '}
              {latest.summary.sessions} sessions · rows read{' '}
              {latest.provenance.rowsRead} · revision{' '}
              {latest.provenance.revision}
            </p>
            <table className="mt-2 w-full border-separate border-spacing-x-3 border-spacing-y-1 text-left text-sm">
              <thead>
                <tr>
                  <th>Variant</th>
                  <th>Sessions</th>
                  <th>Useful answers</th>
                  <th>Useful rate (95% interval)</th>
                  <th>Confused</th>
                  <th>Access issues</th>
                  <th>Qualified next steps</th>
                  <th>Diagnostics (saves / links / shares)</th>
                </tr>
              </thead>
              <tbody>
                {latest.summary.variants.map((v: Json) => (
                  <tr key={v.variant}>
                    <td>{v.variant}</td>
                    <td>{v.sessions}</td>
                    <td>{v.useful}</td>
                    <td>
                      {pct(v.usefulRate.rate)} ({pct(v.usefulRate.low)}–
                      {pct(v.usefulRate.high)})
                    </td>
                    <td>{v.confusionReports}</td>
                    <td>{v.accessibilityIssues}</td>
                    <td>{v.qualifiedNextSteps}</td>
                    <td>
                      {v.diagnostics.contactSaved} /{' '}
                      {v.diagnostics.brandLinksOpened} / {v.diagnostics.shared}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {latest.summary.missingData.length > 0 && (
              <p>
                <strong>Missing data:</strong>{' '}
                {latest.summary.missingData.join('; ')}
              </p>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="h5" className="space-y-1">
        <h2 id="h5" className="text-lg font-semibold">
          5. Recommendation (rules, not a decision)
        </h2>
        {latestRec ? (
          <div data-testid="recommendation">
            <p>
              <strong>{latestRec.verdict}</strong> —{' '}
              {latestRec.reasons.join('; ')}
            </p>
            {latestRec.stopConditionsHit.length > 0 && (
              <p>
                Stop conditions hit: {latestRec.stopConditionsHit.join('; ')}
              </p>
            )}
            <p>Needs a decision from: {latestRec.requiredAuthority}</p>
          </div>
        ) : (
          <p>No recommendation yet. Snapshot an outcome first.</p>
        )}
      </section>

      <section aria-labelledby="h6" className="space-y-2">
        <h2 id="h6" className="text-lg font-semibold">
          6. Human decision
        </h2>
        {loop.decisions.map((d: Json) => (
          <p key={d.id} data-testid="decision">
            {new Date(d.at).toLocaleString('en-AU')}:{' '}
            <strong>{d.decision}</strong> (recommended {d.recommended}) —{' '}
            {d.rationale.replace(/\.$/, '')}. Next: {d.nextDecision}
          </p>
        ))}
        {latestRec && loop.viewerRole === 'owner' && (
          <form onSubmit={decide} className="space-y-2" aria-busy={busy}>
            <p data-testid="deciding-on">
              Deciding on the recommendation of{' '}
              {new Date(latestRec.at).toLocaleString('en-AU')}:{' '}
              <strong>{latestRec.verdict}</strong>
            </p>
            <label className="block">
              Decision
              <select
                value={form.decision}
                onChange={e => setForm({ ...form, decision: e.target.value })}
                className="ml-2 rounded border bg-white p-1 text-slate-900"
              >
                <option value="keep">keep</option>
                <option value="revise">revise</option>
                <option value="stop">stop</option>
                <option value="continue_observing">continue observing</option>
              </select>
            </label>
            <label className="block">
              Rationale
              <textarea
                required
                minLength={10}
                value={form.rationale}
                onChange={e => setForm({ ...form, rationale: e.target.value })}
                className="block w-full rounded border bg-white p-2 text-slate-900"
              />
            </label>
            <label className="block">
              Next decision and who must make it
              <input
                required
                minLength={5}
                value={form.nextDecision}
                onChange={e =>
                  setForm({ ...form, nextDecision: e.target.value })
                }
                className="block w-full rounded border bg-white p-2 text-slate-900"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-amber-500 px-3 py-1 font-medium text-slate-950 disabled:opacity-60"
            >
              Record decision
            </button>
          </form>
        )}
        {latestRec && loop.viewerRole !== 'owner' && (
          <p>Only the organisation owner can record the decision.</p>
        )}
      </section>
    </div>
  );
}
