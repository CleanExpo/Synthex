#!/usr/bin/env npx tsx
/**
 * Brand Video Upload Pipeline (DB-backed)
 *
 * Reads YouTube OAuth tokens directly from PlatformConnection records in the
 * Synthex database (decrypting the stored refreshToken), then uploads the
 * pre-rendered brand videos for each connected organisation.
 *
 * Prerequisites:
 *   1. Videos rendered: npx tsx scripts/render-brand-videos.ts
 *   2. SEO metadata generated: npx tsx scripts/generate-brand-seo.ts
 *   3. FIELD_ENCRYPTION_KEY set in .env (used to decrypt stored OAuth tokens)
 *   4. YOUTUBE_CLIENT_ID + YOUTUBE_CLIENT_SECRET set in .env
 *
 * Usage:
 *   npx tsx scripts/upload-brand-videos.ts
 *   npx tsx scripts/upload-brand-videos.ts --brand disaster-recovery
 *   npx tsx scripts/upload-brand-videos.ts --dry-run
 *   npx tsx scripts/upload-brand-videos.ts --list-connections
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { decryptField } from '../lib/security/field-encryption';
import { decryptApiKey } from '../lib/encryption/api-key-encryption';
import { YouTubeUploader } from '../lib/video/youtube-uploader';
import { getBrandById, getActiveBrands, type BrandContent } from '../lib/remotion/brand-content';

// ── Bootstrap env ────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local'), override: true });
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const OUTPUT_BASE = path.resolve(__dirname, '..', 'output', 'videos');

// ── CLI Args ─────────────────────────────────────────────────────────────────

function parseArgs(): { brandFilter?: string; dryRun: boolean; listConnections: boolean } {
  const args = process.argv.slice(2);
  let brandFilter: string | undefined;
  let dryRun = false;
  let listConnections = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--brand' && args[i + 1]) {
      brandFilter = args[++i];
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--list-connections') {
      listConnections = true;
    }
  }

  return { brandFilter, dryRun, listConnections };
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

// ── Connection resolution ─────────────────────────────────────────────────────

interface YouTubeConnection {
  orgId: string;
  orgName: string;
  orgSlug: string;
  profileId: string;
  profileName: string | null;
  refreshToken: string;
  accessToken: string | null;
}

async function getYouTubeConnections(prisma: PrismaClient): Promise<YouTubeConnection[]> {
  const connections = await prisma.platformConnection.findMany({
    where: {
      platform: 'youtube',
      deletedAt: null,
    },
    include: {
      organization: {
        select: { id: true, name: true, slug: true },
      },
    },
  });

  const result: YouTubeConnection[] = [];

  for (const conn of connections) {
    if (!conn.refreshToken) {
      log(`  SKIP ${conn.organization.name} — no refresh token stored`);
      continue;
    }

    let refreshToken: string | null = null;
    try {
      refreshToken = decryptField(conn.refreshToken);
    } catch (err) {
      log(`  SKIP ${conn.organization.name} — failed to decrypt refresh token: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    if (!refreshToken) {
      log(`  SKIP ${conn.organization.name} — decrypted refresh token is empty`);
      continue;
    }

    let accessToken: string | null = null;
    if (conn.accessToken) {
      try {
        accessToken = decryptField(conn.accessToken);
      } catch {
        // Optional — refresh token is enough
      }
    }

    result.push({
      orgId: conn.organization.id,
      orgName: conn.organization.name,
      orgSlug: conn.organization.slug,
      profileId: conn.profileId ?? '',
      profileName: conn.profileName,
      refreshToken,
      accessToken,
    });
  }

  return result;
}

// ── Brand ↔ Org mapping ───────────────────────────────────────────────────────

function findBrandForOrg(orgName: string, orgSlug: string): BrandContent | null {
  const brands = getActiveBrands();

  // Try exact slug match first
  const bySlug = brands.find((b) => b.id === orgSlug);
  if (bySlug) return bySlug;

  // Try name contains (case-insensitive)
  const lower = orgName.toLowerCase();
  const byName = brands.find((b) =>
    lower.includes(b.brandName.toLowerCase()) ||
    b.brandName.toLowerCase().includes(lower.split(' ')[0])
  );
  if (byName) return byName;

  return null;
}

// ── Upload ────────────────────────────────────────────────────────────────────

interface UploadResult {
  orgName: string;
  brandId: string;
  showcase?: { videoId: string; url: string };
  reel?: { videoId: string; url: string };
  errors: string[];
}

async function getYouTubeOAuthClient(prisma: PrismaClient): Promise<{ clientId: string; clientSecret: string } | null> {
  // Try DB first (PlatformOAuthCredential table)
  try {
    const record = await prisma.platformOAuthCredential.findUnique({
      where: { platform: 'youtube' },
    });
    if (record?.isActive && record.encryptedClientId && record.encryptedClientSecret) {
      const clientId = decryptApiKey(record.encryptedClientId);
      const clientSecret = decryptApiKey(record.encryptedClientSecret);
      if (clientId && clientSecret) {
        return { clientId, clientSecret };
      }
    }
  } catch (e) {
    log(`  Warning: DB OAuth credential lookup failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  // Fall back to env vars
  const clientId = process.env.YOUTUBE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;
  if (clientId && clientSecret) return { clientId, clientSecret };
  return null;
}

async function uploadBrandVideos(
  conn: YouTubeConnection,
  brand: BrandContent,
  dryRun: boolean,
  prisma: PrismaClient,
): Promise<UploadResult> {
  const oauthClient = await getYouTubeOAuthClient(prisma);

  if (!oauthClient) {
    return {
      orgName: conn.orgName,
      brandId: brand.id,
      errors: ['YouTube OAuth client credentials not found in DB or environment'],
    };
  }

  const { clientId, clientSecret } = oauthClient;

  const brandDir = path.join(OUTPUT_BASE, brand.id);
  const errors: string[] = [];

  const ytMeta = readJsonFile<{
    title: string;
    description: string;
    tags: string[];
    category: string;
    shortsTitle: string;
  }>(path.join(brandDir, 'youtube-metadata.json'));

  if (!ytMeta) {
    return {
      orgName: conn.orgName,
      brandId: brand.id,
      errors: [`youtube-metadata.json not found for ${brand.id} — run generate-brand-seo.ts first`],
    };
  }

  const uploader = dryRun
    ? null
    : YouTubeUploader.fromCredentials(clientId, clientSecret, conn.refreshToken);

  let showcase: { videoId: string; url: string } | undefined;
  let reel: { videoId: string; url: string } | undefined;

  // Upload BrandShowcase (main YouTube video)
  const showcasePath = path.join(brandDir, 'BrandShowcase.mp4');
  const showcaseThumb = path.join(brandDir, 'BrandShowcase-thumb.jpg');

  if (fs.existsSync(showcasePath)) {
    if (dryRun) {
      log(`  [DRY RUN] Would upload BrandShowcase for ${brand.brandName}: "${ytMeta.title}"`);
      showcase = { videoId: 'DRY_RUN', url: 'https://youtube.com/watch?v=DRY_RUN' };
    } else {
      try {
        log(`  Uploading BrandShowcase.mp4 for ${brand.brandName}…`);
        const result = await uploader!.uploadVideo(showcasePath, {
          title: ytMeta.title,
          description: ytMeta.description,
          tags: ytMeta.tags,
          categoryId: ytMeta.category,
          privacyStatus: 'public',
          thumbnailPath: fs.existsSync(showcaseThumb) ? showcaseThumb : undefined,
        });
        showcase = { videoId: result.videoId, url: result.videoUrl };
        log(`  ✓ BrandShowcase uploaded: ${result.videoUrl}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`BrandShowcase upload failed: ${msg}`);
        log(`  ✗ BrandShowcase upload failed: ${msg}`);
      }
    }
  } else {
    errors.push(`BrandShowcase.mp4 not found at ${showcasePath}`);
    log(`  ✗ BrandShowcase.mp4 not found`);
  }

  // Upload BrandReel as YouTube Short
  const reelPath = path.join(brandDir, 'BrandReel.mp4');

  if (fs.existsSync(reelPath)) {
    if (dryRun) {
      log(`  [DRY RUN] Would upload BrandReel (Short) for ${brand.brandName}: "${ytMeta.shortsTitle}"`);
      reel = { videoId: 'DRY_RUN', url: 'https://youtube.com/shorts/DRY_RUN' };
    } else {
      try {
        log(`  Uploading BrandReel.mp4 (YouTube Short) for ${brand.brandName}…`);
        const result = await uploader!.uploadVideo(reelPath, {
          title: ytMeta.shortsTitle,
          description: `${brand.tagline}\n\n${brand.hashtags.join(' ')}`,
          tags: ytMeta.tags.slice(0, 10),
          categoryId: ytMeta.category,
          privacyStatus: 'public',
        });
        reel = { videoId: result.videoId, url: result.videoUrl };
        log(`  ✓ BrandReel uploaded: ${result.videoUrl}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`BrandReel upload failed: ${msg}`);
        log(`  ✗ BrandReel upload failed: ${msg}`);
      }
    }
  } else {
    log(`  ⚠ BrandReel.mp4 not found — skipping Short`);
  }

  // Save publish results
  if (fs.existsSync(brandDir)) {
    const existing = readJsonFile<Record<string, unknown>>(path.join(brandDir, 'publish-results.json')) ?? {};
    fs.writeFileSync(
      path.join(brandDir, 'publish-results.json'),
      JSON.stringify({ ...existing, showcase, reel, errors, uploadedAt: new Date().toISOString() }, null, 2),
      'utf-8',
    );
  }

  return { orgName: conn.orgName, brandId: brand.id, showcase, reel, errors };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { brandFilter, dryRun, listConnections } = parseArgs();

  const prisma = new PrismaClient();

  console.log('\n==============================');
  console.log('Brand Video Upload Pipeline');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('==============================\n');

  try {
    log('Fetching YouTube platform connections from database…');
    const connections = await getYouTubeConnections(prisma);

    if (connections.length === 0) {
      console.error('\n✗ No active YouTube connections found in the database.');
      console.error('  Connect YouTube channels via the Synthex dashboard first.');
      process.exit(1);
    }

    log(`Found ${connections.length} YouTube connection(s):\n`);
    for (const c of connections) {
      console.log(`  • ${c.orgName} (${c.orgSlug}) — Channel: ${c.profileName ?? c.profileId}`);
    }
    console.log('');

    if (listConnections) {
      process.exit(0);
    }

    // Apply brand filter
    let filtered = connections;
    if (brandFilter) {
      const brand = getBrandById(brandFilter);
      if (!brand) {
        console.error(`Brand not found: ${brandFilter}`);
        process.exit(1);
      }
      filtered = connections.filter((c) => {
        const b = findBrandForOrg(c.orgName, c.orgSlug);
        return b?.id === brand.id;
      });
      if (filtered.length === 0) {
        console.error(`No YouTube connection found for brand: ${brandFilter} (org: ${connections.map((c) => c.orgSlug).join(', ')})`);
        process.exit(1);
      }
    }

    const allResults: UploadResult[] = [];

    for (const conn of filtered) {
      const brand = findBrandForOrg(conn.orgName, conn.orgSlug);

      if (!brand) {
        log(`\n--- ${conn.orgName} ---`);
        log(`  ⚠ No brand content found for org "${conn.orgName}" (slug: ${conn.orgSlug}) — skipping`);
        allResults.push({ orgName: conn.orgName, brandId: conn.orgSlug, errors: ['No brand content mapping found'] });
        continue;
      }

      console.log(`\n--- ${brand.brandName} (${conn.orgName}) ---`);
      const result = await uploadBrandVideos(conn, brand, dryRun, prisma);
      allResults.push(result);
    }

    // Summary
    console.log('\n==============================');
    console.log('Upload Summary');
    console.log('==============================\n');

    for (const r of allResults) {
      console.log(`${r.orgName} [${r.brandId}]:`);
      if (r.showcase) console.log(`  YouTube Main:  ${r.showcase.url}`);
      if (r.reel)     console.log(`  YouTube Short: ${r.reel.url}`);
      if (r.errors.length > 0) {
        console.log(`  Errors (${r.errors.length}):`);
        for (const e of r.errors) console.log(`    - ${e}`);
      } else {
        console.log(`  ✓ No errors`);
      }
      console.log('');
    }

    const totalErrors = allResults.reduce((n, r) => n + r.errors.length, 0);
    if (totalErrors > 0) {
      console.log(`Total errors: ${totalErrors}`);
    } else {
      console.log('All uploads completed successfully.');
    }

    console.log('==============================\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
