#!/usr/bin/env npx tsx
/**
 * Brand Video Publish Pipeline
 *
 * Uploads rendered brand videos to YouTube and creates social media posts
 * in the Synthex database for scheduled publishing.
 *
 * Prerequisites:
 *   1. Videos rendered: npx tsx scripts/render-brand-videos.ts
 *   2. SEO metadata generated: npx tsx scripts/generate-brand-seo.ts
 *   3. YouTube API credentials configured (YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN)
 *
 * Usage:
 *   npx tsx scripts/publish-brand-videos.ts
 *   npx tsx scripts/publish-brand-videos.ts --brand disaster-recovery
 *   npx tsx scripts/publish-brand-videos.ts --dry-run
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { getActiveBrands, getBrandById, type BrandContent } from '../lib/remotion/brand-content';
import { YouTubeUploader, type VideoMetadata } from '../lib/video/youtube-uploader';
import { PrismaClient } from '@prisma/client';

// ── Configuration ────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_BASE = path.resolve(__dirname, '..', 'output', 'videos');

interface PublishResult {
  brand: string;
  youtubeShowcase?: { videoId: string; url: string };
  youtubeReel?: { videoId: string; url: string };
  linkedinPost?: string;
  twitterPost?: string;
  errors: string[];
}

// ── CLI Args ─────────────────────────────────────────────────────────────────

function parseArgs(): { brandFilter?: string; dryRun: boolean } {
  const args = process.argv.slice(2);
  let brandFilter: string | undefined;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--brand' && args[i + 1]) {
      brandFilter = args[++i];
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    }
  }

  return { brandFilter, dryRun };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function log(message: string): void {
  const timestamp = new Date().toISOString().slice(11, 19);
  console.log(`[${timestamp}] ${message}`);
}

function readJsonFile<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

// ── YouTube Upload ───────────────────────────────────────────────────────────

async function uploadToYouTube(
  uploader: YouTubeUploader,
  brand: BrandContent,
  dryRun: boolean,
): Promise<{
  showcase?: { videoId: string; url: string };
  reel?: { videoId: string; url: string };
  errors: string[];
}> {
  const brandDir = path.join(OUTPUT_BASE, brand.id);
  const errors: string[] = [];

  // Load metadata
  const ytMeta = readJsonFile<{
    title: string;
    description: string;
    tags: string[];
    category: string;
    shortsTitle: string;
  }>(path.join(brandDir, 'youtube-metadata.json'));

  if (!ytMeta) {
    errors.push('youtube-metadata.json not found — run generate-brand-seo.ts first');
    return { errors };
  }

  let showcase: { videoId: string; url: string } | undefined;
  let reel: { videoId: string; url: string } | undefined;

  // Upload BrandShowcase (main YouTube video)
  const showcasePath = path.join(brandDir, 'BrandShowcase.mp4');
  const showcaseThumb = path.join(brandDir, 'BrandShowcase-thumb.jpg');

  if (fs.existsSync(showcasePath)) {
    const metadata: VideoMetadata = {
      title: ytMeta.title,
      description: ytMeta.description,
      tags: ytMeta.tags,
      categoryId: ytMeta.category,
      privacyStatus: 'public',
      thumbnailPath: fs.existsSync(showcaseThumb) ? showcaseThumb : undefined,
    };

    if (dryRun) {
      log(`  [DRY RUN] Would upload BrandShowcase: "${metadata.title}"`);
      showcase = { videoId: 'DRY_RUN', url: 'https://youtube.com/watch?v=DRY_RUN' };
    } else {
      try {
        const result = await uploader.uploadVideo(showcasePath, metadata);
        showcase = { videoId: result.videoId, url: result.videoUrl };
        log(`  YouTube Showcase uploaded: ${result.videoUrl}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`BrandShowcase upload failed: ${msg}`);
        log(`  ERROR uploading BrandShowcase: ${msg}`);
      }
    }
  } else {
    errors.push('BrandShowcase.mp4 not found — render videos first');
  }

  // Upload BrandReel as YouTube Short
  const reelPath = path.join(brandDir, 'BrandReel.mp4');

  if (fs.existsSync(reelPath)) {
    const metadata: VideoMetadata = {
      title: ytMeta.shortsTitle,
      description: `${brand.tagline}\n\n${brand.hashtags.join(' ')}`,
      tags: ytMeta.tags.slice(0, 10),
      categoryId: ytMeta.category,
      privacyStatus: 'public',
    };

    if (dryRun) {
      log(`  [DRY RUN] Would upload BrandReel (Short): "${metadata.title}"`);
      reel = { videoId: 'DRY_RUN', url: 'https://youtube.com/shorts/DRY_RUN' };
    } else {
      try {
        const result = await uploader.uploadVideo(reelPath, metadata);
        reel = { videoId: result.videoId, url: result.videoUrl };
        log(`  YouTube Short uploaded: ${result.videoUrl}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`BrandReel upload failed: ${msg}`);
        log(`  ERROR uploading BrandReel: ${msg}`);
      }
    }
  }

  return { showcase, reel, errors };
}

// ── Database Post Creation ───────────────────────────────────────────────────

async function createSocialPosts(
  prisma: PrismaClient,
  brand: BrandContent,
  youtubeUrls: { showcase?: string; reel?: string },
  dryRun: boolean,
): Promise<{ linkedinPostId?: string; twitterPostId?: string; errors: string[] }> {
  const errors: string[] = [];
  const brandDir = path.join(OUTPUT_BASE, brand.id);

  const socialCopy = readJsonFile<{
    twitter: { text: string; hashtags: string[]; videoFile: string };
    linkedin: { text: string; hashtags: string[]; videoFile: string };
  }>(path.join(brandDir, 'social-copy.json'));

  if (!socialCopy) {
    errors.push('social-copy.json not found — run generate-brand-seo.ts first');
    return { errors };
  }

  // Find the organisation
  const org = await prisma.organization.findFirst({
    where: {
      OR: [
        { name: { contains: brand.brandName, mode: 'insensitive' } },
        { slug: brand.id },
      ],
    },
  });

  if (!org) {
    errors.push(`Organisation not found for ${brand.brandName}`);
    return { errors };
  }

  // Find the org owner for createdBy
  const membership = await prisma.organizationMember.findFirst({
    where: { organizationId: org.id, role: 'owner' },
  });

  if (!membership) {
    errors.push(`No owner found for ${brand.brandName}`);
    return { errors };
  }

  let linkedinPostId: string | undefined;
  let twitterPostId: string | undefined;

  // Schedule for tomorrow at 09:00 UTC
  const scheduledAt = new Date();
  scheduledAt.setDate(scheduledAt.getDate() + 1);
  scheduledAt.setHours(9, 0, 0, 0);

  // LinkedIn post (BrandSquare video)
  if (dryRun) {
    log(`  [DRY RUN] Would create LinkedIn post for ${brand.brandName}`);
    linkedinPostId = 'DRY_RUN';
  } else {
    try {
      const videoUrl = youtubeUrls.showcase || '';
      const content = `${socialCopy.linkedin.text}\n\n${videoUrl ? `Watch: ${videoUrl}` : ''}`;

      const post = await prisma.post.create({
        data: {
          content,
          platform: 'linkedin',
          status: 'scheduled',
          scheduledAt,
          organizationId: org.id,
          createdById: membership.userId,
        },
      });
      linkedinPostId = post.id;
      log(`  LinkedIn post created: ${post.id} (scheduled ${scheduledAt.toISOString()})`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`LinkedIn post creation failed: ${msg}`);
    }
  }

  // Twitter/X post (BrandReel reference)
  if (dryRun) {
    log(`  [DRY RUN] Would create X/Twitter post for ${brand.brandName}`);
    twitterPostId = 'DRY_RUN';
  } else {
    try {
      const videoUrl = youtubeUrls.reel || '';
      const content = `${socialCopy.twitter.text}\n\n${videoUrl ? videoUrl : ''}`.trim();

      const post = await prisma.post.create({
        data: {
          content: content.slice(0, 280),
          platform: 'twitter',
          status: 'scheduled',
          scheduledAt,
          organizationId: org.id,
          createdById: membership.userId,
        },
      });
      twitterPostId = post.id;
      log(`  X/Twitter post created: ${post.id} (scheduled ${scheduledAt.toISOString()})`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`X/Twitter post creation failed: ${msg}`);
    }
  }

  return { linkedinPostId, twitterPostId, errors };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { brandFilter, dryRun } = parseArgs();

  let brands = getActiveBrands();
  if (brandFilter) {
    const brand = getBrandById(brandFilter);
    if (!brand) {
      console.error(`Brand not found: ${brandFilter}`);
      process.exit(1);
    }
    brands = [brand];
  }

  console.log('\n============================');
  console.log('Brand Video Publish Pipeline');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('============================\n');

  const uploader = new YouTubeUploader();
  const prisma = new PrismaClient();
  const allResults: PublishResult[] = [];

  try {
    if (!dryRun && !uploader.isConfigured()) {
      console.error('YouTube API not configured. Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN');
      console.error('Run with --dry-run to test without YouTube credentials.');
      process.exit(1);
    }

    for (const brand of brands) {
      log(`\n--- ${brand.brandName} ---`);
      const result: PublishResult = { brand: brand.brandName, errors: [] };

      // 1. Upload to YouTube
      const ytResult = await uploadToYouTube(uploader, brand, dryRun);
      result.youtubeShowcase = ytResult.showcase;
      result.youtubeReel = ytResult.reel;
      result.errors.push(...ytResult.errors);

      // 2. Create social platform posts
      const socialResult = await createSocialPosts(
        prisma,
        brand,
        {
          showcase: ytResult.showcase?.url,
          reel: ytResult.reel?.url,
        },
        dryRun,
      );
      result.linkedinPost = socialResult.linkedinPostId;
      result.twitterPost = socialResult.twitterPostId;
      result.errors.push(...socialResult.errors);

      // 3. Save publish results
      const brandDir = path.join(OUTPUT_BASE, brand.id);
      if (fs.existsSync(brandDir)) {
        fs.writeFileSync(
          path.join(brandDir, 'publish-results.json'),
          JSON.stringify(result, null, 2),
          'utf-8',
        );
      }

      allResults.push(result);
    }

    // ── Summary ──────────────────────────────────────────────────────────────

    console.log('\n============================');
    console.log('Publish Summary');
    console.log('============================\n');

    for (const r of allResults) {
      console.log(`${r.brand}:`);
      if (r.youtubeShowcase) console.log(`  YouTube: ${r.youtubeShowcase.url}`);
      if (r.youtubeReel) console.log(`  YouTube Short: ${r.youtubeReel.url}`);
      if (r.linkedinPost) console.log(`  LinkedIn Post: ${r.linkedinPost}`);
      if (r.twitterPost) console.log(`  X/Twitter Post: ${r.twitterPost}`);
      if (r.errors.length > 0) {
        console.log(`  Errors: ${r.errors.length}`);
        for (const e of r.errors) {
          console.log(`    - ${e}`);
        }
      }
      console.log('');
    }

    const totalErrors = allResults.reduce((sum, r) => sum + r.errors.length, 0);
    if (totalErrors > 0) {
      console.log(`Total errors: ${totalErrors}`);
    }

    console.log('============================\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
