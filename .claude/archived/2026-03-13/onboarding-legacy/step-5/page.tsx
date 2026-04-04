'use client';

/**
 * Onboarding Step 5: REMOVED (Vetting moved to dashboard)
 *
 * UNI-1150: Business vetting/health checkup is now a post-onboarding
 * dashboard feature, not a mandatory setup gate. Redirects to step-1.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Step5RedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/onboarding/step-1');
  }, [router]);

  return null;
}
