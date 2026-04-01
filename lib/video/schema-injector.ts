/**
 * Schema Injector — lib/video/schema-injector.ts
 *
 * Generates VideoObject JSON-LD structured data for published episodes.
 * The schema is stored in VideoEpisode.videoObjectSchema and injected
 * into the companion blog post <head>.
 *
 * References the VideoObject template from schema-markup-service.ts
 * (line 804) and extends it with Synthex-specific E.E.A.T. signals.
 *
 * @task SYN-583
 */

import { logger } from '@/lib/logger';

// ── Types ────────────────────────────────────────────────────────────────────

export interface VideoObjectSchemaInput {
  title: string;
  description: string;
  thumbnailUrl?: string;
  uploadDate: Date;
  durationSeconds?: number;
  contentUrl?: string;
  embedUrl?: string;
  /** Author name shown in E.E.A.T. signals */
  authorName?: string;
  /** Keywords for the video */
  keywords?: string[];
}

export interface VideoObjectSchema {
  '@context': 'https://schema.org';
  '@type': 'VideoObject';
  name: string;
  description: string;
  thumbnailUrl: string | string[];
  uploadDate: string;
  duration?: string;
  contentUrl?: string;
  embedUrl?: string;
  publisher: {
    '@type': 'Organization';
    name: string;
    url: string;
    logo: {
      '@type': 'ImageObject';
      url: string;
      width: number;
      height: number;
    };
  };
  author?: {
    '@type': 'Person';
    name: string;
    url: string;
    jobTitle: string;
    worksFor: {
      '@type': 'Organization';
      name: string;
      url: string;
    };
    sameAs: string[];
  };
  keywords?: string;
  inLanguage: string;
  isFamilyFriendly: boolean;
  potentialAction: {
    '@type': 'WatchAction';
    target: string;
  };
}

// ── ISO 8601 duration formatter ───────────────────────────────────────────────

function toIso8601Duration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  let duration = 'PT';
  if (h > 0) duration += `${h}H`;
  if (m > 0) duration += `${m}M`;
  if (s > 0 || (h === 0 && m === 0)) duration += `${s}S`;
  return duration;
}

// ── Schema builder ────────────────────────────────────────────────────────────

const SYNTHEX_ORG = {
  name: 'Synthex',
  url: 'https://synthex.social',
  logoUrl: 'https://synthex.social/logo.png',
  logoWidth: 512,
  logoHeight: 512,
};

const SYNTHEX_AUTHOR = {
  name: 'Phill McGurk',
  url: 'https://synthex.social/about',
  jobTitle: 'Founder & CEO',
  worksFor: {
    name: SYNTHEX_ORG.name,
    url: SYNTHEX_ORG.url,
  },
  sameAs: [
    'https://www.linkedin.com/company/synthex-ai',
    'https://www.youtube.com/@SynthexSystem',
  ],
};

/**
 * Build a VideoObject JSON-LD schema for a published episode.
 */
export function buildVideoObjectSchema(
  input: VideoObjectSchemaInput
): VideoObjectSchema {
  const schema: VideoObjectSchema = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: input.title,
    description: input.description,
    thumbnailUrl: input.thumbnailUrl ?? `${SYNTHEX_ORG.url}/og-default.png`,
    uploadDate: input.uploadDate.toISOString(),
    publisher: {
      '@type': 'Organization',
      name: SYNTHEX_ORG.name,
      url: SYNTHEX_ORG.url,
      logo: {
        '@type': 'ImageObject',
        url: SYNTHEX_ORG.logoUrl,
        width: SYNTHEX_ORG.logoWidth,
        height: SYNTHEX_ORG.logoHeight,
      },
    },
    author: {
      '@type': 'Person',
      name: input.authorName ?? SYNTHEX_AUTHOR.name,
      url: SYNTHEX_AUTHOR.url,
      jobTitle: SYNTHEX_AUTHOR.jobTitle,
      worksFor: {
        '@type': 'Organization',
        name: SYNTHEX_AUTHOR.worksFor.name,
        url: SYNTHEX_AUTHOR.worksFor.url,
      },
      sameAs: SYNTHEX_AUTHOR.sameAs,
    },
    inLanguage: 'en-AU',
    isFamilyFriendly: true,
    potentialAction: {
      '@type': 'WatchAction',
      target: input.embedUrl ?? input.contentUrl ?? SYNTHEX_ORG.url,
    },
  };

  if (input.durationSeconds) {
    schema.duration = toIso8601Duration(input.durationSeconds);
  }

  if (input.contentUrl) {
    schema.contentUrl = input.contentUrl;
  }

  if (input.embedUrl) {
    schema.embedUrl = input.embedUrl;
  }

  if (input.keywords?.length) {
    schema.keywords = input.keywords.join(', ');
  }

  return schema;
}

/**
 * Render the schema as an inline <script> tag for injection into HTML <head>.
 */
export function renderSchemaTag(schema: VideoObjectSchema): string {
  return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
}

/**
 * Build and persist the VideoObject schema for a VideoEpisode.
 * Updates VideoEpisode.videoObjectSchema in the database.
 */
export async function injectVideoSchema(
  episodeId: string,
  input: VideoObjectSchemaInput,
  prismaClient: {
    videoEpisode: { update: (args: unknown) => Promise<unknown> };
  }
): Promise<VideoObjectSchema> {
  const schema = buildVideoObjectSchema(input);

  await prismaClient.videoEpisode.update({
    where: { id: episodeId },
    data: { videoObjectSchema: schema as unknown as Record<string, unknown> },
  });

  logger.info('SchemaInjector: VideoObject schema saved', { episodeId });
  return schema;
}
