'use client';

import { FileQuestion } from '@/components/icons';
import { DashboardEmptyState } from '@/components/dashboard/empty-state';
import { useRouter } from 'next/navigation';

export default function BioPageNotFound() {
  const router = useRouter();

  return (
    <DashboardEmptyState
      icon={FileQuestion}
      title="Bio Page Not Found"
      description="This bio page doesn't exist or has been deleted."
      action={{
        label: 'View All Bio Pages',
        onClick: () => router.push('/dashboard/bio'),
      }}
      secondaryAction={{
        label: 'Go Back',
        onClick: () => router.back(),
      }}
    />
  );
}
