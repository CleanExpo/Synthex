import type { Metadata } from 'next';
import { PAGE_METADATA } from '@/lib/seo/metadata';

export const metadata: Metadata = PAGE_METADATA.signup;

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
