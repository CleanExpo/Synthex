/**
 * SYN-918 — Insurer-facing landing page smoke render test.
 *
 * Confirms the RestoreAssist insurer landing page renders as a server component
 * without throwing, exposes its six required sections, and — as a guard on the
 * ticket's "no Synthex tokens leaked" pass criterion — never emits the banned
 * Synthex colours or Space Grotesk in its markup.
 *
 * Both oranges are banned: #FF6B35 is the canonical Synthex brand colour, and
 * #f97316 is the stale value that used to be documented as it (SYN-1130). A
 * guard on only one of them would stop protecting brand separation.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import InsurersLandingPage, {
  metadata,
} from '../../../../app/(landing)/restoreassist/insurers/page';

describe('RestoreAssist insurer landing page (SYN-918)', () => {
  it('renders the hero problem headline and both primary CTAs', () => {
    render(<InsurersLandingPage />);
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /Fifty contractor reports/i,
      })
    ).toBeInTheDocument();
    // Two "Book a walkthrough" CTAs (hero + closing band). Both must reach
    // RestoreAssist's own contact page — see the cross-brand guard below.
    const ctas = screen.getAllByRole('link', { name: /Book a walkthrough/i });
    expect(ctas.length).toBeGreaterThanOrEqual(2);
    ctas.forEach(cta =>
      expect(cta.getAttribute('href')).toMatch(
        /^https:\/\/restoreassist\.app\/contact\?/
      )
    );
  });

  it('sends no CTA to a Synthex product route', () => {
    /*
     * Regression guard. Both CTAs on this page used to point at the internal
     * route `/demo`, which is the Synthex social-media caption generator — so
     * the only call to action on an insurer-facing RestoreAssist page handed
     * insurance claims teams a different product. The bug survived because the
     * assertion above pinned href === '/demo', locking the wrong behaviour in
     * place. This checks the property that actually matters: nothing on a
     * RestoreAssist surface may link into a Synthex-only route.
     */
    const { container } = render(<InsurersLandingPage />);
    const synthexOnlyRoutes = [
      '/demo',
      '/pricing',
      '/features',
      '/waitlist',
      '/opportunity-map',
      '/agencies',
    ];
    const hrefs = Array.from(container.querySelectorAll('a'))
      .map(anchor => anchor.getAttribute('href'))
      .filter((href): href is string => Boolean(href));

    expect(hrefs.length).toBeGreaterThan(0);
    hrefs.forEach(href => expect(synthexOnlyRoutes).not.toContain(href));
  });

  it('renders all six required sections', () => {
    render(<InsurersLandingPage />);
    expect(
      screen.getByText(/Every contractor reports differently/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/one report format, filed the same way/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/One claim, five steps/i)).toBeInTheDocument();
    expect(
      screen.getByText(/What a single report format gives/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/See a claim move through RestoreAssist/i)
    ).toBeInTheDocument();
    // 5-step flow renders exactly five steps.
    expect(screen.getAllByText(/^Step \d$/).length).toBe(5);
  });

  it('sets insurer-facing page metadata', () => {
    expect(metadata.title).toMatch(/Insurers/i);
    expect(String(metadata.description)).toMatch(/re-inspection|claim cycle/i);
  });

  it('leaks no Synthex design tokens', () => {
    const { container } = render(<InsurersLandingPage />);
    const html = container.innerHTML.toLowerCase();
    expect(html).not.toContain('#ff6b35'); // Synthex orange (canonical)
    expect(html).not.toContain('#f97316'); // Synthex orange (stale, pre-SYN-1130)
    expect(html).not.toContain('#0f172a'); // Synthex slate
    expect(html).not.toContain('space grotesk');
  });
});
