import type { Metadata } from 'next';
import { PAGE_METADATA } from '@/lib/seo/metadata';

export const metadata: Metadata = PAGE_METADATA.support;

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
