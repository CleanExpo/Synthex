'use client';

/**
 * YouTubeEmbedWidget — components/dashboard/YouTubeEmbedWidget.tsx
 *
 * Privacy-friendly, click-to-load YouTube embed.
 *
 * Renders a lightweight poster (thumbnail + play button) first and only mounts
 * the YouTube iframe after the user activates it. This keeps YouTube's tracking
 * cookies and ~1MB of iframe JS off the dashboard's initial render (lazy) and
 * uses the youtube-nocookie.com domain so no tracking cookie is set until the
 * viewer chooses to play.
 *
 * Accepts either a bare video ID or any common YouTube URL via `video`, parsed
 * safely by lib/youtube/parseVideoId (the id is charset-validated before it is
 * interpolated into the iframe src).
 *
 * Responsive 16:9 wrapper. WCAG AA: the poster is a real <button> (keyboard
 * focusable / Enter / Space), the iframe carries an accessible `title`, and the
 * play affordance is labelled.
 *
 * NOTE: This is the reusable *embed* piece only. The dashboard-level data
 * sourcing described in SYN-509 (join `client_videos` + YouTube Data API view
 * counts) is blocked on SYN-507 (table) / SYN-993 (Data API) and is not built
 * here. Callers pass a video id/url plus an optional title.
 *
 * @task SYN-509
 */

import { memo, useId, useState } from 'react';
import { Play } from '@/components/icons';
import { cn } from '@/lib/utils';
import { parseVideoId } from '@/lib/youtube/parseVideoId';

export interface YouTubeEmbedWidgetProps {
  /** A bare 11-char video ID or any common YouTube URL. */
  video: string;
  /** Accessible/visible title for the video (used on the iframe + poster label). */
  title: string;
  /**
   * If true, mount the iframe immediately instead of click-to-load.
   * Defaults to false (privacy-friendly click-to-load).
   */
  autoLoad?: boolean;
  /** Thumbnail quality. Defaults to 'hqdefault' (always available). */
  thumbnailQuality?: 'hqdefault' | 'mqdefault' | 'sddefault' | 'maxresdefault';
  className?: string;
}

function buildEmbedSrc(videoId: string, autoplay: boolean): string {
  const params = new URLSearchParams({ rel: '0', modestbranding: '1' });
  if (autoplay) params.set('autoplay', '1');
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

function YouTubeEmbedWidgetImpl({
  video,
  title,
  autoLoad = false,
  thumbnailQuality = 'hqdefault',
  className,
}: YouTubeEmbedWidgetProps) {
  const videoId = parseVideoId(video);
  const [activated, setActivated] = useState(autoLoad);
  const labelId = useId();

  // Invalid / unparseable input — render a graceful, non-broken placeholder
  // rather than an iframe pointing at nothing.
  if (!videoId) {
    return (
      <div
        className={cn(
          'flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400',
          className
        )}
        role="img"
        aria-label="Video unavailable"
        data-testid="youtube-embed-invalid"
      >
        Video unavailable
      </div>
    );
  }

  const iframeSrc = buildEmbedSrc(videoId, /* autoplay */ !autoLoad);
  const thumbnailSrc = `https://i.ytimg.com/vi/${videoId}/${thumbnailQuality}.jpg`;

  return (
    <div
      className={cn(
        'relative aspect-video w-full overflow-hidden rounded-lg bg-black',
        className
      )}
      data-testid="youtube-embed"
      data-video-id={videoId}
    >
      {activated ? (
        <iframe
          className="absolute inset-0 h-full w-full"
          src={iframeSrc}
          title={title}
          loading="lazy"
          allow="accelerated-download; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setActivated(true)}
          aria-labelledby={labelId}
          className="group absolute inset-0 h-full w-full cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-500/60"
          data-testid="youtube-embed-poster"
        >
          {/* Thumbnail. Lazy — off the initial render / network path. */}
          <img
            src={thumbnailSrc}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <span className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/10" />
          {/* Play button affordance */}
          <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-red-600 shadow-lg transition-transform duration-200 group-hover:scale-110">
            <Play className="ml-1 h-7 w-7 text-white" aria-hidden="true" />
          </span>
          <span id={labelId} className="sr-only">
            Play video: {title}
          </span>
        </button>
      )}
    </div>
  );
}

export const YouTubeEmbedWidget = memo(YouTubeEmbedWidgetImpl);

export default YouTubeEmbedWidget;
