import type { Metadata } from 'next';
import { MarketingLabPageClient } from '@/components/marketing-lab/MarketingLabPageClient';

export const metadata: Metadata = {
  title: 'Marketing Lab | Synthex',
  description:
    'Insights, content studio, brand voice, A/B tests, and psychology tools.',
};

export default function MarketingLabPage() {
  return <MarketingLabPageClient />;
}
