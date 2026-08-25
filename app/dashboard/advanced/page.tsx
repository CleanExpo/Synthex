import type { Metadata } from 'next';
import { AdvancedToolsHub } from '@/components/dashboard/advanced';

export const metadata: Metadata = {
  title: 'Power Tools',
  description:
    'Browse advanced Synthex capabilities by workflow — creative production, intelligence, operations, growth, and platform tools.',
};

export default function AdvancedDashboardPage() {
  return <AdvancedToolsHub />;
}
