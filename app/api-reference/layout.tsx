import type { Metadata } from 'next';
import { PAGE_METADATA } from '@/lib/seo/metadata';

export const metadata: Metadata = PAGE_METADATA.apiReference;

export default function ApiReferenceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
