import type { Metadata } from 'next';
import { PAGE_METADATA } from '@/lib/seo/metadata';

export const metadata: Metadata = PAGE_METADATA.security;

export default function SecurityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
