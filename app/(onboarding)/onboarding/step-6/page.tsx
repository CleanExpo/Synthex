'use client';

/**
 * Onboarding Step 6: REMOVED (API keys moved to Settings)
 *
 * UNI-1150: API key setup is now a post-onboarding feature accessible
 * via Settings > API Keys. Redirects to step-1 in case of stale navigation.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Step6RedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/onboarding/step-1');
  }, [router]);

  return null;
}
