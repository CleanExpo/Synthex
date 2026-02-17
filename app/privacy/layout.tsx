import type { Metadata } from 'next';
import { PAGE_METADATA } from '@/lib/seo/metadata';

export const metadata: Metadata = PAGE_METADATA.privacy;

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
