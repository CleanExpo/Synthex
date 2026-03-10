'use client';

import { FileQuestion } from '@/components/icons';
import { DashboardEmptyState } from '@/components/dashboard/empty-state';
import { useRouter } from 'next/navigation';

export default function DashboardNotFound() {
  const router = useRouter();

  return (
    <DashboardEmptyState
      icon={FileQuestion}
      title="Page Not Found"
      description="The page you're looking for doesn't exist or has been moved."
      action={{
        label: 'Go to Dashboard',
        onClick: () => router.push('/dashboard'),
      }}
      secondaryAction={{
        label: 'Go Back',
        onClick: () => router.back(),
      }}
    />
  );
}
