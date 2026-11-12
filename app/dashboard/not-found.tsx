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
      description="The page you're looking for doesn't exist, has been moved, or isn't available to your account."
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
