'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { Suspense } from 'react';

function UnsubscribedContent() {
  const params = useSearchParams();
  const error = params.get('error');

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-900/30">
          <AlertCircle className="h-8 w-8 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
        <p className="max-w-sm text-center text-gray-400">
          We couldn&apos;t process your unsubscribe request. Please{' '}
          <Link href="/contact" className="text-cyan-400 hover:underline">
            contact support
          </Link>{' '}
          if the issue persists.
        </p>
        <Link
          href="/"
          className="mt-2 text-sm text-gray-500 hover:text-gray-300"
        >
          ← Back to Synthex
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-900/30">
        <CheckCircle className="h-8 w-8 text-green-400" />
      </div>
      <h1 className="text-2xl font-bold text-white">
        You&apos;ve been unsubscribed
      </h1>
      <p className="max-w-sm text-center text-gray-400">
        You&apos;ve been removed from our mailing list. You won&apos;t receive
        any further marketing emails from Synthex.
      </p>
      <p className="text-sm text-gray-500">Changed your mind?</p>
      <Link
        href="/#newsletter"
        className="rounded-lg border border-gray-700 px-5 py-2 text-sm text-gray-300 hover:border-cyan-700 hover:text-cyan-300"
      >
        Re-subscribe
      </Link>
      <Link href="/" className="mt-1 text-sm text-gray-600 hover:text-gray-400">
        ← Back to Synthex
      </Link>
    </div>
  );
}

export default function UnsubscribedPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-4 text-center">
      <Suspense fallback={null}>
        <UnsubscribedContent />
      </Suspense>
    </main>
  );
}
