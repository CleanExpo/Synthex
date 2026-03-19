'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <h2 className="text-lg font-semibold text-white">Something went wrong</h2>
      <button
        onClick={reset}
        className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-400 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
