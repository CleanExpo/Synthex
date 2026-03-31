/**
 * Blog Companion — lib/video/blog-companion.ts
 *
 * Auto-generates a companion blog post when a video episode is published.
 *
 * Each blog post includes:
 *  - YouTube embed
 *  - AI-generated summary (using ContentRepurposer)
 *  - Key takeaways (bullet points from voiceover)
 *  - Timestamped segments from the script
 *  - VideoObject + BlogPosting JSON-LD schema
 *  - E.E.A.T. author attribution
 *
 * The blog post slug is derived from the episode slug:
 *   /blog/video/{series-slug}/{episode-slug}
 *
 * @task SYN-584
 */

import { logger } from '@/lib/logger';
import { ContentRepurposer } from '@/lib/ai/content-repurposer';
import {
  buildVideoObjectSchema,
  renderSchemaTag,
  type VideoObjectSchemaInput,
} from './schema-injector';
import { extractVoiceoverFromScript } from './quality-gate';
import type { GeneratedScript } from './script-generator';

// ── Types ────────────────────────────────────────────────────────────────────

export interface BlogCompanionInput {
  episodeId: string;
  episodeNumber: number;
  title: string;
  slug: string;
  seriesSlug: string;
  seriesName: string;
  seriesType: 'bts' | 'client';
  scriptContent: unknown;
  youtubeVideoId?: string | null;
  youtubeUrl?: string | null;
  thumbnailUrl?: string | null;
  publishedAt: Date;
  durationSeconds?: number;
}

export interface BlogCompanionResult {
  slug: string;
  url: string;
  htmlContent: string;
  schemaMarkup: string;
  summary: string;
  keyTakeaways: string[];
  wordCount: number;
}

// ── YouTube embed builder ─────────────────────────────────────────────────────

function buildYouTubeEmbed(videoId: string, title: string): string {
  const embedUrl = `https://www.youtube.com/embed/${videoId}`;
  return `<div class="video-embed" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:100%">
  <iframe
    src="${embedUrl}"
    title="${title.replace(/"/g, '&quot;')}"
    style="position:absolute;top:0;left:0;width:100%;height:100%;border:0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowfullscreen
    loading="lazy"
  ></iframe>
</div>`;
}

// ── Timestamp formatter ───────────────────────────────────────────────────────

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── BlogPosting schema builder ────────────────────────────────────────────────

function buildBlogPostingSchema(
  input: BlogCompanionInput,
  blogUrl: string,
  summary: string
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: input.title,
    description: summary.substring(0, 160),
    url: blogUrl,
    datePublished: input.publishedAt.toISOString(),
    dateModified: input.publishedAt.toISOString(),
    inLanguage: 'en-AU',
    author: {
      '@type': 'Person',
      name: 'Phill McGurk',
      url: 'https://synthex.social/about',
      jobTitle: 'Founder & CEO',
      worksFor: {
        '@type': 'Organization',
        name: 'Synthex',
        url: 'https://synthex.social',
      },
      sameAs: [
        'https://www.linkedin.com/company/synthex-ai',
        'https://www.youtube.com/@SynthexSystem',
      ],
    },
    publisher: {
      '@type': 'Organization',
      name: 'Synthex',
      url: 'https://synthex.social',
      logo: {
        '@type': 'ImageObject',
        url: 'https://synthex.social/logo.png',
        width: 512,
        height: 512,
      },
    },
    isPartOf: {
      '@type': 'Blog',
      name: `${input.seriesName} — Synthex Video Series`,
      url: `https://synthex.social/blog/video/${input.seriesSlug}`,
    },
    image: input.thumbnailUrl
      ? { '@type': 'ImageObject', url: input.thumbnailUrl }
      : undefined,
  };
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Generate a complete companion blog post for a published episode.
 */
