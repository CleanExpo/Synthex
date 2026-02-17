import type { Metadata } from 'next';
import { PAGE_METADATA } from '@/lib/seo/metadata';

export const metadata: Metadata = PAGE_METADATA.roadmap;

export default function RoadmapLayout({ children }: { children: React.ReactNode }) {
  return children;
}
