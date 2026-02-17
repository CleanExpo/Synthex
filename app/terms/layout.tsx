import type { Metadata } from 'next';
import { PAGE_METADATA } from '@/lib/seo/metadata';

export const metadata: Metadata = PAGE_METADATA.terms;

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
