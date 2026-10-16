import type { Metadata } from 'next';
import { generateMetadata } from '@/lib/seo/metadata';

// The page is a client component, so its metadata (and self-canonical) lives here.
export const metadata: Metadata = generateMetadata({
  title: 'Request early access',
  description:
    'Synthex is invite-only while in beta. Leave your email and we will reach out when your spot is ready.',
  path: '/waitlist',
});

export default function WaitlistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
