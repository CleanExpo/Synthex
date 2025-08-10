import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import { Toaster } from 'react-hot-toast';
import { PerformanceMonitor } from '@/components/PerformanceMonitor';
import { ErrorBoundary } from '@/lib/monitoring';
import './globals.css';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
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
            {children}
            <Toaster
              position="bottom-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: 'rgba(0, 0, 0, 0.8)',
                  color: '#fff',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                },
              }}
            />
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}