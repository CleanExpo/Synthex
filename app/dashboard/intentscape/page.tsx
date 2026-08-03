import type { Metadata } from 'next';
import { IntentScapeWorkspace } from '@/components/intentscape/IntentScapeWorkspace';

export const metadata: Metadata = {
  title: 'IntentScape',
  description:
    'Expand rough human signals into evidence-backed directions before governed agent work begins.',
};

export default function IntentScapePage() {
  return <IntentScapeWorkspace />;
}
