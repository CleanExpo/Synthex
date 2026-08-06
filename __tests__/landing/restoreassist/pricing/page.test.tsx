/**
 * RestoreAssist pricing page — render, pricing-accuracy and brand-voice guards.
 *
 * The brand-voice block is the point of this suite. RestoreAssist's rules live
 * in packages/brand-config/src/brands/ra.ts and .claude/memory/ceo-foundation.md
 * as prose, which means nothing stops a later edit from quietly reintroducing
 * "AI-powered" or first-person business language. These tests turn the rules
 * that can be checked mechanically into build failures.
 *
 * The pricing figures are asserted against plan-data.ts rather than hardcoded a
 * second time, so a re-crawl updates one file — but the shape of the offer
 * (a no-card trial, one paid plan, three packs) is asserted literally, because
 * silently losing one of those would change what the page promises.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import RestoreAssistPricingPage, {
  metadata,
} from '../../../../app/(landing)/restoreassist/pricing/page';
import {
  INCLUDED_REPORTS_PER_MONTH,
  MONTHLY_PLAN_PRICE_AUD,
  REPORT_PACKS,
  TRIAL_DAYS,
  recommendFor,
} from '../../../../app/(landing)/restoreassist/pricing/plan-data';

function renderedText(): string {
  const { container } = render(<RestoreAssistPricingPage />);
  return container.textContent ?? '';
}

describe('RestoreAssist pricing page', () => {
  describe('structure', () => {
    it('leads with the buyer’s decision, not the brand', () => {
      render(<RestoreAssistPricingPage />);
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toHaveTextContent(/work out what this costs/i);
      // RA doNot: "never position the brand before the reader's problem in any
      // opening line".
      expect(h1.textContent?.toLowerCase()).not.toContain('restoreassist');
    });

    it('shows both plans and the report packs', () => {
      render(<RestoreAssistPricingPage />);
      expect(
        screen.getByRole('heading', { level: 2, name: /^free trial$/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { level: 2, name: /^monthly$/i })
      ).toBeInTheDocument();

      const text = renderedText();
      REPORT_PACKS.forEach(pack => {
        expect(text).toContain(`${pack.reports} extra reports`);
        expect(text).toContain(`$${pack.priceAud}`);
      });
    });

    it('renders the comparison table with a row per feature', () => {
      render(<RestoreAssistPricingPage />);
      const table = screen.getByRole('table');
      expect(
        within(table).getByRole('columnheader', { name: /free trial/i })
      ).toBeInTheDocument();
      // Header row plus one row per compared feature.
      expect(within(table).getAllByRole('row').length).toBeGreaterThan(5);
    });

    it('exposes the volume picker as a labelled, keyboard-reachable control', () => {
      render(<RestoreAssistPricingPage />);
      const slider = screen.getByRole('slider', {
        name: /how many reports/i,
      });
      expect(slider).toHaveValue(String(INCLUDED_REPORTS_PER_MONTH));
    });

    it('publishes FAQ structured data', () => {
      const { container } = render(<RestoreAssistPricingPage />);
      const ld = container.querySelector(
        'script[type="application/ld+json"]'
      )?.innerHTML;
      expect(ld).toBeTruthy();
      const parsed = JSON.parse(ld as string);
      expect(parsed['@type']).toBe('FAQPage');
      expect(parsed.mainEntity.length).toBeGreaterThanOrEqual(4);
    });

    it('sets pricing page metadata', () => {
      const title = (metadata.title as { absolute: string }).absolute;
      expect(title).toMatch(/pricing/i);
      expect(String(metadata.description)).toMatch(/GST/);
      expect(metadata.alternates?.canonical).toBe('/restoreassist/pricing');
    });

    it('does not inherit the Synthex title template', () => {
      // The root layout appends '%s | SYNTHEX'. brandprint forbids two brands in
      // one output, so this page must set an absolute title.
      const title = metadata.title as { absolute: string };
      expect(title.absolute).toBeDefined();
      expect(title.absolute.toLowerCase()).not.toContain('synthex');
    });
  });

  describe('pricing accuracy', () => {
    it('states the plan price, the included reports and GST treatment', () => {
      const text = renderedText();
      expect(text).toContain(`$${MONTHLY_PLAN_PRICE_AUD}`);
      expect(text).toContain(
        `${INCLUDED_REPORTS_PER_MONTH} inspection reports`
      );
      expect(text).toMatch(/GST included/i);
      expect(text).toMatch(/AUD/);
    });

    it('says the trial needs no credit card', () => {
      expect(renderedText()).toMatch(
        new RegExp(`${TRIAL_DAYS} days, no credit card`, 'i')
      );
    });

    it('discloses the bring-your-own-key running cost on the page itself', () => {
      // The one variable cost. Burying it would be the pushy version of this page.
      expect(renderedText()).toMatch(/own Anthropic or OpenAI/i);
    });

    it('cites the pricing source and crawl date', () => {
      expect(renderedText()).toMatch(
        /restoreassist\.app\/pricing on \d{2}\/\d{2}\/\d{4}/
      );
    });
  });

  describe('recommendFor', () => {
    it('recommends nothing when the included reports already cover the month', () => {
      const result = recommendFor(INCLUDED_REPORTS_PER_MONTH - 10);
      expect(result.packLabel).toBeNull();
      expect(result.packsCostAud).toBe(0);
      expect(result.totalAud).toBe(MONTHLY_PLAN_PRICE_AUD);
      expect(result.headline).toMatch(/add nothing/i);
    });

    it('treats exactly the included allowance as covered', () => {
      const result = recommendFor(INCLUDED_REPORTS_PER_MONTH);
      expect(result.packLabel).toBeNull();
      expect(result.totalAud).toBe(MONTHLY_PLAN_PRICE_AUD);
    });

    it('tops up a small overflow with the smallest pack', () => {
      const result = recommendFor(INCLUDED_REPORTS_PER_MONTH + 3);
      expect(result.packLabel).toMatch(/the 8 report pack/);
      expect(result.totalAud).toBe(MONTHLY_PLAN_PRICE_AUD + 20);
    });

    it('always recommends enough reports to cover the stated volume', () => {
      for (let reports = 1; reports <= 200; reports += 1) {
        const result = recommendFor(reports);
        const covered =
          INCLUDED_REPORTS_PER_MONTH +
          REPORT_PACKS.reduce((sum, pack) => {
            const matches = [
              ...(result.packLabel ?? '').matchAll(
                new RegExp(`(\\d+) × the ${pack.reports} report pack`, 'g')
              ),
            ];
            const single = (result.packLabel ?? '').includes(
              `the ${pack.reports} report pack`
            );
            const quantity = matches.length
              ? Number(matches[0][1])
              : single
                ? 1
                : 0;
            return sum + quantity * pack.reports;
          }, 0);
        expect(covered).toBeGreaterThanOrEqual(reports);
      }
    });

    it('never recommends a pack mix when a cheaper one covers the same month', () => {
      // Regression guard. A greedy largest-pack-first pick looks right and is
      // not: at 105 reports it takes 25 + 25 + 8 for $120 while a single 60 pack
      // covers the same shortfall for $100. Recommending the dearer option on a
      // page whose premise is honest arithmetic is the worst kind of bug here,
      // so every volume is checked against an independent brute-force minimum.
      const [large, medium, small] = REPORT_PACKS;
      for (let reports = 1; reports <= 200; reports += 1) {
        const shortfall = reports - INCLUDED_REPORTS_PER_MONTH;
        let cheapest = 0;
        if (shortfall > 0) {
          cheapest = Infinity;
          for (let a = 0; a <= 25; a += 1) {
            for (let b = 0; b <= 25; b += 1) {
              for (let c = 0; c <= 25; c += 1) {
                const covered =
                  a * large.reports + b * medium.reports + c * small.reports;
                if (covered < shortfall) continue;
                const cost =
                  a * large.priceAud + b * medium.priceAud + c * small.priceAud;
                if (cost < cheapest) cheapest = cost;
              }
            }
          }
        }
        expect(recommendFor(reports).packsCostAud).toBe(cheapest);
      }
    });

    it('picks the single 60 pack over three smaller packs at the same shortfall', () => {
      const result = recommendFor(INCLUDED_REPORTS_PER_MONTH + 55);
      expect(result.packsCostAud).toBe(100);
      expect(result.packLabel).toBe('the 60 report pack');
    });

    it('never charges for packs that are not needed', () => {
      for (
        let reports = 1;
        reports <= INCLUDED_REPORTS_PER_MONTH;
        reports += 1
      ) {
        expect(recommendFor(reports).packsCostAud).toBe(0);
      }
    });
  });

  describe('brand voice guards', () => {
    // packages/brand-config/src/brands/ra.ts → voice.forbiddenWords, plus the
    // ceo-foundation.md taboo list. Checked against rendered text, not markup.
    const forbiddenWords = [
      'leverage',
      'synergy',
      'unlock value',
      'streamline',
      'revolutionise',
      'AI-powered',
      'utilise',
      'best-in-class',
      'world-class',
      'game-changer',
      'revolutionary',
      'seamless',
      'powerful',
      'journey',
      'excited',
      'thrilled',
      'delighted',
      'all-in-one',
      'cutting-edge',
      'forever free',
      'cheap',
      'low-cost',
      // Competitor names — ra.ts forbids naming any of them.
      'DocuSketch',
      'Encircle',
      'Magicplan',
      'Xactimate',
    ];

    it.each(forbiddenWords)('never uses the word "%s"', word => {
      expect(renderedText().toLowerCase()).not.toContain(word.toLowerCase());
    });

    it('uses no first-person business language', () => {
      // Taboo #7 / FORBIDDEN_PRONOUNS: we, our, i, us, my.
      const text = renderedText();
      ['we', 'our', 'us', 'my'].forEach(pronoun => {
        expect(text).not.toMatch(new RegExp(`\\b${pronoun}\\b`, 'i'));
      });
      expect(text).not.toMatch(/\bI\b/);
    });

    it('makes no blocked outcome claim', () => {
      const text = renderedText().toLowerCase();
      // Campaign doc: guaranteed time saved / claim approval / cost reduction,
      // and any re-inspection percentage claim, are blocked until validated.
      expect(text).not.toContain('guarantee');
      expect(text).not.toContain('re-inspection');
      expect(text).not.toMatch(/sav(e|es|ed|ing)s? you .*(hours|time|money)/);
    });

    it('keeps the Aid Rule intact — the technician decides, not the product', () => {
      const text = renderedText();
      expect(text).toMatch(/sign it off/i);
      expect(text).toMatch(/does not judge the job/i);
      // RestoreAssist must never be the subject of a decision verb.
      expect(text).not.toMatch(
        /RestoreAssist (assesses|decides|judges|verifies|approves|signs off)/i
      );
    });

    it('creates no urgency', () => {
      // RA doNot: "never write copy that creates urgency — the tradie reading
      // this already has it". Rules out the benchmark's countdown discount band.
      const text = renderedText().toLowerCase();
      ['hurry', 'limited time', 'act now', 'offer ends', 'don’t miss'].forEach(
        phrase => expect(text).not.toContain(phrase)
      );
    });

    it('never abbreviates the company name to two letters', () => {
      expect(renderedText()).not.toMatch(/\bRA\b/);
    });

    it('leaks no Synthex design tokens', () => {
      const { container } = render(<RestoreAssistPricingPage />);
      const html = container.innerHTML.toLowerCase();
      expect(html).not.toContain('#ff6b35');
      expect(html).not.toContain('#f97316');
      expect(html).not.toContain('#0f172a');
      expect(html).not.toContain('space grotesk');
    });
  });
});
