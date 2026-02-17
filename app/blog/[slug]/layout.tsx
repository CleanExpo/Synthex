import type { Metadata } from 'next';
import { generateArticleMetadata } from '@/lib/seo/metadata';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const title = slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return generateArticleMetadata({
    title,
    description: `Read about ${title} on the Synthex blog. AI marketing insights and social media tips.`,
    path: `/blog/${slug}`,
    publishedTime: new Date().toISOString(),
    authors: ['Synthex Team'],
    keywords: ['blog', 'AI marketing', slug.replace(/-/g, ' ')],
  });
}

export default function BlogPostLayout({ children }: { children: React.ReactNode }) {
  return children;
}
