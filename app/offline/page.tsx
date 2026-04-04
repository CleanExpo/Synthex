'use client';

import Link from 'next/link';
import { WifiOff } from 'lucide-react';

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-4 text-center">
      <div className="flex flex-col items-center gap-6">
        {/* Icon */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-800">
          <WifiOff className="h-10 w-10 text-gray-400" />
        </div>

        {/* Heading */}
        <div>
          <h1 className="text-2xl font-bold text-white">You&apos;re offline</h1>
          <p className="mt-2 max-w-sm text-gray-400">
            Check your internet connection and try again. Your data will sync
            automatically when you reconnect.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-cyan-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-gray-950"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg border border-gray-700 px-6 py-2.5 text-sm font-medium text-gray-300 hover:border-gray-500 hover:text-white"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
