import type { Metadata } from 'next';
import { IntentScapeProductTour } from '@/components/intentscape/IntentScapeProductTour';

export const metadata: Metadata = {
  title: { absolute: 'Synthex Idea Explorer' },
  description:
    'Turn a rough business or marketing idea into researched directions, choose one with clear limits, and keep the resulting brief.',
};

export default function IntentScapeProductTourPage() {
  return <IntentScapeProductTour />;
}
