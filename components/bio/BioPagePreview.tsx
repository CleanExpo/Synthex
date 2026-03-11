'use client';

/**
 * Bio Page Live Preview
 *
 * @description Real-time preview of bio page in mobile device frame.
 * Updates instantly as user edits settings.
 */

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
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

interface BioPagePreviewProps {
  page: {
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

export function BioPagePreview({ page, links }: BioPagePreviewProps) {
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
    <div className="relative">
      {/* Device Frame */}
      <div className="relative w-[320px] h-[640px] bg-black rounded-[40px] p-3 shadow-2xl">
        {/* Notch */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-10" />

        {/* Screen */}
        <div
          className="w-full h-full rounded-[32px] overflow-hidden overflow-y-auto"
          style={{
            background: isGradientBg ? page.backgroundColor : undefined,
            backgroundColor: !isGradientBg ? page.backgroundColor : undefined,
            color: page.textColor,
          }}
        >
          {/* Cover Image */}
          {page.coverUrl && (
            <div className="h-24 w-full overflow-hidden">
              <img
                src={page.coverUrl}
                alt={page.title ? `Cover image for ${page.title}` : 'Bio page cover image'}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Main Content */}
          <div className="flex flex-col items-center px-4 py-6">
            {/* Avatar */}
            {page.avatarUrl && (
              <div className={cn('flex justify-center', page.coverUrl && '-mt-12')}>
                <img
                  src={page.avatarUrl}
                  alt={page.title}
                  className="w-20 h-20 rounded-full border-4 object-cover"
                  style={{ borderColor: page.backgroundColor }}
                />
              </div>
            )}

            {/* Title */}
            <h1 className="text-xl font-bold text-center mt-3">
              {page.title || 'Your Title'}
            </h1>

            {/* Bio */}
            {page.bio && (
              <p className="text-center mt-1 opacity-80 text-xs px-2">
                {page.bio}
              </p>
            )}

            {/* Social Links */}
            {page.socialLinks.length > 0 && (
              <div className="flex justify-center gap-2 mt-4">
                {page.socialLinks.map((social, index) => {
                  const Icon =
                    SOCIAL_ICONS[social.platform.toLowerCase()] || Globe;
                  return (
                    <a
                      key={index}
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-full transition-transform hover:scale-110"
                      style={{
                        backgroundColor: `${page.primaryColor}20`,
                        color: page.primaryColor,
                      }}
                      onClick={(e) => e.preventDefault()}
                    >
                      <Icon className="w-4 h-4" />
                    </a>
                  );
                })}
              </div>
            )}

            {/* Links */}
            <div className="mt-6 w-full space-y-2">
              {links.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.preventDefault()}
                  className={cn(
                    'block w-full p-3 text-center text-sm font-medium transition-all',
                    'hover:scale-[1.02] hover:shadow-lg',
                    buttonClass
                  )}
                  style={{
                    backgroundColor: link.isHighlighted
                      ? page.primaryColor
                      : `${page.textColor}10`,
                    color: link.isHighlighted
                      ? page.backgroundColor
                      : page.textColor,
                    border: `1px solid ${page.textColor}20`,
                  }}
                >
                  <span className="flex items-center justify-center gap-2">
                    {link.iconType === 'emoji' && link.iconValue && (
                      <span className="text-base">{link.iconValue}</span>
                    )}
                    {link.title}
                  </span>
                </a>
              ))}
            </div>

            {/* Empty State */}
            {links.length === 0 && (
              <div className="text-center py-8 opacity-50 text-xs">
                <p>No links yet</p>
              </div>
            )}
          </div>

          {/* Footer - Branding */}
          {page.showBranding && (
            <div className="py-4 text-center mt-auto">
              <span
                className="inline-flex items-center gap-1 text-xs opacity-50"
              >
                <Sparkles className="w-3 h-3" />
                Powered by Synthex
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Device Shadow */}
      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-[280px] h-8 bg-black/20 rounded-[100%] blur-xl" />
    </div>
  );
}

export default BioPagePreview;
