import type { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social';

export const metadata: Metadata = {
  title: 'Product Demo — Synthex AI Marketing Platform',
  description: 'Watch the full Synthex product demo. See how our AI marketing platform automates content creation, scheduling, and analytics across all social platforms.',
  openGraph: {
    title: 'Product Demo — Synthex AI Marketing Platform',
    description: 'Watch the full Synthex product demo. See how our AI marketing platform automates content creation, scheduling, and analytics across all social platforms.',
    url: `${BASE_URL}/demo`,
    videos: [
      {
        url: 'https://www.youtube.com/embed/vnn6SJUlsWU',
        width: 1280,
        height: 720,
        type: 'text/html',
      },
    ],
  },
  alternates: {
    canonical: `${BASE_URL}/demo`,
  },
};

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
