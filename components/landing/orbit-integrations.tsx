'use client';

import React from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Platform integration icons (inline SVGs — no external image dependency)
// ---------------------------------------------------------------------------

const INTEGRATIONS = [
  {
    name: 'Instagram',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
        <rect width="24" height="24" rx="6" fill="url(#ig-grad)" />
        <circle
          cx="12"
          cy="12"
          r="4.5"
          stroke="white"
          strokeWidth="1.5"
          fill="none"
        />
        <circle cx="17" cy="7" r="1.2" fill="white" />
        <defs>
          <radialGradient id="ig-grad" cx="30%" cy="107%" r="130%">
            <stop offset="0%" stopColor="#fdf497" />
            <stop offset="45%" stopColor="#fd5949" />
            <stop offset="60%" stopColor="#d6249f" />
            <stop offset="90%" stopColor="#285AEB" />
          </radialGradient>
        </defs>
      </svg>
    ),
  },
  {
    name: 'LinkedIn',
    icon: (
      <svg viewBox="0 0 24 24" className="w-full h-full">
        <rect width="24" height="24" rx="6" fill="#0A66C2" />
        <path
          d="M7 9h2v8H7V9zm1-3a1.2 1.2 0 110 2.4A1.2 1.2 0 018 6zm4 3h2v1.1c.3-.6 1-1.1 2-1.1 2.1 0 3 1.4 3 3.3V17h-2v-4.5c0-1-.3-1.5-1.2-1.5S15 11.5 15 12.6V17h-2V9z"
          fill="white"
        />
      </svg>
    ),
  },
  {
    name: 'TikTok',
    icon: (
      <svg viewBox="0 0 24 24" className="w-full h-full">
        <rect width="24" height="24" rx="6" fill="#000" />
        <path
          d="M16 7.5a3.5 3.5 0 01-3.5-3.5v8.6a2.6 2.6 0 11-2-2.5V7.8a5.4 5.4 0 104.9 5.3V9.8a7 7 0 004.1 1.3V8.4A3.5 3.5 0 0116 7.5z"
          fill="white"
        />
      </svg>
    ),
  },
  {
    name: 'YouTube',
    icon: (
      <svg viewBox="0 0 24 24" className="w-full h-full">
        <rect width="24" height="24" rx="6" fill="#FF0000" />
        <path
          d="M19.8 8.4a2 2 0 00-1.4-1.4C17 6.6 12 6.6 12 6.6s-5 0-6.4.4A2 2 0 004.2 8.4 20 20 0 004 12a20 20 0 00.2 3.6 2 2 0 001.4 1.4c1.4.4 6.4.4 6.4.4s5 0 6.4-.4a2 2 0 001.4-1.4A20 20 0 0020 12a20 20 0 00-.2-3.6zM10.5 14.5V9.5l4.5 2.5-4.5 2.5z"
          fill="white"
        />
      </svg>
    ),
  },
  {
    name: 'Twitter / X',
    icon: (
      <svg viewBox="0 0 24 24" className="w-full h-full">
        <rect width="24" height="24" rx="6" fill="#000" />
        <path
          d="M13.7 10.7L18.3 6h-1.1L13.2 10l-3.3-4H6l4.8 7L6 18h1.1l4.2-4.5 3.4 4.5H19l-5.3-7.3zm-1.5 1.6l-.5-.7-4-5.6h1.7l3.2 4.6.5.7 4.2 5.9h-1.7l-3.4-5z"
          fill="white"
        />
      </svg>
    ),
  },
  {
    name: 'Facebook',
    icon: (
      <svg viewBox="0 0 24 24" className="w-full h-full">
        <rect width="24" height="24" rx="6" fill="#1877F2" />
        <path
          d="M13.5 8.5h2V6h-2C12.1 6 11 7.1 11 8.5V10H9v2.5h2V18h2.5v-5.5H16l.5-2.5h-2V8.5z"
          fill="white"
        />
      </svg>
    ),
  },
  {
    name: 'Pinterest',
    icon: (
      <svg viewBox="0 0 24 24" className="w-full h-full">
        <rect width="24" height="24" rx="6" fill="#E60023" />
        <path
          d="M12 4C7.6 4 4 7.6 4 12c0 3.4 2.1 6.3 5 7.6 0-.7.1-1.7.3-2.5l1.5-6.3s-.4-.7-.4-1.8c0-1.7 1-3 2.4-3 1.1 0 1.7.8 1.7 1.8 0 1.1-.7 2.8-1 4.3-.3 1.3.6 2.3 1.8 2.3 2.2 0 3.7-2.8 3.7-6.1 0-2.5-1.7-4.4-4.7-4.4-3.4 0-5.5 2.6-5.5 5.4 0 1 .3 1.7.8 2.2.2.3.2.4.2.6l-.3 1.3c-.1.3-.3.4-.6.3-1.7-.7-2.5-2.7-2.5-4.9 0-3.6 3-7.9 9-7.9 4.8 0 7.9 3.4 7.9 7.1 0 4.8-2.7 8.4-6.6 8.4-1.3 0-2.6-.7-3-1.5l-.8 3.2c-.3 1-.9 2-1.4 2.8.9.3 1.8.5 2.7.5 4.4 0 8-3.6 8-8S16.4 4 12 4z"
          fill="white"
        />
      </svg>
    ),
  },
  {
    name: 'Slack',
    icon: (
      <svg viewBox="0 0 24 24" className="w-full h-full">
        <rect width="24" height="24" rx="6" fill="#4A154B" />
        <path
          d="M9.5 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 1H8a1.5 1.5 0 000 3h1.5V8zm5 0a1.5 1.5 0 110 3h-1.5V8h1.5zm0-1a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM8 14.5a1.5 1.5 0 110 3 1.5 1.5 0 010 0zm1-1.5a1.5 1.5 0 00-3 0v1.5H7.5A1.5 1.5 0 0010 13zm5 1.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm1-1.5a1.5 1.5 0 000 3H16.5A1.5 1.5 0 0015 12h-1.5v1.5z"
          fill="white"
        />
      </svg>
    ),
  },
  {
    name: 'Google',
    icon: (
      <svg viewBox="0 0 24 24" className="w-full h-full">
        <rect width="24" height="24" rx="6" fill="white" />
        <path
          d="M12 11v2.4h4.2c-.2.9-.7 1.7-1.4 2.2l2.3 1.8c1.3-1.2 2.1-3 2.1-5.1 0-.5 0-1-.1-1.4H12v.1z"
          fill="#4285F4"
        />
        <path
          d="M6 12c0-.7.1-1.4.3-2L4 8.2C3.4 9.3 3 10.6 3 12s.4 2.7 1 3.8l2.3-1.8C6.1 13.4 6 12.7 6 12z"
          fill="#34A853"
        />
        <path
          d="M12 5.5c1.4 0 2.6.5 3.6 1.4l2.7-2.7C16.5 2.6 14.4 1.5 12 1.5c-3.9 0-7.3 2.4-8.8 5.9L5.5 9.2C6.3 7.1 8 5.5 12 5.5z"
          fill="#EA4335"
        />
        <path
          d="M12 18.5c-2.9 0-5.4-1.5-6.8-3.7L3 16.6c1.5 2.8 4.4 4.9 9 4.9 2.8 0 5.1-.9 6.8-2.5l-2.3-1.8c-.9.6-2.1 1.3-4.5 1.3z"
          fill="#FBBC05"
        />
      </svg>
    ),
  },
  {
    name: 'Zapier',
    icon: (
      <svg viewBox="0 0 24 24" className="w-full h-full">
        <rect width="24" height="24" rx="6" fill="#FF4A00" />
        <path
          d="M14.5 9.5l-1 2.5H16l-3 5-1-2.5H9.5l2.5-5L14.5 9.5z"
          fill="white"
        />
      </svg>
    ),
  },
];

