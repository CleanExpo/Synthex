'use client';

/** Synthex brand logo SVG with gradient fills */
export function SynthexLogo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Top Chevron */}
      <path
        d="M50 10 L85 35 L50 45 L15 35 Z"
        fill="url(#gradient1)"
      />
      {/* Bottom Chevron */}
      <path
        d="M50 90 L85 65 L50 55 L15 65 Z"
        fill="url(#gradient2)"
      />
      <defs>
        <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
        <linearGradient id="gradient2" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
    </svg>
  );
}
