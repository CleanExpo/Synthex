'use client';

/**
 * Bio Page Client Component
 *
 * @description Client-side rendering of the bio page with click tracking.
 */

import { useCallback } from 'react';
import Image from 'next/image';
import {
  Twitter,
  Instagram,
  Youtube,
  Linkedin,
  Facebook,
  Github,
  Globe,
  Mail,
  Sparkles,
} from '@/components/icons';

// =============================================================================
// Types
// =============================================================================

interface BioPageClientProps {
  page: {
    id: string;
    title: string;
    bio: string | null;
    avatarUrl: string | null;
    coverUrl: string | null;
    theme: string;
    primaryColor: string;
    backgroundColor: string;
    textColor: string;
    buttonStyle: string;
    socialLinks: Array<{ platform: string; url: string }>;
    showBranding: boolean;
  };
  links: Array<{
    id: string;
    title: string;
    url: string;
    iconType: string | null;
    iconValue: string | null;
    isHighlighted: boolean;
  }>;
}

// =============================================================================
// Social Icons Map
// =============================================================================

const SOCIAL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  twitter: Twitter,
  x: Twitter,
  instagram: Instagram,
  youtube: Youtube,
  linkedin: Linkedin,
  facebook: Facebook,
  github: Github,
  website: Globe,
  email: Mail,
};

// =============================================================================
// Component
// =============================================================================

export default function BioPageClient({ page, links }: BioPageClientProps) {
  // Track link click
  const handleLinkClick = useCallback((linkId: string) => {
    fetch(`/api/bio/${page.id}/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'click', linkId }),
    }).catch(() => {});
  }, [page.id]);

  // Button style classes
  const buttonStyles: Record<string, string> = {
    rounded: 'rounded-xl',
    pill: 'rounded-full',
    square: 'rounded-none',
  };

  const buttonClass = buttonStyles[page.buttonStyle] || buttonStyles.rounded;

  // Check if background is a gradient
  const isGradientBg = page.backgroundColor.includes('gradient');

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: isGradientBg ? page.backgroundColor : undefined,
        backgroundColor: !isGradientBg ? page.backgroundColor : undefined,
        color: page.textColor,
      }}
    >
      {/* Cover Image */}
      {page.coverUrl && (
        <div className="h-32 sm:h-48 w-full overflow-hidden">
          <img
            src={page.coverUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center px-4 py-8">
        <div className="w-full max-w-md mx-auto">
          {/* Avatar */}
          {page.avatarUrl && (
            <div className={`flex justify-center ${page.coverUrl ? '-mt-16' : ''}`}>
              <div className="relative">
                <img
                  src={page.avatarUrl}
                  alt={page.title}
                  className="w-24 h-24 rounded-full border-4 object-cover"
                  style={{ borderColor: page.backgroundColor }}
                />
              </div>
            </div>
          )}

          {/* Title */}
          <h1 className="text-2xl font-bold text-center mt-4">
            {page.title}
          </h1>

          {/* Bio */}
          {page.bio && (
            <p className="text-center mt-2 opacity-80 text-sm">
              {page.bio}
            </p>
          )}

          {/* Social Links */}
          {page.socialLinks.length > 0 && (
            <div className="flex justify-center gap-3 mt-6">
              {page.socialLinks.map((social, index) => {
                const Icon = SOCIAL_ICONS[social.platform.toLowerCase()] || Globe;
                return (
                  <a
                    key={index}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-full transition-transform hover:scale-110"
                    style={{
                      backgroundColor: `${page.primaryColor}20`,
                      color: page.primaryColor,
                    }}
                  >
                    <Icon className="w-5 h-5" />
                  </a>
                );
              })}
            </div>
          )}

          {/* Links */}
          <div className="mt-8 space-y-3">
            {links.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleLinkClick(link.id)}
                className={`
                  block w-full p-4 text-center font-medium transition-all
                  hover:scale-[1.02] hover:shadow-lg
                  ${buttonClass}
                `}
                style={{
                  backgroundColor: link.isHighlighted
                    ? page.primaryColor
                    : `${page.textColor}10`,
                  color: link.isHighlighted ? page.backgroundColor : page.textColor,
                  border: `1px solid ${page.textColor}20`,
                }}
              >
                <span className="flex items-center justify-center gap-2">
                  {/* Icon */}
                  {link.iconType === 'emoji' && link.iconValue && (
                    <span className="text-lg">{link.iconValue}</span>
                  )}
                  {link.iconType === 'lucide' && link.iconValue && (
                    <span className="text-lg">
                      {/* Would need dynamic icon loading for lucide */}
                    </span>
                  )}
                  {link.title}
                </span>
              </a>
            ))}
          </div>

          {/* Empty State */}
          {links.length === 0 && (
            <div className="text-center py-12 opacity-50">
              <p>No links yet</p>
            </div>
          )}
        </div>
      </main>

      {/* Footer - Branding */}
      {page.showBranding && (
        <footer className="py-6 text-center">
          <a
            href="https://synthex.social"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm opacity-50 hover:opacity-75 transition-opacity"
          >
            <Sparkles className="w-4 h-4" />
            Powered by Synthex
          </a>
        </footer>
      )}
    </div>
  );
}
