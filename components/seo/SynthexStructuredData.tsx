/**
 * Synthex Schema.org structured data (JSON-LD).
 *
 * WHY THIS IS A COMPONENT AND NOT PART OF THE ROOT LAYOUT: these five blocks
 * used to be emitted from app/layout.tsx's <head>, which put them on EVERY
 * route — including app/(landing)/restoreassist/*, where they told crawlers a
 * RestoreAssist page was a Synthex SoftwareApplication published by
 * Unite-Group. A nested layout cannot remove a parent's JSX and a root layout
 * has no access to the pathname, so the only way to scope them was to stop
 * emitting them globally and let Synthex-branded surfaces opt in.
 *
 * Rendered by SiteShell (components/landing/public-v2.tsx), which wraps the
 * Synthex public marketing pages — home, about, features, pricing, security,
 * opportunity-map, contact and add-ons. The homepage is what carries the weight
 * here: Organization, WebSite + SearchAction, VideoObject and HowTo are all
 * homepage-shaped, and duplicating them across every URL was never doing any
 * work. Routes that no longer emit them (dashboard, and public pages that do
 * not use SiteShell) were emitting redundant copies of homepage entity data.
 *
 * JSON-LD is valid anywhere in the document, so rendering inside <body> from
 * this component is equivalent to the old <head> placement for crawlers.
 */

import {
  BASE_URL,
  LANDING_VIDEO_POSTER_URL,
  LANDING_VIDEO_URL,
  SITE_DESCRIPTION,
} from '@/lib/seo/site-constants';

function buildStructuredDataScripts(): Array<{ id: string; json: object }> {
  return [
    {
      id: 'org-schema',
      json: {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'SYNTHEX',
        url: BASE_URL,
        logo: `${BASE_URL}/logo.png`,
        description: SITE_DESCRIPTION,
        sameAs: [
          'https://twitter.com/synthex_social',
          'https://www.youtube.com/@SynthexMedia-25',
          'https://linkedin.com/company/synthex',
          'https://github.com/synthex',
        ],
        contactPoint: {
          '@type': 'ContactPoint',
          email: 'support@synthex.social',
          contactType: 'customer service',
        },
        parentOrganization: {
          '@type': 'Organization',
          name: 'Unite-Group',
          url: 'https://unite-group.com.au',
        },
      },
    },
    {
      id: 'software-app-schema',
      json: {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'SYNTHEX',
        description:
          'Evidence-backed marketing command center for research, campaign planning, Gen Media production, approval workflow and ROI learning.',
        url: BASE_URL,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        featureList: [
          'Source-backed research packets',
          'Campaign planning boards',
          'Storyboard and Gen Media briefs',
          'Human approval gates',
          'Multi-channel asset planning',
          'ROI feedback loops',
        ],
      },
    },
    {
      id: 'website-schema',
      json: {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Synthex - Marketing Command Center',
        url: BASE_URL,
        description: SITE_DESCRIPTION,
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${BASE_URL}/search?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
    },
    {
      id: 'landing-video-schema',
      json: {
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        '@id': `${BASE_URL}/#landing-video`,
        name: 'Synthex Command Center Demo',
        description:
          'A short command center walkthrough showing how Synthex turns market signal into research, strategy, approved media and ROI learning.',
        thumbnailUrl: [LANDING_VIDEO_POSTER_URL],
        uploadDate: '2026-05-19',
        contentUrl: LANDING_VIDEO_URL,
        duration: 'PT12S',
        publisher: {
          '@type': 'Organization',
          name: 'SYNTHEX',
          logo: {
            '@type': 'ImageObject',
            url: `${BASE_URL}/logo.png`,
          },
        },
      },
    },
    {
      id: 'howto-schema',
      json: {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: 'How Synthex Plans an Approval-Gated Campaign',
        description:
          'Move from market signal to research, campaign planning, approved media and ROI learning with Synthex.',
        step: [
          {
            '@type': 'HowToStep',
            position: 1,
            name: 'Capture the market signal',
            text: 'Start with a voice note, meeting transcript, product idea or business source.',
          },
          {
            '@type': 'HowToStep',
            position: 2,
            name: 'Ground the campaign',
            text: 'Build a research packet from product, audience, search, channel and risk evidence before creative production.',
          },
          {
            '@type': 'HowToStep',
            position: 3,
            name: 'Approve and learn',
            text: 'Review the storyboard and media brief before production, publishing or spend, then feed outcomes back into the next campaign.',
          },
        ],
      },
    },
  ];
}

export function SynthexStructuredData() {
  return (
    <>
      {buildStructuredDataScripts().map(({ id, json }) => (
        <script
          key={id}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
        />
      ))}
    </>
  );
}
