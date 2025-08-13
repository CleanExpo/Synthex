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
import { validatedEnv } from '@/config/env.server';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
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
      <body className="min-h-screen bg-background font-sans antialiased">
        <ErrorBoundary>
          <Providers>
            <PerformanceMonitor />
            <CommandPalette />
            <ProductTour />
            <FloatingActionButton />
            <FloatingStreak />
            {children}
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
