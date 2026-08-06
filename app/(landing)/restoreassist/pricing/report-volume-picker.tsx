'use client';

import { useState } from 'react';
import { Check, Minus } from '@/components/icons';
import {
  INCLUDED_REPORTS_PER_MONTH,
  MONTHLY_PLAN_PRICE_AUD,
  REPORT_PACKS,
  recommendFor,
} from './plan-data';

/**
 * The self-selection device for this page.
 *
 * A restoration business owner does not know which "plan" they want — they know
 * roughly how many jobs they write up in a month. This turns that one number
 * into a plain answer, including the answer "the included reports already cover
 * you, add nothing". Refusing to upsell when the maths says not to is the whole
 * point: the brand rule forbids manufactured urgency, and a picker that always
 * recommends spending more is a sales device, not a decision aid.
 */
export function ReportVolumePicker() {
  const [reports, setReports] = useState(INCLUDED_REPORTS_PER_MONTH);
  const result = recommendFor(reports);

  return (
    <div className="rounded-[16px] border border-[var(--ra-navy-chip)] bg-[var(--ra-navy)] p-6 sm:p-10">
      <label
        htmlFor="ra-report-volume"
        className="block text-lg font-bold text-[var(--ra-n50)] sm:text-xl"
      >
        Roughly how many reports do you write in a month?
      </label>
      <p className="mt-2 text-sm text-[var(--ra-n100)]">
        Drag the slider. Nothing is sent anywhere, and no email is asked for.
      </p>

      <div className="mt-7 flex items-center gap-5">
        <input
          id="ra-report-volume"
          type="range"
          min={1}
          max={200}
          step={1}
          value={reports}
          onChange={event => setReports(Number(event.target.value))}
          aria-describedby="ra-report-volume-result"
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[var(--ra-navy-chip)] accent-[var(--ra-tan)]"
        />
        <output
          htmlFor="ra-report-volume"
          className="min-w-[4.5rem] shrink-0 text-right font-mono text-3xl font-bold text-[var(--ra-tan)]"
        >
          {reports}
        </output>
      </div>

      <div
        id="ra-report-volume-result"
        aria-live="polite"
        className="mt-8 rounded-[12px] border border-[var(--ra-navy-chip)] bg-[var(--ra-n900)] p-6"
      >
        <div className="flex items-start gap-3">
          {result.packLabel ? (
            <Check
              className="mt-1 h-5 w-5 shrink-0 text-[var(--ra-tan)]"
              aria-hidden="true"
            />
          ) : (
            <Minus
              className="mt-1 h-5 w-5 shrink-0 text-[var(--ra-tan)]"
              aria-hidden="true"
            />
          )}
          <div>
            <p className="text-lg font-bold text-[var(--ra-n50)]">
              {result.headline}
            </p>
            <p className="mt-2 text-base leading-relaxed text-[var(--ra-n100)]">
              {result.detail}
            </p>
          </div>
        </div>

        <dl className="mt-6 grid gap-4 border-t border-[var(--ra-navy-chip)] pt-6 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-widest text-[var(--ra-n500)]">
              Monthly plan
            </dt>
            <dd className="mt-1 font-mono text-lg font-bold text-[var(--ra-n50)]">
              ${MONTHLY_PLAN_PRICE_AUD}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-widest text-[var(--ra-n500)]">
              Report packs
            </dt>
            <dd className="mt-1 font-mono text-lg font-bold text-[var(--ra-n50)]">
              ${result.packsCostAud}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-widest text-[var(--ra-n500)]">
              Total each month
            </dt>
            <dd className="mt-1 font-mono text-lg font-bold text-[var(--ra-tan)]">
              ${result.totalAud} AUD
            </dd>
          </div>
        </dl>

        <p className="mt-5 text-xs leading-relaxed text-[var(--ra-n500)]">
          Includes GST. Report generation also uses your own Anthropic or OpenAI
          key, billed to you by that provider at their rates — see below.
        </p>
      </div>

      <p className="mt-6 text-sm text-[var(--ra-n100)]">
        Packs are added to a subscription, so the choice can wait until a busy
        month actually arrives.{' '}
        {REPORT_PACKS.map(pack => `${pack.reports} for $${pack.priceAud}`).join(
          ' · '
        )}
        .
      </p>
    </div>
  );
}
