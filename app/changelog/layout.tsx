import type { Metadata } from 'next';
import { PAGE_METADATA } from '@/lib/seo/metadata';

export const metadata: Metadata = PAGE_METADATA.changelog;

export default function ChangelogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
