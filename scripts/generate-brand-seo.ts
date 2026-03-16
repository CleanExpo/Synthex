#!/usr/bin/env npx tsx
/**
 * Brand Video SEO/AEO/GEO Metadata Generator
 *
 * Generates VideoObject schema, scores content via ContentScorer and GEO analyzer,
 * and outputs all metadata files alongside rendered videos.
 *
 * Usage:
 *   npx tsx scripts/generate-brand-seo.ts
 *   npx tsx scripts/generate-brand-seo.ts --brand disaster-recovery
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { getActiveBrands, getBrandById, type BrandContent } from '../lib/remotion/brand-content';

// ── Configuration ────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_BASE = path.resolve(__dirname, '..', 'output', 'videos');

interface VideoMeta {
  composition: string;
  filename: string;
  duration: string; // ISO 8601 duration
  durationSeconds: number;
  width: number;
  height: number;
  platform: string[];
}

const VIDEO_FORMATS: VideoMeta[] = [
  {
    composition: 'BrandShowcase',
    filename: 'BrandShowcase.mp4',
    duration: 'PT45S',
    durationSeconds: 45,
    width: 1920,
    height: 1080,
    platform: ['youtube'],
  },
  {
    composition: 'BrandReel',
    filename: 'BrandReel.mp4',
    duration: 'PT15S',
    durationSeconds: 15,
    width: 1080,
    height: 1920,
    platform: ['youtube-shorts', 'twitter', 'instagram', 'tiktok'],
  },
  {
    composition: 'BrandSquare',
    filename: 'BrandSquare.mp4',
    duration: 'PT20S',
    durationSeconds: 20,
    width: 1080,
    height: 1080,
    platform: ['linkedin', 'facebook'],
  },
];

// ── VideoObject Schema Generator ─────────────────────────────────────────────

function generateVideoObjectSchema(brand: BrandContent, video: VideoMeta): Record<string, unknown> {
  const uploadDate = new Date().toISOString();

  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: generateYouTubeTitle(brand, video),
    description: brand.youtubeDescription.slice(0, 500),
    thumbnailUrl: `https://${brand.websiteUrl}/videos/${brand.id}/${video.filename.replace('.mp4', '-thumb.jpg')}`,
    uploadDate,
    duration: video.duration,
    contentUrl: `https://${brand.websiteUrl}/videos/${brand.id}/${video.filename}`,
    embedUrl: `https://www.youtube.com/embed/PLACEHOLDER_${brand.id}_${video.composition}`,
    publisher: {
      '@type': 'Organization',
      name: brand.brandName,
      url: `https://${brand.websiteUrl}`,
      logo: {
        '@type': 'ImageObject',
        url: brand.logoUrl || `https://${brand.websiteUrl}/logo.png`,
      },
    },
    inLanguage: 'en-AU',
    isFamilyFriendly: true,
    keywords: brand.youtubeTags.join(', '),
  };
}

// ── YouTube Title Generator ──────────────────────────────────────────────────

function generateYouTubeTitle(brand: BrandContent, video: VideoMeta): string {
  const titles: Record<string, string> = {
    BrandShowcase: `${brand.brandName} | ${brand.tagline.split('.')[0]}`,
    BrandReel: `${brand.brandName} — ${brand.hookText} #Shorts`,
    BrandSquare: `${brand.brandName} | ${brand.industry}`,
  };

  const title = titles[video.composition] || `${brand.brandName} | ${brand.industry}`;

  // YouTube title max 100 chars, but <60 recommended for search
  return title.slice(0, 60);
}

// ── Content Scoring (lightweight — no external calls) ────────────────────────

function scoreContent(brand: BrandContent): {
  overall: number;
  breakdown: Record<string, number>;
  suggestions: string[];
} {
  const desc = brand.youtubeDescription;
  const suggestions: string[] = [];

  // Readability — Flesch-Kincaid approximation
  const sentences = desc.split(/[.!?]+/).filter(Boolean).length;
  const words = desc.split(/\s+/).filter(Boolean).length;
  const avgWordsPerSentence = words / Math.max(sentences, 1);
  const readability = Math.max(0, Math.min(100, 100 - (avgWordsPerSentence - 15) * 5));

  // Engagement — CTAs, questions, hooks
  const hasCTA = /visit|call|contact|learn more|get started|join|try|sign up/i.test(desc);
  const hasQuestion = /\?/.test(desc);
  const hasTimestamps = /\d{2}:\d{2}/.test(desc);
  const hasHashtags = /#\w+/.test(desc);
  const engagement = Math.min(100,
    50 + (hasCTA ? 15 : 0) + (hasQuestion ? 10 : 0) + (hasTimestamps ? 15 : 0) + (hasHashtags ? 10 : 0)
  );

  // Platform fit — YouTube description 2000+ chars, tags present
  const platformFit = Math.min(100,
    (desc.length >= 1500 ? 40 : desc.length / 1500 * 40) +
    (brand.youtubeTags.length >= 15 ? 30 : brand.youtubeTags.length / 15 * 30) +
    (hasTimestamps ? 30 : 0)
  );

  // Clarity — specific keywords, no filler
  const hasIndustryTerms = brand.youtubeTags.slice(0, 5).some((tag) =>
    desc.toLowerCase().includes(tag.toLowerCase())
  );
  const clarity = Math.min(100, 60 + (hasIndustryTerms ? 20 : 0) + (sentences > 3 ? 20 : 0));

  // Emotional — power words
  const powerWords = /powerful|trusted|proven|certified|rapid|immediate|expert|premier|leading|innovative/gi;
  const powerCount = (desc.match(powerWords) || []).length;
  const emotional = Math.min(100, 40 + powerCount * 10);

  // Overall weighted
  const overall = Math.round(
    readability * 0.20 +
    engagement * 0.25 +
    platformFit * 0.15 +
    clarity * 0.15 +
    emotional * 0.10 +
    (readability + clarity) / 2 * 0.15
  );

  if (!hasTimestamps) suggestions.push('Add timestamps/chapters to YouTube description');
  if (desc.length < 1500) suggestions.push('Expand YouTube description to 1500+ characters');
  if (brand.youtubeTags.length < 15) suggestions.push('Add more YouTube tags (target 15-20)');
  if (!hasCTA) suggestions.push('Add a clear call-to-action in the description');

  return {
    overall,
    breakdown: { readability, engagement, platformFit, clarity, emotional },
    suggestions,
  };
}

// ── GEO Score (lightweight approximation) ────────────────────────────────────

function scoreGEO(brand: BrandContent): {
  overall: number;
  breakdown: Record<string, number>;
} {
  const desc = brand.youtubeDescription;

  // Citability — clear claims, quotable statements
  const quotableStatements = desc.split(/[.!]/).filter((s) =>
    s.trim().length > 20 && s.trim().length < 200
  ).length;
  const citability = Math.min(100, quotableStatements * 8);

  // Structure — headers, lists, timestamps
  const hasTimestamps = /\d{2}:\d{2}/.test(desc);
  const hasBullets = /-\s/.test(desc);
  const hasSections = desc.split('\n\n').length >= 3;
  const structure = Math.min(100,
    30 + (hasTimestamps ? 25 : 0) + (hasBullets ? 25 : 0) + (hasSections ? 20 : 0)
  );

  // Multi-modal (video = inherently multi-modal)
  const multiModal = 85; // Video content scores high by default

  // Authority — credentials, specificity
  const hasCredentials = /certified|IICRC|40\+|years|national|Australian/i.test(desc);
  const hasSpecifics = /\d/.test(desc);
  const authority = Math.min(100,
    40 + (hasCredentials ? 30 : 0) + (hasSpecifics ? 20 : 0) + (brand.youtubeTags.length >= 10 ? 10 : 0)
  );

  // Technical — schema, tags, proper metadata
  const technical = Math.min(100,
    50 + (brand.youtubeTags.length >= 15 ? 25 : 0) + (desc.length >= 1000 ? 25 : 0)
  );

  // Weighted: Citability(25%) + Structure(20%) + MultiModal(15%) + Authority(20%) + Technical(20%)
  const overall = Math.round(
    citability * 0.25 +
    structure * 0.20 +
    multiModal * 0.15 +
    authority * 0.20 +
    technical * 0.20
  );

  return {
    overall,
    breakdown: { citability, structure, multiModal, authority, technical },
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const brandFilter = process.argv.find((_, i, arr) => arr[i - 1] === '--brand');
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
  console.log('SEO/AEO/GEO Metadata Generator');
  console.log('============================\n');

  const results: Array<{
    brand: string;
    contentScore: number;
    geoScore: number;
    suggestions: string[];
  }> = [];

  for (const brand of brands) {
    const brandDir = path.join(OUTPUT_BASE, brand.id);
    if (!fs.existsSync(brandDir)) {
      fs.mkdirSync(brandDir, { recursive: true });
    }

    console.log(`--- ${brand.brandName} ---`);

    // 1. Generate VideoObject schemas
    for (const video of VIDEO_FORMATS) {
      const schema = generateVideoObjectSchema(brand, video);
      const schemaPath = path.join(brandDir, `${video.composition}-schema.json`);
      fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2), 'utf-8');
      console.log(`  Schema: ${video.composition}-schema.json`);
    }

    // 2. YouTube metadata file
    const ytMeta = {
      title: generateYouTubeTitle(brand, VIDEO_FORMATS[0]),
      description: brand.youtubeDescription,
      tags: brand.youtubeTags,
      category: brand.youtubeCategory,
      language: 'en-AU',
      privacy: 'public',
      shortsTitle: generateYouTubeTitle(brand, VIDEO_FORMATS[1]),
    };
    fs.writeFileSync(
      path.join(brandDir, 'youtube-metadata.json'),
      JSON.stringify(ytMeta, null, 2),
      'utf-8',
    );
    console.log('  YouTube metadata generated');

    // 3. Social platform copy
    const socialCopy = {
      twitter: {
        text: brand.twitterText,
        hashtags: brand.hashtags,
        videoFile: 'BrandReel.mp4',
      },
      linkedin: {
        text: brand.linkedinText,
        hashtags: brand.hashtags.slice(0, 5),
        videoFile: 'BrandSquare.mp4',
      },
    };
    fs.writeFileSync(
      path.join(brandDir, 'social-copy.json'),
      JSON.stringify(socialCopy, null, 2),
      'utf-8',
    );
    console.log('  Social copy generated');

    // 4. Content scoring
    const contentScore = scoreContent(brand);
    console.log(`  Content Score: ${contentScore.overall}/100`);
    for (const [dim, score] of Object.entries(contentScore.breakdown)) {
      console.log(`    ${dim}: ${score}`);
    }

    // 5. GEO scoring
    const geoScore = scoreGEO(brand);
    console.log(`  GEO Score: ${geoScore.overall}/100`);
    for (const [dim, score] of Object.entries(geoScore.breakdown)) {
      console.log(`    ${dim}: ${score}`);
    }

    // 6. Write combined scores
    const scores = {
      brand: brand.brandName,
      contentScore: contentScore.overall,
      contentBreakdown: contentScore.breakdown,
      geoScore: geoScore.overall,
      geoBreakdown: geoScore.breakdown,
      suggestions: contentScore.suggestions,
      generatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(brandDir, 'seo-scores.json'),
      JSON.stringify(scores, null, 2),
      'utf-8',
    );

    results.push({
      brand: brand.brandName,
      contentScore: contentScore.overall,
      geoScore: geoScore.overall,
      suggestions: contentScore.suggestions,
    });

    console.log('');
  }

  // ── Summary ────────────────────────────────────────────────────────────────

  console.log('============================');
  console.log('SEO/GEO Score Summary');
  console.log('============================');
  console.log('');
  console.log('Brand                    Content  GEO');
  console.log('─────────────────────────────────────');

  for (const r of results) {
    const name = r.brand.padEnd(24);
    const content = String(r.contentScore).padStart(3);
    const geo = String(r.geoScore).padStart(3);
    const contentFlag = r.contentScore >= 80 ? ' ✓' : ' ⚠';
    const geoFlag = r.geoScore >= 80 ? ' ✓' : ' ⚠';
    console.log(`${name} ${content}${contentFlag}   ${geo}${geoFlag}`);
  }

  console.log('');

  const allAbove80 = results.every((r) => r.contentScore >= 80 && r.geoScore >= 80);
  if (allAbove80) {
    console.log('All brands scoring 80+ — ready for upload.');
  } else {
    console.log('Some brands below 80 — review suggestions above.');
  }

  console.log('============================\n');
}

main();
