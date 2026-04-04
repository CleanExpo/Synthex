import { Suspense } from 'react';
import { VoiceDashboardClient } from './VoiceDashboardClient';

export default function VoiceDashboardPage() {
  return (
    <Suspense>
      <VoiceDashboardClient />
    </Suspense>
  );
}
