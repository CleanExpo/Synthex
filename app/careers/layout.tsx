import type { Metadata } from 'next';
import { PAGE_METADATA } from '@/lib/seo/metadata';

export const metadata: Metadata = PAGE_METADATA.careers;

export default function CareersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
