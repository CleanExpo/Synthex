import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LazyClientComponents } from './LazyClientComponents';
import { ServiceWorkerRegistration } from '@/components/pwa/ServiceWorkerRegistration';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { Space_Grotesk, Inter } from 'next/font/google';
import {
  BASE_URL,
  LANDING_VIDEO_POSTER_URL,
  LANDING_VIDEO_URL,
  SITE_DESCRIPTION,
} from '@/lib/seo/site-constants';
import './globals.css';

// SYN-455: self-hosted SIL-OFL fonts via next/font/google (woff2 self-served at
// build time — zero runtime request to any font CDN). Replaces the Fontshare-
// licensed Satoshi, whose Free Font EULA forbids self-hosting. Families match the
// documented design standard: Space Grotesk headings, Inter body.
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

// Shared with components/seo/SynthexStructuredData.tsx, which renders the
// Schema.org JSON-LD these same values feed. See lib/seo/site-constants.ts.

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`font-sans ${spaceGrotesk.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Preload critical resources */}
        <link rel="preload" href="/grid.svg" as="image" type="image/svg+xml" />
        {/*
         * Schema.org JSON-LD is deliberately NOT emitted here. Emitting it from
         * the root layout put Synthex Organization / SoftwareApplication /
         * WebSite / VideoObject / HowTo blocks on every route, including the
         * RestoreAssist landing pages, which are a different brand. It now
         * lives in components/seo/SynthexStructuredData.tsx and is rendered by
         * SiteShell, so only Synthex-branded surfaces carry it.
         */}
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
        <ErrorBoundary>
          <Providers>
            <InstallPrompt />
            <main id="main-content" role="main">
              {children}
            </main>
            <LazyClientComponents />
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
