import type { Metadata } from 'next';
import { IntentScapeProductTour } from '@/components/intentscape/IntentScapeProductTour';

export const metadata: Metadata = {
  title: 'Synthex Idea Explorer',
  description:
    'Turn a rough business or marketing idea into three researched directions, choose one with clear limits, and keep the resulting brief.',
};

export default function IntentScapeProductTourPage() {
  return <IntentScapeProductTour />;
}
