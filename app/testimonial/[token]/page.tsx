/**
 * Public Testimonial Submission Page
 *
 * /testimonial/[token]
 *
 * Branded, standalone page where customers submit a testimonial
 * with optional photos and video.
 *
 * UNI-1637
 */

import type { Metadata } from 'next';
import { TestimonialForm } from './TestimonialForm';

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthex.social';
  const res = await fetch(`${appUrl}/api/public/testimonials/${token}`, {
    cache: 'no-store',
  });

  if (!res.ok) return { title: 'Share Your Experience' };

  const data = (await res.json()) as { businessName?: string; title?: string };
  return {
    title: `${data.businessName ?? 'Share'} — ${data.title ?? 'Your Experience'}`,
    robots: { index: false }, // Don't index testimonial pages
  };
}

export default function TestimonialPage({ params }: Props) {
  return <TestimonialForm paramsPromise={params} />;
}
