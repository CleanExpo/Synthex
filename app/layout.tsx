import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LazyClientComponents } from './LazyClientComponents';
import { ServiceWorkerRegistration } from '@/components/pwa/ServiceWorkerRegistration';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { ClientFonts } from '@/components/ClientFonts';
import { SentryInit } from './_sentry-init';
import './globals.css';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social';
const LANDING_VIDEO_URL = `${BASE_URL}/videos/synthex-command-center-demo.mp4`;
const LANDING_VIDEO_POSTER_URL = `${BASE_URL}/videos/synthex-command-center-demo-poster.jpg`;
const SITE_DESCRIPTION =
  'Synthex is an evidence-backed marketing command center for research, campaign planning, Gen Media production and approval-gated execution.';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f59e0b' },
    { media: '(prefers-color-scheme: dark)', color: '#f59e0b' },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL('https://synthex.social'),
  title: {
    default: 'Synthex | Marketing Command Center',
    template: '%s | SYNTHEX',
  },
  description: SITE_DESCRIPTION,
  keywords: [
    'AI marketing agency',
    'marketing command center',
    'campaign planning',
    'Gen Media production',
    'approval workflow',
    'marketing ROI',
    'evidence-backed marketing',
    'social media automation',
    'AI content generation',
    'marketing automation',
  ],
  authors: [
    { name: 'Synthex Team', url: BASE_URL },
    { name: 'Unite-Group', url: 'https://unite-group.com.au' },
  ],
  creator: 'Synthex',
  publisher: 'Unite-Group',
  applicationName: 'SYNTHEX',
  generator: 'Next.js',
  referrer: 'origin-when-cross-origin',
  formatDetection: {
    email: false,
    telephone: false,
  },
  openGraph: {
    title: 'Synthex | Marketing Command Center',
    description: SITE_DESCRIPTION,
    url: 'https://synthex.social',
    siteName: 'SYNTHEX',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Synthex marketing command center',
      },
    ],
    locale: 'en_AU',
    type: 'website',
    videos: [
      {
        url: LANDING_VIDEO_URL,
        width: 1280,
        height: 720,
        type: 'video/mp4',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Synthex | Marketing Command Center',
    description: SITE_DESCRIPTION,
    images: [LANDING_VIDEO_POSTER_URL],
    creator: '@synthex_social',
    site: '@synthex_social',
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: 'https://synthex.social',
    languages: {
      'en-US': BASE_URL,
      'en-AU': `${BASE_URL}?locale=en-AU`,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  manifest: '/manifest.json',
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
};

/**
 * Generates all JSON-LD structured data for the root layout.
 *
 * All values are hardcoded constants — no user input flows into these strings,
 * so dangerouslySetInnerHTML is safe here (standard Next.js JSON-LD pattern).
 */
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const structuredData = buildStructuredDataScripts();

  return (
    <html lang="en" className="font-sans" suppressHydrationWarning>
      <head>
        {/* Preconnect so the async Fontshare fetch is fast (ClientFonts handles the actual load) */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="dns-prefetch" href="https://api.fontshare.com" />
        {/* Preload critical resources */}
        <link rel="preload" href="/grid.svg" as="image" type="image/svg+xml" />
        {/* Schema.org Structured Data (JSON-LD) — all values are hardcoded constants */}
        {structuredData.map(({ id, json }) => (
          <script
            key={id}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
          />
        ))}
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        {/* Skip to main content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-orange-600 focus:text-white focus:rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-gray-900"
        >
          Skip to main content
        </a>
        <ServiceWorkerRegistration />
        {/* SYN-906: side-effect import boots Sentry.init() on the client. */}
        <SentryInit />
        {/* Non-blocking font loader — injects Fontshare after hydration */}
        <ClientFonts />
        <ErrorBoundary>
          <Providers>
            <LazyClientComponents />
            <InstallPrompt />
            <main id="main-content" role="main">
              {children}
            </main>
            <Toaster
              position="bottom-right"
              duration={4000}
              richColors
              closeButton
            />
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
