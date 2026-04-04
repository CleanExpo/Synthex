import type { Metadata } from 'next';
import { PAGE_METADATA } from '@/lib/seo/metadata';

export const metadata: Metadata = PAGE_METADATA.caseStudies;

export default function CaseStudiesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