// ---------------------------------------------------------------------------
// Synthex centre logo
// ---------------------------------------------------------------------------

function SynthexLogo() {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      className="w-full h-full"
      aria-label="Synthex"
    >
      <rect width="40" height="40" rx="10" fill="url(#synth-grad)" />
      <path
        d="M12 20l4-6h8l4 6-4 6h-8l-4-6z"
        stroke="white"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="20" r="2.5" fill="white" />
      <defs>
        <linearGradient id="synth-grad" x1="0" y1="0" x2="40" y2="40">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#0e7490" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Orbit ring — a single rotating ring with evenly-spaced icons
// CSS animation used for rotation; icons counter-rotate to stay upright.
// ---------------------------------------------------------------------------

interface OrbitRingProps {
  /** Ring diameter in px */
  diameter: number;
  /** Icon box size in px */
  iconSize: number;
  /** Subset of integrations to place on this ring */
  integrations: typeof INTEGRATIONS;
  /** Full revolution duration in seconds */
  duration: number;
  /** Start at a different phase so rings don't clump */
  initialRotation?: number;
}

function OrbitRing({
  diameter,
  iconSize,
  integrations,
  duration,
  initialRotation = 0,
}: OrbitRingProps) {
  const radius = diameter / 2;
  const count = integrations.length;
  const animationName = `orbit-spin-${duration}`;

  return (
    <>
      <style>{`
        @keyframes ${animationName} {
          from { transform: translate(-50%, -50%) rotate(${initialRotation}deg); }
          to   { transform: translate(-50%, -50%) rotate(${initialRotation + 360}deg); }
        }
        @keyframes counter-${animationName} {
          from { transform: rotate(-${initialRotation}deg); }
          to   { transform: rotate(-${initialRotation + 360}deg); }
        }
      `}</style>
      {/* Rotating container — the ring itself */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: diameter,
          height: diameter,
          top: '50%',
          left: '50%',
          animation: `${animationName} ${duration}s linear infinite`,
        }}
      >
        {/* Orbit ring visual */}
        <div
          className="absolute inset-0 rounded-full border-[0.5px] border-white/[0.06]"
          style={{ borderRadius: '50%' }}
        />

        {/* Icons placed at evenly-spaced angles */}
        {integrations.map((integration, index) => {
          const angleDeg = (index / count) * 360;
          const angleRad = (angleDeg * Math.PI) / 180;
          const x = radius * Math.cos(angleRad);
          const y = radius * Math.sin(angleRad);

          return (
            <div
              key={integration.name}
              className="absolute"
              style={{
                width: iconSize,
                height: iconSize,
                left: `calc(50% + ${x}px - ${iconSize / 2}px)`,
                top: `calc(50% + ${y}px - ${iconSize / 2}px)`,
              }}
            >
              {/* Counter-rotate so the icon faces up regardless of orbit angle */}
              <div
                className="w-full h-full pointer-events-auto group relative"
                style={{
                  animation: `counter-${animationName} ${duration}s linear infinite`,
                }}
              >
                <div
                  className={cn(
                    'w-full h-full rounded-sm border-[0.5px] border-white/[0.06] bg-[#0a1628] overflow-hidden',
                    'cursor-pointer transition-all duration-200',
                    'hover:border-orange-500/20 hover:shadow-[0_0_16px_rgba(245,158,11,0.15)]'
                  )}
                  style={{ padding: iconSize * 0.14 }}
                >
                  {integration.icon}
                </div>

                {/* Tooltip */}
                <div
                  className={cn(
                    'absolute -top-8 left-1/2 -translate-x-1/2',
                    'hidden group-hover:block',
                    'w-max rounded-sm bg-[#080e1a] border-[0.5px] border-white/[0.06]',
                    'px-2 py-1 text-xs text-white/60 shadow-lg pointer-events-none z-30 whitespace-nowrap'
                  )}
                >
                  {integration.name}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// OrbitIntegrations — main exported component
// ---------------------------------------------------------------------------

const ORBIT_CONFIG = [
  {
    slice: [0, 4] as [number, number],
    radiusRatio: 0.22,
    duration: 20,
    initialRotation: 0,
  },
  {
    slice: [0, 7] as [number, number],
    radiusRatio: 0.36,
    duration: 32,
    initialRotation: 45,
  },
  {
    slice: [0, 10] as [number, number],
    radiusRatio: 0.5,
    duration: 48,
    initialRotation: 20,
  },
];

export function OrbitIntegrations() {
  const [containerWidth, setContainerWidth] = React.useState(600);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const baseSize = Math.min(containerWidth * 0.9, 640);
  const centerLogoSize = Math.max(48, baseSize * 0.11);

  const iconSize =
    containerWidth < 480
      ? Math.max(24, baseSize * 0.055)
      : containerWidth < 768
        ? Math.max(28, baseSize * 0.065)
        : Math.max(32, baseSize * 0.075);

  return (
    <section className="py-16 relative w-full overflow-hidden bg-[#080e1a]">
      {/* Ambient glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="rounded-full blur-3xl opacity-20"
          style={{
            width: baseSize * 0.9,
            height: baseSize * 0.9,
            background:
              'radial-gradient(circle, rgba(245,158,11,0.18) 0%, transparent 70%)',
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center px-4">
        <h2 className="mb-4 text-3xl font-bold lg:text-5xl text-white tracking-tight">
          Integrations
        </h2>
        <p className="mb-12 max-w-xl text-white/60 text-base lg:text-lg">
          Connect your favourite social platforms and tools to your Synthex
          workflow.
        </p>

        {/* Orbit stage */}
        <div
          ref={containerRef}
          className="relative flex items-center justify-center w-full"
          style={{ height: baseSize }}
        >
          {/* Orbit rings */}
          {ORBIT_CONFIG.map((cfg, i) => (
            <OrbitRing
              key={i}
              diameter={baseSize * cfg.radiusRatio * 2}
              iconSize={iconSize}
              integrations={INTEGRATIONS.slice(...cfg.slice)}
              duration={cfg.duration}
              initialRotation={cfg.initialRotation}
            />
          ))}

          {/* Centre Synthex logo */}
          <div
            className={cn(
              'absolute z-20 rounded-sm border-[0.5px] border-orange-500/20',
              'bg-[#0a1628] shadow-[0_0_32px_rgba(245,158,11,0.15)]',
              'overflow-hidden'
            )}
            style={{
              width: centerLogoSize,
              height: centerLogoSize,
              padding: centerLogoSize * 0.12,
            }}
          >
            <SynthexLogo />
          </div>
        </div>
      </div>
    </section>
  );
}

export default OrbitIntegrations;
