/**
 * Brand-separation guards for the (landing) route group.
 *
 * The RestoreAssist landing pages are hosted inside the Synthex app but are a
 * different brand, and brandprint forbids two brands in one output. Two leaks
 * were found and fixed; these tests keep them shut.
 *
 * Why these live here rather than in the page suites: the existing page tests
 * render `<Page />` in isolation, so they cannot see anything the root layout
 * contributes — the "leaks no Synthex design tokens" assertion passed happily
 * while the head carried Synthex identity metadata and the cookie banner named
 * Synthex on screen. Chrome needs its own coverage.
 */

import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { render, screen } from '@testing-library/react';
import { metadata as landingMetadata } from '../../app/(landing)/layout';
import { SynthexStructuredData } from '../../components/seo/SynthexStructuredData';

jest.mock('@/hooks/use-cookie-consent', () => ({
  useCookieConsent: () => ({
    status: null,
    isLoading: false,
    accept: jest.fn(),
    decline: jest.fn(),
  }),
}));

const { CookieConsentBanner } =
  require('../../components/CookieConsentBanner') as {
    CookieConsentBanner: React.ComponentType;
  };

describe('Synthex structured data scoping', () => {
  it('emits the five Synthex schema blocks when rendered', () => {
    const { container } = render(<SynthexStructuredData />);
    const types = Array.from(
      container.querySelectorAll('script[type="application/ld+json"]')
    ).map(script => JSON.parse(script.innerHTML)['@type']);

    expect(types).toEqual(
      expect.arrayContaining([
        'Organization',
        'SoftwareApplication',
        'WebSite',
        'VideoObject',
        'HowTo',
      ])
    );
  });

  it('is not emitted from the root layout', () => {
    /*
     * Static guard, in the same spirit as tests/unit/ai/no-direct-image-apis.
     * These blocks used to live in app/layout.tsx's <head>, which put Synthex
     * Organization / SoftwareApplication / WebSite / VideoObject / HowTo on
     * EVERY route — including the RestoreAssist landing pages, telling crawlers
     * a RestoreAssist page was Synthex software published by Unite-Group.
     *
     * A nested layout cannot remove a parent's JSX and a root layout has no
     * pathname, so scoping was only possible by removing it from the root and
     * letting Synthex surfaces opt in via SiteShell. Putting it back in the
     * root layout would silently re-contaminate every other brand's pages, so
     * the file itself is asserted against.
     */
    const rootLayout = readFileSync(
      join(__dirname, '../../app/layout.tsx'),
      'utf8'
    );
    expect(rootLayout).not.toContain('application/ld+json');
  });
});

describe('(landing) route group — brand separation', () => {
  describe('layout metadata', () => {
    it('claims RestoreAssist as author, creator and publisher', () => {
      expect(landingMetadata.creator).toBe('RestoreAssist');
      expect(landingMetadata.publisher).toBe('RestoreAssist Pty Ltd');
      expect(landingMetadata.applicationName).toBe('RestoreAssist');
      expect(landingMetadata.authors).toEqual([{ name: 'RestoreAssist' }]);
    });

    it('names neither Synthex nor Unite-Group anywhere in its metadata', () => {
      // The root layout sets authors[] with a unite-group.com.au link, plus
      // creator 'Synthex' and publisher 'Unite-Group', on every route. Next.js
      // merges metadata field-by-field, so re-declaring them here is what keeps
      // a second brand out of the RestoreAssist document head.
      const serialised = JSON.stringify(landingMetadata).toLowerCase();
      expect(serialised).not.toContain('synthex');
      expect(serialised).not.toContain('unite-group');
    });

    it('drops the Synthex title template for the whole group', () => {
      // Root template is '%s | SYNTHEX'. A page here that sets a plain string
      // title must not come out co-branded.
      const title = landingMetadata.title as { template: string };
      expect(title.template).toBe('%s');
    });
  });

  describe('cookie consent banner', () => {
    // Mounted from the root layout, so it renders on RestoreAssist pages too.
    it('names no brand', () => {
      render(<CookieConsentBanner />);
      const text = screen.getByRole('region', {
        name: /cookie consent/i,
      }).textContent as string;
      expect(text.toLowerCase()).not.toContain('synthex');
      expect(text.toLowerCase()).not.toContain('restoreassist');
      expect(text.toLowerCase()).not.toContain('unite-group');
    });

    it('uses no first-person business language', () => {
      // RestoreAssist's voice config forbids we/our/us/my/I outright, and this
      // banner is on-screen on its pages. "help us improve" broke that.
      render(<CookieConsentBanner />);
      const text = screen.getByRole('region', {
        name: /cookie consent/i,
      }).textContent as string;
      ['we', 'our', 'us', 'my'].forEach(pronoun =>
        expect(text).not.toMatch(new RegExp(`\\b${pronoun}\\b`, 'i'))
      );
    });

    it('still explains the choice and links the privacy policy', () => {
      // Guard against "fixing" the wording by gutting it — this is a consent
      // notice and must still say what happens and where the policy is.
      render(<CookieConsentBanner />);
      const region = screen.getByRole('region', { name: /cookie consent/i });
      expect(region.textContent).toMatch(/nothing loads unless you accept/i);
      expect(
        screen.getByRole('link', { name: /privacy policy/i })
      ).toHaveAttribute('href', '/privacy');
      expect(
        screen.getByRole('button', { name: /no thanks/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /accept analytics/i })
      ).toBeInTheDocument();
    });
  });
});
