'use client';

interface HandWrittenTitleProps {
  title?: string;
  subtitle?: string;
}

function HandWrittenTitle({
  title = 'Synthex',
  subtitle = 'AI-powered marketing automation',
}: HandWrittenTitleProps) {
  return (
    <div className="relative w-full max-w-4xl mx-auto py-24">
      <div className="absolute inset-0">
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 1200 600"
          className="w-full h-full"
        >
          <title>Synthex</title>
          <path
            d="M 950 90
               C 1250 300, 1050 480, 600 520
               C 250 520, 150 480, 150 300
               C 150 120, 350 80, 600 80
               C 850 80, 950 180, 950 180"
            fill="none"
            strokeWidth="12"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-orange-400 opacity-60"
          />
        </svg>
      </div>
      <div className="relative text-center z-10 flex flex-col items-center justify-center">
        <h1 className="text-4xl md:text-6xl text-white tracking-tighter flex items-center gap-2">
          {title}
        </h1>
        {subtitle && <p className="text-xl text-white/60 mt-4">{subtitle}</p>}
      </div>
    </div>
  );
}

export { HandWrittenTitle };
