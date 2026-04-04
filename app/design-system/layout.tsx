import type { Metadata } from 'next';
import { PAGE_METADATA } from '@/lib/seo/metadata';

export const metadata: Metadata = PAGE_METADATA.designSystem;

export default function DesignSystemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
