/**
 * Page Analysis API
 *
 * Deep single-page SEO analysis: meta tags, headings, content, images, links, schema.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { logger } from '@/lib/logger';

const RequestSchema = z.object({
  url: z.string().url('Invalid URL provided'),
});

async function analyzePageSEO(url: string) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'SynthexBot/1.0 (+https://synthex.social)' },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch page: ${res.status}`);
  }

  const html = await res.text();

  // Meta tags
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const titleValue = titleMatch?.[1]?.trim() || null;
  const titleLength = titleValue?.length || 0;

  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
  const descValue = descMatch?.[1]?.trim() || null;
  const descLength = descValue?.length || 0;

  const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i);
  const robotsMatch = html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i);

  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:title["']/i);
  const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:description["']/i);
  const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:image["']/i);
  const twitterCardMatch = html.match(/<meta[^>]+name=["']twitter:card["'][^>]+content=["']([^"']*)["']/i);

  // Headings
  const headings: Record<string, string[]> = { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [] };
  for (const tag of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    let match;
    while ((match = regex.exec(html)) !== null) {
      const text = match[1].replace(/<[^>]*>/g, '').trim();
      if (text) headings[tag].push(text);
    }
  }

  // Content metrics
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyText = bodyMatch ? bodyMatch[1].replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

  // Simple readability approximation (average words per sentence)
  const sentences = bodyText.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const avgWordsPerSentence = sentences.length > 0 ? wordCount / sentences.length : 0;
  const readabilityScore = Math.max(0, Math.min(100, Math.round(100 - Math.abs(avgWordsPerSentence - 15) * 3)));

  // Images
  const imgMatches = html.match(/<img[^>]*>/gi) || [];
  const missingAlt = imgMatches.filter(img => !img.match(/alt=["'][^"']+["']/i)).length;

  // Links
  const linkMatches = html.match(/<a[^>]+href=["']([^"']*)["']/gi) || [];
  const parsedUrl = new URL(url);
  let internalLinks = 0;
  let externalLinks = 0;
  for (const link of linkMatches) {
    const hrefMatch = link.match(/href=["']([^"']*)["']/i);
    if (!hrefMatch) continue;
    const href = hrefMatch[1];
    if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) continue;
    try {
      const linkUrl = new URL(href, url);
      if (linkUrl.hostname === parsedUrl.hostname) {
        internalLinks++;
      } else {
        externalLinks++;
      }
    } catch {
      internalLinks++; // relative links
    }
  }

  // Schema detection
  const schemaTypes: string[] = [];
  const ldJsonMatches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of ldJsonMatches) {
    const content = block.replace(/<\/?script[^>]*>/gi, '');
    try {
      const parsed = JSON.parse(content);
      if (parsed['@type']) schemaTypes.push(parsed['@type']);
      if (parsed['@graph']) {
        for (const item of parsed['@graph']) {
          if (item['@type']) schemaTypes.push(item['@type']);
        }
      }
    } catch { /* malformed JSON-LD */ }
  }

  // Score calculation
  let score = 100;
  if (!titleValue) score -= 20;
  else if (titleLength > 60) score -= 5;
  else if (titleLength < 30) score -= 5;
  if (!descValue) score -= 15;
  else if (descLength > 160) score -= 5;
  else if (descLength < 70) score -= 5;
  if (!canonicalMatch) score -= 5;
  if (!ogTitleMatch) score -= 5;
  if (!ogImageMatch) score -= 5;
  if (headings.h1.length === 0) score -= 10;
  if (headings.h1.length > 1) score -= 5;
  if (missingAlt > 0) score -= Math.min(10, missingAlt * 2);
  if (wordCount < 300) score -= 10;
  if (schemaTypes.length === 0) score -= 5;
  score = Math.max(0, score);

  return {
    url,
    timestamp: new Date().toISOString(),
    score,
    meta: {
      title: {
        value: titleValue,
        length: titleLength,
        status: !titleValue ? 'error' : titleLength > 60 || titleLength < 30 ? 'warning' : 'good',
      },
      description: {
        value: descValue,
        length: descLength,
        status: !descValue ? 'error' : descLength > 160 || descLength < 70 ? 'warning' : 'good',
      },
      canonical: canonicalMatch?.[1] || null,
      robots: robotsMatch?.[1] || null,
      ogTitle: ogTitleMatch?.[1] || null,
      ogDescription: ogDescMatch?.[1] || null,
      ogImage: ogImageMatch?.[1] || null,
      twitterCard: twitterCardMatch?.[1] || null,
    },
    headings: {
      ...headings,
      hasMultipleH1: headings.h1.length > 1,
    },
    content: {
      wordCount,
      readabilityScore,
    },
    images: {
      total: imgMatches.length,
      missingAlt,
      largeSizes: 0,
    },
    links: {
      internal: internalLinks,
      external: externalLinks,
      broken: 0,
    },
    schema: {
      types: schemaTypes.length > 0 ? schemaTypes : ['None detected'],
      valid: schemaTypes.length > 0,
    },
  };
}

export async function POST(request: NextRequest) {
  const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_WRITE);
  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      security.error === 'Authentication required' ? 401 : 403
    );
  }

  try {
    const body = await request.json();
    const validation = RequestSchema.safeParse(body);
    if (!validation.success) {
      return APISecurityChecker.createSecureResponse(
        { success: false, error: 'Invalid request', details: validation.error.errors },
        400
      );
    }

    const analysis = await analyzePageSEO(validation.data.url);
    return APISecurityChecker.createSecureResponse({ success: true, analysis });
  } catch (error) {
    logger.error('Page analysis error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to analyze page' },
      500
    );
  }
}
