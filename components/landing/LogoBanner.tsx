'use client';

/** Industry marquee — SMB social proof strip */

const INDUSTRIES = [
  '☕ Cafes',
  '🔨 Tradies',
  '💇 Salons',
  '💪 Gyms',
  '🛍️ Retailers',
  '🏡 Real Estate',
  '📚 Coaches',
  '🍽️ Restaurants',
  '🏥 Healthcare',
  '🎓 Education',
  '🐾 Pet Services',
  '🚗 Automotive',
  '✈️ Travel',
  '💅 Beauty',
  '🏗️ Construction',
];

export function LogoBanner() {
  // Duplicate for seamless loop
  const items = [...INDUSTRIES, ...INDUSTRIES];

  return (
    <div className="relative py-5 border-y border-white/[0.04] overflow-hidden bg-[#09090B]">
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#09090B] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#09090B] to-transparent z-10 pointer-events-none" />

      <p className="text-center text-[10px] uppercase tracking-[0.3em] text-white/30 mb-3">
        Trusted by businesses across every industry
      </p>

      {/* Marquee */}
      <div
        className="flex gap-8 whitespace-nowrap"
        style={{
          animation: 'marquee 30s linear infinite',
          width: 'max-content',
        }}
      >
        {items.map((industry, i) => (
          <span
            key={i}
            className="text-sm font-medium text-white/40 hover:text-white/70 transition-colors cursor-default flex-shrink-0"
          >
            {industry}
          </span>
        ))}
      </div>

      <style jsx>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}
