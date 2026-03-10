'use client';

/**
 * PlatformPreview Component
 *
 * Renders a simulated social-media post card so users can visualise
 * how their content will appear on each platform before publishing.
 */

import { useMemo } from 'react';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  RefreshCw,
  Image as ImageIcon,
} from '@/components/icons';
import { SocialIcons } from '@/components/icons/social';
import { PLATFORM_LIMITS } from './platform-limits';
import { CharacterCounter } from './character-counter';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlatformPreviewProps {
  /** Platform key (e.g. "twitter", "linkedin") */
  platform: string;
  /** Content text to preview */
  content: string;
  /** Optional attached media URLs */
  mediaUrls?: string[];
  /** Optional hashtags to display */
  hashtags?: string[];
  /** Display username (defaults to "your_handle") */
  username?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateForPreview(text: string, limit: number): { text: string; truncated: boolean } {
  if (text.length <= limit) return { text, truncated: false };
  return { text: text.slice(0, limit), truncated: true };
}

/** Build a responsive media grid layout */
function MediaGrid({ urls, aspectRatio }: { urls: string[]; aspectRatio?: string }) {
  if (urls.length === 0) return null;

  const isPinStyle = aspectRatio === '2:3';

  if (urls.length === 1) {
    return (
      <div className={`mt-3 rounded-lg overflow-hidden border border-white/10 ${isPinStyle ? 'max-w-[260px]' : ''}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={urls[0]}
          alt="Preview attachment"
          className={`w-full object-cover ${isPinStyle ? 'aspect-[2/3]' : 'aspect-video'}`}
        />
      </div>
    );
  }

  if (urls.length === 2) {
    return (
      <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg overflow-hidden border border-white/10">
        {urls.map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={url}
            alt={`Attachment ${i + 1}`}
            className="w-full aspect-square object-cover"
          />
        ))}
      </div>
    );
  }

  // 3+ images: first large, rest small
  return (
    <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg overflow-hidden border border-white/10">
      <div className="col-span-1 row-span-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={urls[0]}
          alt="Attachment 1"
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex flex-col gap-1">
        {urls.slice(1, 3).map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={url}
            alt={`Attachment ${i + 2}`}
            className="w-full aspect-square object-cover"
          />
        ))}
        {urls.length > 3 && (
          <div className="flex items-center justify-center aspect-square bg-white/5 text-slate-400 text-sm font-medium">
            +{urls.length - 3}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Platform-specific content rendering
// ---------------------------------------------------------------------------

function TwitterContent({ content, maxChars }: { content: string; maxChars: number }) {
  const showThread = content.length > maxChars;
  return (
    <>
      <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">
        {showThread ? content.slice(0, maxChars) : content}
        {showThread && <span className="text-slate-500">{' '}[...]</span>}
      </p>
      {showThread && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-sky-400">
          <RefreshCw className="h-3 w-3" />
          <span>Thread: content exceeds 280 characters</span>
        </div>
      )}
    </>
  );
}

function LinkedInContent({ content }: { content: string }) {
  const previewLimit = 200;
  const showReadMore = content.length > previewLimit;
  return (
    <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">
      {showReadMore ? content.slice(0, previewLimit) : content}
      {showReadMore && (
        <span className="text-blue-400 cursor-default">{' '}...see more</span>
      )}
    </p>
  );
}

function InstagramContent({
  content,
  hasMedia,
}: {
  content: string;
  hasMedia: boolean;
}) {
  return (
    <>
      {!hasMedia && (
        <div className="mt-2 mb-3 flex items-center justify-center aspect-square rounded-lg bg-white/5 border border-white/10">
          <div className="text-center text-slate-500">
            <ImageIcon className="h-8 w-8 mx-auto mb-1" />
            <span className="text-xs">Image required for Instagram</span>
          </div>
        </div>
      )}
      <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">{content}</p>
    </>
  );
}

function DefaultContent({ content, maxChars }: { content: string; maxChars: number }) {
  const { text, truncated } = truncateForPreview(content, maxChars);
  return (
    <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">
      {text}
      {truncated && <span className="text-slate-500">{' '}[...]</span>}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PlatformPreview({
  platform,
  content,
  mediaUrls = [],
  hashtags = [],
  username = 'your_handle',
}: PlatformPreviewProps) {
  const config = PLATFORM_LIMITS[platform];

  // Fallback for unknown platforms
  const displayName = config?.displayName ?? platform;
  const brandColour = config?.brandColour ?? 'text-slate-300';
  const avatarBg = config?.avatarBg ?? 'bg-slate-500/20';
  const maxChars = config?.maxChars ?? 5000;
  const mediaAspectRatio = config?.mediaAspectRatio;

  // Get the platform icon
  const PlatformIcon = useMemo(() => {
    const key = platform as keyof typeof SocialIcons;
    return SocialIcons[key] ?? null;
  }, [platform]);

  // Full text including hashtags
  const fullContent = useMemo(() => {
    if (hashtags.length === 0) return content;
    const hashtagText = hashtags
      .map((t) => (t.startsWith('#') ? t : `#${t}`))
      .join(' ');
    return `${content}\n\n${hashtagText}`;
  }, [content, hashtags]);

  const charCount = fullContent.length;

  // Render platform-specific content
  const renderContent = () => {
    switch (platform) {
      case 'twitter':
        return <TwitterContent content={fullContent} maxChars={maxChars} />;
      case 'linkedin':
        return <LinkedInContent content={fullContent} />;
      case 'instagram':
        return <InstagramContent content={fullContent} hasMedia={mediaUrls.length > 0} />;
      default:
        return <DefaultContent content={fullContent} maxChars={maxChars} />;
    }
  };

  if (!content) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Platform header */}
      <div className="flex items-center gap-2">
        {PlatformIcon && <PlatformIcon className={`h-4 w-4 ${brandColour}`} />}
        <span className={`text-sm font-medium ${brandColour}`}>{displayName} Preview</span>
      </div>

      {/* Mock post card */}
      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4">
        {/* User info row */}
        <div className="flex items-center gap-3 mb-3">
          <div
            className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold text-white ${avatarBg}`}
          >
            {username.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {username}
            </p>
            <p className="text-xs text-slate-500">Just now</p>
          </div>
        </div>

        {/* Content */}
        {renderContent()}

        {/* Media grid */}
        {mediaUrls.length > 0 && (
          <MediaGrid urls={mediaUrls} aspectRatio={mediaAspectRatio} />
        )}

        {/* Engagement icons (decorative) */}
        <div className="flex items-center gap-6 mt-4 pt-3 border-t border-white/5">
          <button type="button" className="flex items-center gap-1.5 text-slate-500 hover:text-red-400 transition-colors" disabled>
            <Heart className="h-4 w-4" />
            <span className="text-xs">0</span>
          </button>
          <button type="button" className="flex items-center gap-1.5 text-slate-500 hover:text-cyan-400 transition-colors" disabled>
            <MessageCircle className="h-4 w-4" />
            <span className="text-xs">0</span>
          </button>
          <button type="button" className="flex items-center gap-1.5 text-slate-500 hover:text-green-400 transition-colors" disabled>
            <Share2 className="h-4 w-4" />
          </button>
          <button type="button" className="ml-auto flex items-center gap-1.5 text-slate-500 hover:text-amber-400 transition-colors" disabled>
            <Bookmark className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Character counter */}
      <CharacterCounter current={charCount} max={maxChars} />
    </div>
  );
}
