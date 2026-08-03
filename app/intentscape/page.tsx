import type { Metadata } from 'next';
import { IntentScapeProductTour } from '@/components/intentscape/IntentScapeProductTour';

export const metadata: Metadata = {
  title: 'Synthex Marketing Extender',
  description:
    'Turn a rough business or marketing idea into researched, competing directions, a governed vision brief and an optional Unite-Group Nexus handoff.',
};

export default function IntentScapeProductTourPage() {
  return <IntentScapeProductTour />;
}
