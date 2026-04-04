import { generateMetadata } from '@/lib/seo/metadata';
import BlogClient from './BlogClient';

export const metadata = generateMetadata({
  title: 'Blog',
  description:
    'AI marketing insights, tips, and strategies from the Synthex team. Learn how to grow your business with AI-powered content.',
  path: '/blog',
  keywords: [
    'AI marketing blog',
    'social media tips',
    'content marketing',
    'marketing automation tips',
  ],
});

export default function BlogPage() {
  return <BlogClient />;
}
