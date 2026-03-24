'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="p-6 text-center">
      <h2 className="text-lg text-white mb-2">Something went wrong</h2>
      <p className="text-sm text-white/40 mb-4">{error.message}</p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-orange-500/20 text-orange-400 rounded-sm text-sm hover:bg-orange-500/30 border-[0.5px] border-orange-500/30"
      >
        Try Again
      </button>
    </div>
  );
}
