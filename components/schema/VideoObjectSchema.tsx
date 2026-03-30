// SYN-507: VideoObject JSON-LD schema injection
// Renders structured data for Google rich results (video carousel)

import Script from 'next/script';
import type { ClientVideo } from '@/lib/videos/getClientVideos';

interface VideoObjectSchemaProps {
  videos: ClientVideo[];
  clientUrl: string;
}

export default function VideoObjectSchema({
  videos,
  clientUrl,
}: VideoObjectSchemaProps) {
  if (videos.length === 0) return null;

  const schemas = videos.map(v => ({
    '@type': 'VideoObject',
    name: v.title,
    description: v.description ?? v.title,
    thumbnailUrl:
      v.thumbnail_url ??
      `https://img.youtube.com/vi/${v.youtube_video_id}/maxresdefault.jpg`,
    uploadDate: v.upload_date ?? v.published_at.split('T')[0],
    duration: v.duration_iso ?? undefined,
    embedUrl: `https://www.youtube.com/embed/${v.youtube_video_id}`,
    contentUrl: `https://www.youtube.com/watch?v=${v.youtube_video_id}`,
    publisher: {
      '@type': 'Organization',
      name: 'Synthex',
      url: 'https://synthex.social',
    },
    isPartOf: { '@type': 'WebPage', url: clientUrl },
  }));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': schemas,
  };

  return (
    <Script
      id="video-object-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      strategy="afterInteractive"
    />
  );
}
