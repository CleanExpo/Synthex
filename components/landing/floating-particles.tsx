'use client';

/** Seeded PRNG — deterministic across SSR and client for a given seed */
function sr(seed: number) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

/** Animated floating particles background effect */
export function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(30)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-cyan-400/30 rounded-full animate-float"
          style={{
            left: `${(sr(i * 4) * 100).toFixed(4)}%`,
            top: `${(sr(i * 4 + 1) * 100).toFixed(4)}%`,
            animationDelay: `${(sr(i * 4 + 2) * 5).toFixed(4)}s`,
            animationDuration: `${(5 + sr(i * 4 + 3) * 10).toFixed(4)}s`,
          }}
        />
      ))}
    </div>
  );
}
