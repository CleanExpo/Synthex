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
import { existsSync } from 'fs';
import { join } from 'path';
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
    // Asserted by parsing rather than prefix-matching, so a URL that merely
    // starts with the contact address but drops the attribution cannot pass.
    const ctas = screen.getAllByRole('link', { name: /Book a walkthrough/i });
    expect(ctas.length).toBeGreaterThanOrEqual(2);

    const hrefs = ctas.map(cta => cta.getAttribute('href'));
    expect(new Set(hrefs).size).toBe(1); // both CTAs agree

    const url = new URL(hrefs[0] as string);
    expect(url.origin).toBe('https://restoreassist.app');
    expect(url.pathname).toBe('/contact');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      utm_source: 'synthex',
      utm_medium: 'referral',
      utm_campaign: 'ra_insurers',
      utm_content: 'walkthrough',
    });
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
     *
     * Hrefs are resolved and normalised rather than string-compared, because a
     * raw comparison lets the same bug back in wearing a different coat:
     * '/demo?utm=x', '/demo/' and 'https://synthex.social/demo' all reach the
     * Synthex demo while matching no literal in the list below.
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
    // Relative hrefs resolve against this, so they are checked as Synthex routes.
    const SYNTHEX_ORIGIN = 'https://synthex.social';
    const synthexOrigins = [SYNTHEX_ORIGIN, 'https://www.synthex.social'];

    const hrefs = Array.from(container.querySelectorAll('a'))
      .map(anchor => anchor.getAttribute('href'))
      .filter((href): href is string => Boolean(href))
      .filter(href => !href.startsWith('#')); // in-page anchors go nowhere

    expect(hrefs.length).toBeGreaterThan(0);
    hrefs.forEach(href => {
      const url = new URL(href, SYNTHEX_ORIGIN);
      // A link to some other domain cannot be a Synthex product route.
      if (!synthexOrigins.includes(url.origin)) return;
      const pathname = url.pathname.replace(/\/+$/, '') || '/';
      expect(synthexOnlyRoutes).not.toContain(pathname);
    });
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

  it('references no media file that does not exist', () => {
    /*
     * The hero was a <video> whose only <source> pointed at
     * /restoreassist/nir-explainer.mp4 — a file that has never existed. Because
     * of preload="none" plus a poster, the page looked fine on load and did
     * nothing when a visitor pressed play, so nothing caught it.
     *
     * Every local media path the page renders is resolved against public/ on
     * disk. A reference to a missing asset fails here rather than silently
     * shipping a dead play button.
     */
    const { container } = render(<InsurersLandingPage />);
    const sources = [
      ...Array.from(container.querySelectorAll('source')).map(el =>
        el.getAttribute('src')
      ),
      ...Array.from(container.querySelectorAll('video')).map(el =>
        el.getAttribute('poster')
      ),
    ].filter((src): src is string => Boolean(src));

    // next/image rewrites src through /_next/image?url=... — recover the original.
    const imageSrcs = Array.from(container.querySelectorAll('img'))
      .map(el => el.getAttribute('src'))
      .filter((src): src is string => Boolean(src))
      .map(src => {
        const match = src.match(/[?&]url=([^&]+)/);
        return match ? decodeURIComponent(match[1]) : src;
      });

    const localPaths = [...sources, ...imageSrcs].filter(src =>
      src.startsWith('/')
    );

    // Without this the assertion below passes trivially if the page ever stops
    // rendering media at all, or if the src extraction above silently breaks.
    expect(localPaths.length).toBeGreaterThan(0);

    localPaths.forEach(src => {
      const onDisk = join(__dirname, '../../../../public', src);
      expect(existsSync(onDisk)).toBe(true);
    });
  });

  it('links to the RestoreAssist pricing page', () => {
    /*
     * Both RestoreAssist pages were orphans — nothing anywhere on the site
     * linked to either, so the only ways in were the sitemap and a direct URL.
     * Asserted by href rather than link text so rewording the copy does not
     * silently drop the only route between the two pages.
     */
    const { container } = render(<InsurersLandingPage />);
    const hrefs = Array.from(container.querySelectorAll('a')).map(anchor =>
      anchor.getAttribute('href')
    );
    expect(hrefs).toContain('/restoreassist/pricing');
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