export async function generateBlogCompanion(
  input: BlogCompanionInput
): Promise<BlogCompanionResult> {
  logger.info('BlogCompanion: generating post', {
    episodeId: input.episodeId,
    title: input.title,
  });

  const script = input.scriptContent as Partial<GeneratedScript> | null;
  const voiceover = extractVoiceoverFromScript(input.scriptContent);
  const segments = script?.segments ?? [];
  const description = script?.description ?? '';

  // ── Generate summary + key takeaways via ContentRepurposer ────────────────
  const repurposer = new ContentRepurposer();
  let summary = '';
  let keyTakeaways: string[] = [];

  try {
    const repurposeResult = await repurposer.repurpose({
      sourceContent: voiceover || input.title,
      sourceType: 'video_transcript',
      outputFormats: ['summary', 'key_takeaways'],
    });

    const summaryResult = repurposeResult.results.find(
      r => r.format === 'summary'
    );
    const takeawaysResult = repurposeResult.results.find(
      r => r.format === 'key_takeaways'
    );

    summary = summaryResult?.content ?? description.substring(0, 250);
    keyTakeaways =
      takeawaysResult?.content
        .split('\n')
        .filter(
          (l: string) => l.trim().startsWith('-') || l.trim().startsWith('•')
        )
        .map((l: string) => l.replace(/^[-•]\s*/, '').trim())
        .filter(Boolean)
        .slice(0, 7) ?? [];
  } catch (err) {
    logger.warn('BlogCompanion: repurposer failed — using fallback content', {
      error: String(err),
    });
    summary = description.substring(0, 250);
    keyTakeaways = [];
  }

  // ── Build blog URL ────────────────────────────────────────────────────────
  const blogSlug = `${input.seriesSlug}/${input.slug}`;
  const blogUrl = `https://synthex.social/blog/video/${blogSlug}`;

  // ── Build VideoObject schema ───────────────────────────────────────────────
  const schemaInput: VideoObjectSchemaInput = {
    title: input.title,
    description: summary,
    thumbnailUrl: input.thumbnailUrl ?? undefined,
    uploadDate: input.publishedAt,
    durationSeconds: input.durationSeconds,
    embedUrl: input.youtubeVideoId
      ? `https://www.youtube.com/embed/${input.youtubeVideoId}`
      : undefined,
    contentUrl: input.youtubeUrl ?? undefined,
    keywords: script?.tags,
  };

  const videoSchema = buildVideoObjectSchema(schemaInput);
  const blogSchema = buildBlogPostingSchema(input, blogUrl, summary);

  const schemaMarkup =
    renderSchemaTag(videoSchema) +
    '\n' +
    `<script type="application/ld+json">\n${JSON.stringify(blogSchema, null, 2)}\n</script>`;

  // ── Build HTML content ────────────────────────────────────────────────────
  const embedHtml = input.youtubeVideoId
    ? buildYouTubeEmbed(input.youtubeVideoId, input.title)
    : '';

  const takeawaysHtml =
    keyTakeaways.length > 0
      ? `<h2>Key Takeaways</h2>\n<ul>\n${keyTakeaways.map(t => `  <li>${t}</li>`).join('\n')}\n</ul>`
      : '';

  const timestampsHtml =
    segments.length > 0
      ? `<h2>Video Chapters</h2>\n<ul>\n${segments
          .map(
            s =>
              `  <li><strong>${formatTimestamp(s.startSeconds)}</strong> — ${s.title}</li>`
          )
          .join('\n')}\n</ul>`
      : '';

  const ctaHtml = input.youtubeUrl
    ? `<p><a href="${input.youtubeUrl}" rel="noopener noreferrer" target="_blank">Watch on YouTube →</a></p>`
    : '';

  const authorHtml = `<footer class="author-block">
  <p>Published by <strong>Phill McGurk</strong>, Founder & CEO at <a href="https://synthex.social">Synthex</a>.
  Synthex helps AU/NZ small businesses automate their social media marketing with AI.</p>
</footer>`;

  const htmlContent = [
    `<h1>${input.title}</h1>`,
    embedHtml,
    `<p>${summary}</p>`,
    takeawaysHtml,
    timestampsHtml,
    ctaHtml,
    authorHtml,
  ]
    .filter(Boolean)
    .join('\n\n');

  const wordCount = htmlContent
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;

  logger.info('BlogCompanion: post generated', {
    episodeId: input.episodeId,
    slug: blogSlug,
    wordCount,
  });

  return {
    slug: blogSlug,
    url: blogUrl,
    htmlContent,
    schemaMarkup,
    summary,
    keyTakeaways,
    wordCount,
  };
}
