import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/toast';
import { PerformanceMonitor } from '@/components/PerformanceMonitor';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CommandPalette } from '@/components/CommandPalette';
import { ProductTour } from '@/components/ProductTour';
import { FloatingActionButton } from '@/components/FloatingActionButton';
import { FloatingStreak } from '@/components/StreakCounter';
import './globals.css';

// Force dynamic rendering to prevent Prisma initialization during build
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  preload: true,
});

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0a1628' },
    { media: '(prefers-color-scheme: dark)', color: '#0a1628' },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'Synthex - AI-Powered Marketing Agency',
    template: '%s | Synthex',
  },
  description: "The world's first fully autonomous AI marketing agency. Generate viral content, automate scheduling, and optimize engagement with AI-powered social media automation.",
  keywords: [
    'AI marketing agency',
    'social media automation',
    'AI content generation',
    'viral marketing',
    'content scheduling',
    'marketing automation',
    'social media AI',
    'autonomous marketing',
    'engagement optimization',
    'multi-platform management',
  ],
  authors: [{ name: 'Synthex Team', url: BASE_URL }],
  creator: 'Synthex',
  publisher: 'Synthex',
  applicationName: 'Synthex',
  generator: 'Next.js',
  referrer: 'origin-when-cross-origin',
  formatDetection: {
    email: false,
    telephone: false,
  },
  openGraph: {
    title: 'Synthex - AI-Powered Marketing Agency',
    description: "The world's first fully autonomous AI marketing agency. Generate viral content and automate your social media presence 24/7.",
    url: BASE_URL,
    siteName: 'Synthex',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Synthex - AI Marketing Agency',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Synthex - AI-Powered Marketing Agency',
    description: "The world's first fully autonomous AI marketing agency",
    images: ['/og-image.png'],
    creator: '@synthexai',
    site: '@synthexai',
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
    canonical: BASE_URL,
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Preload critical resources */}
        <link rel="preload" href="/grid.svg" as="image" type="image/svg+xml" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Schema.org Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Synthex',
              url: BASE_URL,
              logo: `${BASE_URL}/logo.png`,
              description: "The world's first fully autonomous AI marketing agency. AI-powered social media automation, content generation, and analytics.",
              sameAs: [
                'https://twitter.com/synthexai',
                'https://www.youtube.com/@SynthexMedia-25',
                'https://linkedin.com/company/synthex',
                'https://github.com/synthex',
              ],
              contactPoint: {
                '@type': 'ContactPoint',
                email: 'support@synthex.social',
                contactType: 'customer service',
              },
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'Synthex',
              description: 'AI-powered social media automation platform. Generate viral content, schedule posts, and analyze engagement across all major social platforms.',
              url: BASE_URL,
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web',
              offers: {
                '@type': 'Offer',
                price: '199',
                priceCurrency: 'USD',
                description: 'Starting price with BYOK (Bring Your Own API Keys)',
              },
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: 4.9,
                ratingCount: 2847,
                bestRating: 5,
                worstRating: 1,
              },
              featureList: [
                'AI Content Generation',
                'Smart Post Scheduling',
                'Multi-Platform Management',
                'Real-Time Analytics',
                'Engagement Optimization',
                'Bring Your Own API Keys',
              ],
            }),
          }}
        />
        {/* Video/YouTube Channel Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'VideoObject',
              name: 'Synthex AI Marketing Tutorials',
              description: 'Learn how to leverage AI for social media marketing with Synthex. Tutorials covering AI content generation, smart scheduling, and automation strategies.',
              thumbnailUrl: `${BASE_URL}/images/hero-robot.png`,
              uploadDate: '2026-02-10',
              contentUrl: 'https://www.youtube.com/@SynthexMedia-25',
              embedUrl: 'https://www.youtube.com/channel/UCds9Km8AJBrO67p2Up8M3dA',
              publisher: {
                '@type': 'Organization',
                name: 'Synthex',
                logo: {
                  '@type': 'ImageObject',
                  url: `${BASE_URL}/logo.png`,
                },
              },
            }),
          }}
        />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        {/* Skip to main content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-cyan-600 focus:text-white focus:rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-gray-900"
        >
          Skip to main content
        </a>
        <ErrorBoundary>
          <Providers>
            <PerformanceMonitor />
            <CommandPalette />
            <ProductTour />
            <FloatingActionButton />
            <FloatingStreak />
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
