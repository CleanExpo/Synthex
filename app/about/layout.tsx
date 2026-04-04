import type { Metadata } from 'next';
import { PAGE_METADATA } from '@/lib/seo/metadata';

export const metadata: Metadata = PAGE_METADATA.about;

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
