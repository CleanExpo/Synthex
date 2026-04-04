import type { Metadata } from 'next';
import { PAGE_METADATA } from '@/lib/seo/metadata';

export const metadata: Metadata = PAGE_METADATA.contact;

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
