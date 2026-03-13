'use client';

/**
 * Onboarding Step 4: REMOVED
 *
 * UNI-1150: This step no longer exists in the streamlined 3-step flow.
 * Redirects to complete page in case of stale navigation.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Step4RedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/onboarding/complete');
  }, [router]);

  return null;
}
