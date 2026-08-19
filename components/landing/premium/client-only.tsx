'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

function ClientOnlyPassThrough({ children }: { children: ReactNode }) {
  return children;
}

/** Renders children only in the browser — skips SSR to prevent hydration drift. */
export const ClientOnly = dynamic(
  () => Promise.resolve({ default: ClientOnlyPassThrough }),
  { ssr: false }
);
