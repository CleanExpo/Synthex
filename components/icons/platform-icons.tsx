'use client';

import { SVGProps } from 'react';

interface PlatformIconProps extends SVGProps<SVGSVGElement> {
  size?: number;
  color?: string;
}

export function TwitterXIcon({ size = 24, color, className, ...props }: PlatformIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color || 'currentColor'}
      className={className}
      {...props}
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function InstagramIcon({ size = 24, color, className, ...props }: PlatformIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id="instagram-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFDC80" />
          <stop offset="25%" stopColor="#FCAF45" />
          <stop offset="50%" stopColor="#F77737" />
          <stop offset="75%" stopColor="#F56040" />
          <stop offset="87.5%" stopColor="#FD1D1D" />
          <stop offset="100%" stopColor="#E1306C" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="5" stroke={color || 'url(#instagram-gradient)'} strokeWidth="2" fill="none" />
      <circle cx="12" cy="12" r="4" stroke={color || 'url(#instagram-gradient)'} strokeWidth="2" fill="none" />
      <circle cx="17.5" cy="6.5" r="1.5" fill={color || 'url(#instagram-gradient)'} />
    </svg>
  );
}

export function LinkedInIcon({ size = 24, color, className, ...props }: PlatformIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color || '#0A66C2'}
      className={className}
      {...props}
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export function TikTokIcon({ size = 24, color, className, ...props }: PlatformIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      {...props}
    >
      <path
        d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-1-.05A6.34 6.34 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"
        fill={color || '#FF0050'}
      />
      <path
        d="M16.37 2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-1-.05A6.34 6.34 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52V6.78a4.83 4.83 0 0 1-4.26-4.78z"
        fill={color || '#00F2EA'}
      />
    </svg>
  );
}

export function FacebookIcon({ size = 24, color, className, ...props }: PlatformIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color || '#1877F2'}
      className={className}
      {...props}
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

export function YouTubeIcon({ size = 24, color, className, ...props }: PlatformIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color || '#FF0000'}
      className={className}
      {...props}
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

// Platform card component with hover effects
interface PlatformCardProps {
  name: string;
  icon: React.ReactNode;
  color: string;
  followers?: string;
}

export function PlatformCard({ name, icon, color, followers }: PlatformCardProps) {
  return (
    <div
      className="group relative p-6 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm transition-all duration-300 hover:bg-white/[0.08] hover:border-white/[0.15] hover:scale-105 hover:-translate-y-1 cursor-pointer overflow-hidden"
    >
      {/* Glow effect on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl"
        style={{ background: `radial-gradient(circle at center, ${color}20, transparent 70%)` }}
      />

      {/* Icon container with ring animation */}
      <div className="relative flex flex-col items-center gap-3">
        <div
          className="relative w-14 h-14 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
          style={{ background: `linear-gradient(135deg, ${color}20, ${color}10)` }}
        >
          {/* Animated ring */}
          <div
            className="absolute inset-0 rounded-xl border-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ borderColor: color }}
          />
          {icon}
        </div>

        <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">
          {name}
        </span>

        {followers && (
          <span className="text-xs text-white/40 group-hover:text-white/60 transition-colors">
            {followers}
          </span>
        )}
      </div>
    </div>
  );
}

// Export all platform data for easy mapping
export const platformsData = [
  { name: 'Twitter/X', Icon: TwitterXIcon, color: '#1DA1F2' },
  { name: 'Instagram', Icon: InstagramIcon, color: '#E4405F' },
  { name: 'LinkedIn', Icon: LinkedInIcon, color: '#0A66C2' },
  { name: 'TikTok', Icon: TikTokIcon, color: '#FF0050' },
  { name: 'Facebook', Icon: FacebookIcon, color: '#1877F2' },
  { name: 'YouTube', Icon: YouTubeIcon, color: '#FF0000' },
];
