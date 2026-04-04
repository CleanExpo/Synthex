/**
 * VideoSchemaScript — SYN-542
 *
 * Server Component. Renders a VideoObject JSON-LD <script> tag server-side.
 * Accepts individual video props and auto-populates all 3 YouTube thumbnail
 * aspect ratios from the public img.youtube.com CDN.
 *
 * Security: dangerouslySetInnerHTML is safe here because the content is
 * JSON.stringify() of a plain object built entirely from our own props —
 * no user input or external strings are interpolated. Same pattern as
 * app/layout.tsx buildStructuredDataScripts().
 *
 * Usage (in any Server Component page):
 *   <VideoSchemaScript
 *     videoId="HbBBX0zYug4"
 *     title="Content Generator Demo"
 *     description="Watch Synthex generate platform-native posts from a single brief."
 *     uploadDate="2026-01-15"
 *     duration="PT3M30S"
 *   />
 */

interface VideoSchemaScriptProps {
  /** YouTube video ID (the 11-char code after ?v= or /embed/) */
  videoId: string;
  /** Video title — shown in Google Video rich results */
  title: string;
  /** Short description, max 150 chars recommended */
  description: string;
  /** ISO date of upload e.g. "2026-01-15" */
  uploadDate: string;
  /** ISO 8601 duration e.g. "PT5M30S" (5 min 30 sec) */
  duration: string;
}

/**
 * Returns the three standard YouTube thumbnail URLs covering
 * 4:3 (small), 4:3 (HD), and 16:9 aspect ratios.
 */
function youtubeThumbnails(videoId: string): string[] {
  return [
    `https://img.youtube.com/vi/${videoId}/default.jpg`, // 120x90  (4:3)
    `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`, // 480x360 (4:3)
    `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`, // 1280x720 (16:9)
  ];
}

export function VideoSchemaScript({
  videoId,
  title,
  description,
  uploadDate,
  duration,
}: VideoSchemaScriptProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: title,
    description:
      description.length > 150
        ? description.slice(0, 147) + '...'
        : description,
    thumbnailUrl: youtubeThumbnails(videoId),
    uploadDate,
    duration,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
    contentUrl: `https://www.youtube.com/watch?v=${videoId}`,
    interactionStatistic: {
      '@type': 'InteractionCounter',
      interactionType: { '@type': 'WatchAction' },
      userInteractionCount: 0,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Synthex',
      logo: {
        '@type': 'ImageObject',
        url: 'https://synthex.social/synthex-logo.jpg',
      },
    },
  };

  // nosec: Content is JSON.stringify of our own hardcoded object — no user input
  const jsonLd = JSON.stringify(schema);

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLd }}
    />
  );
}
