import type { Metadata } from 'next';
import { PAGE_METADATA } from '@/lib/seo/metadata';

export const metadata: Metadata = PAGE_METADATA.blog;

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
