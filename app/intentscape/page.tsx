import type { Metadata } from 'next';
import { IntentScapeProductTour } from '@/components/intentscape/IntentScapeProductTour';

export const metadata: Metadata = {
  title: 'IntentScape Product Tour',
  description:
    'Explore how IntentScape turns a rough human signal into researched, competing directions and an approval-gated agent work packet.',
};

export default function IntentScapeProductTourPage() {
  return <IntentScapeProductTour />;
}
