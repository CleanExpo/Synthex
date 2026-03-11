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
    { media: '(prefers-color-scheme: light)', color: '#0891b2' },
    { media: '(prefers-color-scheme: dark)', color: '#0891b2' },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL('https://synthex.social'),
  title: {
    default: 'SYNTHEX | AI Marketing Automation',
    template: '%s | SYNTHEX',
  },
  description:
    "The world's first fully autonomous AI marketing agency. Generate viral content, automate scheduling, and optimise engagement with AI-powered social media automation.",
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
    title: 'SYNTHEX | AI Marketing Automation',
    description:
      "The world's first fully autonomous AI marketing agency. Generate viral content and automate your social media presence 24/7.",
    url: 'https://synthex.social',
    siteName: 'SYNTHEX',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'SYNTHEX - AI Marketing Automation',
      },
    ],
    locale: 'en_AU',
    type: 'website',
    videos: [
      {
        url: 'https://www.youtube.com/embed/7rRHU8xS-kU',
        width: 1280,
        height: 720,
        type: 'text/html',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SYNTHEX | AI Marketing Automation',
    description: "The world's first fully autonomous AI marketing agency",
    images: ['/og-image.png'],
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
        description:
          "The world's first fully autonomous AI marketing agency. AI-powered social media automation, content generation, and analytics.",
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
          'AI-powered social media automation platform. Generate viral content, schedule posts, and analyse engagement across all major social platforms.',
        url: BASE_URL,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        offers: {
          '@type': 'AggregateOffer',
          lowPrice: '0',
          highPrice: '249',
          priceCurrency: 'USD',
          offerCount: 3,
          offers: [
            {
              '@type': 'Offer',
              name: 'Free Trial',
              price: '0',
              priceCurrency: 'USD',
              description: '14-day free trial with full access',
            },
            {
              '@type': 'Offer',
              name: 'Pro',
              price: '249',
              priceCurrency: 'USD',
              description:
                'Full AI marketing automation with BYOK (Bring Your Own API Keys)',
            },
          ],
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
          'Multi-Platform Management (9 platforms)',
          'Real-Time Analytics',
          'Engagement Optimisation',
          'Bring Your Own API Keys',
          'A/B Testing',
          'Competitor Tracking',
        ],
      },
    },
    {
      id: 'website-schema',
      json: {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'SYNTHEX - AI Marketing Automation',
        url: BASE_URL,
        description:
          'AI-powered social media automation platform for content creation, scheduling, and analytics.',
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
      id: 'describer-video-schema',
      json: {
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        '@id': `${BASE_URL}/#describer-video`,
        name: 'SYNTHEX -- AI-Powered Marketing Agency',
        description:
          'Discover how SYNTHEX uses AI to automate your entire social media marketing -- from content creation to scheduling and analytics.',
        thumbnailUrl:
          'https://img.youtube.com/vi/7rRHU8xS-kU/maxresdefault.jpg',
        uploadDate: '2026-02-17',
        contentUrl: 'https://youtu.be/7rRHU8xS-kU',
        embedUrl: 'https://www.youtube.com/embed/7rRHU8xS-kU',
        duration: 'PT2M',
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
      id: 'demo-video-schema',
      json: {
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        '@id': `${BASE_URL}/#demo-video`,
        name: 'SYNTHEX Product Demo',
        description:
          'Full product walkthrough of the SYNTHEX AI marketing platform. See the dashboard, content generator, scheduler, and analytics in action.',
        thumbnailUrl:
          'https://img.youtube.com/vi/vnn6SJUlsWU/maxresdefault.jpg',
        uploadDate: '2026-02-17',
        contentUrl: 'https://youtu.be/vnn6SJUlsWU',
        embedUrl: 'https://www.youtube.com/embed/vnn6SJUlsWU',
        duration: 'PT5M',
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
        name: 'How to Generate AI Marketing Content with SYNTHEX',
        description:
          'Create viral social media content in 3 simple steps using SYNTHEX AI.',
        step: [
          {
            '@type': 'HowToStep',
            position: 1,
            name: 'Choose your platform and topic',
            text: 'Select the social media platform (Twitter, LinkedIn, Instagram, etc.) and enter your content topic or campaign brief.',
          },
          {
            '@type': 'HowToStep',
            position: 2,
            name: 'Generate AI content',
            text: 'Click Generate to create multiple content variations with AI-powered hooks, hashtags, and engagement optimisation.',
          },
          {
            '@type': 'HowToStep',
            position: 3,
            name: 'Schedule or publish',
            text: 'Review, edit, and schedule your content for optimal posting times, or publish immediately to your connected accounts.',
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
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Preload critical resources */}
        <link rel="preload" href="/grid.svg" as="image" type="image/svg+xml" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
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
