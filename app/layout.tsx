import type { Metadata } from 'next';
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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.ai'),
  title: 'Synthex - AI-Powered Social Media Automation',
  description: 'Generate viral content with AI, analyze engagement patterns, and automate your social media presence across all platforms.',
  keywords: 'social media automation, AI content generation, viral marketing, content scheduling, persona learning',
  authors: [{ name: 'Synthex Team' }],
  openGraph: {
    title: 'Synthex - AI-Powered Social Media Automation',
    description: 'Generate viral content with AI and automate your social media presence',
    url: 'https://synthex.ai',
    siteName: 'Synthex',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Synthex - AI-Powered Social Media Automation',
    description: 'Generate viral content with AI and automate your social media presence',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
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
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        {/* Skip to main content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-purple-600 focus:text-white focus:rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-gray-900"
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
