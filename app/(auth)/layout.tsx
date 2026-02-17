import type { Metadata } from 'next';
import { PAGE_METADATA } from '@/lib/seo/metadata';

export const metadata: Metadata = PAGE_METADATA.login;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
