/**
 * Onboarding Pipeline Orchestrator
 *
 * Runs parallel sub-agents to extract everything from a website URL:
 *   1. Website Scraper (Cheerio/Firecrawl → business data, brand, social links)
 *   2. PageSpeed Analysis (Google API → performance scores)
 *   3. AI Analysis (industry, description, persona, marketing plan)
 *   4. Social Link Verifier (HEAD checks on discovered social URLs)
 *
 * Returns a unified result that pre-populates the entire onboarding profile.
 *
 * @module lib/ai/onboarding-pipeline
 */

import { analyzeWebsite, type WebsiteAnalysisResult } from '@/lib/ai/website-analyzer';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface PipelineInput {
  url: string;
  businessName: string;
}

export interface SEOSignals {
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  h1Count: number;
  h2Count: number;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  imagesWithoutAlt: number;
  totalImages: number;
  wordCount: number;
}

export interface PageSpeedScores {
  mobile: { score: number; lcp: number; fcp: number; cls: number } | null;
  desktop: { score: number; lcp: number; fcp: number; cls: number } | null;
}

export interface SocialProfile {
  platform: string;
  url: string;
  verified: boolean;
}

export interface PipelineResult {
  // Company identity
  businessName: string;
  industry: string;
  description: string;
  teamSize: string;

  // Brand assets
  logoUrl: string | null;
  faviconUrl: string | null;
  brandColours: {
    primary: string;
    secondary?: string;
    accent?: string;
  };

  // SEO & Performance
  seoSignals: SEOSignals | null;
  seoScore: number;
  pageSpeed: PageSpeedScores;
  overallHealth: 'excellent' | 'good' | 'needs-work' | 'poor';
  healthSummary: string;
  quickWins: string[];
  contentGaps: string[];
  keywordOpportunities: string[];

  // Social profiles
  socialProfiles: SocialProfile[];
  socialHandles: Record<string, string>;

  // Content & persona
  keyTopics: string[];
  targetAudience: string;
  suggestedTone: string;
  suggestedPersonaName: string;

  // AI confidence
  confidence: number;

  // Structured data found on website
  structuredData: {
    phone?: string;
    email?: string;
    address?: string;
    abn?: string;
    googleBusinessUrl?: string;
  };

  // Raw website URL
  url: string;
}

// ============================================================================
// SUB-AGENTS
// ============================================================================

/**
 * Agent 1: Enhanced Website Scrape + AI Analysis
 * Uses existing analyzeWebsite() and enhances the scrape data.
 */
async function runWebsiteAnalysis(
  input: PipelineInput
): Promise<WebsiteAnalysisResult | null> {
  try {
    const result = await analyzeWebsite(input);
    return result;
  } catch (error) {
    logger.error('[pipeline] Website analysis failed', error instanceof Error ? error : undefined);
    return null;
  }
}

/**
 * Agent 2: PageSpeed Analysis via Google PageSpeed Insights API (no key needed)
 */
async function runPageSpeedAnalysis(url: string): Promise<PageSpeedScores> {
  const result: PageSpeedScores = { mobile: null, desktop: null };

  const strategies = ['mobile', 'desktop'] as const;
  const promises = strategies.map(async (strategy) => {
    try {
      const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&category=performance`;
      const res = await fetch(apiUrl, { signal: AbortSignal.timeout(25000) });

      if (!res.ok) return null;

      const data = await res.json();
      const audit = data?.lighthouseResult?.audits;
      const categories = data?.lighthouseResult?.categories;

      if (!audit || !categories) return null;

      return {
        strategy,
        score: Math.round((categories.performance?.score ?? 0) * 100),
        lcp: audit['largest-contentful-paint']?.numericValue ?? 0,
        fcp: audit['first-contentful-paint']?.numericValue ?? 0,
        cls: audit['cumulative-layout-shift']?.numericValue ?? 0,
      };
    } catch {
      return null;
    }
  });

  const results = await Promise.all(promises);

  for (const r of results) {
    if (!r) continue;
    if (r.strategy === 'mobile') {
      result.mobile = { score: r.score, lcp: r.lcp, fcp: r.fcp, cls: r.cls };
    } else {
      result.desktop = { score: r.score, lcp: r.lcp, fcp: r.fcp, cls: r.cls };
    }
  }

  return result;
}

/**
 * Agent 3: SEO Signal Extraction via Cheerio
 */
async function runSEOScrape(url: string): Promise<SEOSignals | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'SynthexBot/1.0 (+https://synthex.social)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return null;

    const html = await res.text();
    const { load } = await import('cheerio');
    const $ = load(html);

    // Extract SEO signals
    const title = $('title').first().text().trim() || null;
    const metaDescription = $('meta[name="description"]').attr('content')?.trim() || null;
    const h1 = $('h1').first().text().trim() || null;
    const h1Count = $('h1').length;
    const h2Count = $('h2').length;
    const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() || null;
    const ogDescription = $('meta[property="og:description"]').attr('content')?.trim() || null;
    const ogImage = $('meta[property="og:image"]').attr('content')?.trim() || null;
    const totalImages = $('img').length;
    const imagesWithoutAlt = $('img:not([alt]), img[alt=""]').length;

    // Rough word count from body text
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    const wordCount = bodyText.split(/\s+/).length;

    return {
      title,
      metaDescription,
      h1,
      h1Count,
      h2Count,
      ogTitle,
      ogDescription,
      ogImage,
      imagesWithoutAlt,
      totalImages,
      wordCount,
    };
  } catch {
    return null;
  }
}

/**
 * Agent 4: Enhanced Scrape — extract structured data, logo, favicon, contact info
 */
async function runEnhancedScrape(url: string): Promise<{
  faviconUrl: string | null;
  logoUrl: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  abn: string | null;
  googleBusinessUrl: string | null;
  socialLinks: string[];
}> {
  const result = {
    faviconUrl: null as string | null,
    logoUrl: null as string | null,
    phone: null as string | null,
    email: null as string | null,
    address: null as string | null,
    abn: null as string | null,
    googleBusinessUrl: null as string | null,
    socialLinks: [] as string[],
  };

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'SynthexBot/1.0 (+https://synthex.social)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return result;

    const html = await res.text();
    const { load } = await import('cheerio');
    const $ = load(html);
    const baseUrl = new URL(url);

    // Favicon — try multiple sources
    const faviconHref =
      $('link[rel="icon"]').attr('href') ||
      $('link[rel="shortcut icon"]').attr('href') ||
      $('link[rel="apple-touch-icon"]').attr('href');
    if (faviconHref) {
      try {
        result.faviconUrl = new URL(faviconHref, baseUrl).href;
      } catch {
        result.faviconUrl = faviconHref;
      }
    }

    // Logo — try og:image, then schema.org, then common selectors
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) {
      try {
        result.logoUrl = new URL(ogImage, baseUrl).href;
      } catch {
        result.logoUrl = ogImage;
      }
    }

    // Schema.org JSON-LD extraction
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '');
        const items = Array.isArray(json) ? json : [json];
        for (const item of items) {
          if (item['@type'] === 'Organization' || item['@type'] === 'LocalBusiness') {
            if (item.logo && !result.logoUrl) {
              result.logoUrl = typeof item.logo === 'string' ? item.logo : item.logo?.url;
            }
            if (item.telephone && !result.phone) {
              result.phone = item.telephone;
            }
            if (item.email && !result.email) {
              result.email = item.email;
            }
            if (item.address) {
              const addr = item.address;
              if (typeof addr === 'string') {
                result.address = addr;
              } else if (addr.streetAddress) {
                result.address = [
                  addr.streetAddress,
                  addr.addressLocality,
                  addr.addressRegion,
                  addr.postalCode,
                  addr.addressCountry,
                ].filter(Boolean).join(', ');
              }
            }
          }
        }
      } catch {
        // Malformed JSON-LD — ignore
      }
    });

    // Extract social media links from all anchors
    const socialDomains = [
      'instagram.com', 'facebook.com', 'linkedin.com', 'twitter.com', 'x.com',
      'tiktok.com', 'youtube.com', 'pinterest.com', 'reddit.com', 'threads.net',
    ];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      try {
        const linkUrl = new URL(href, baseUrl);
        if (socialDomains.some((d) => linkUrl.hostname.includes(d))) {
          result.socialLinks.push(linkUrl.href);
        }
        if (linkUrl.hostname.includes('google.com') && linkUrl.pathname.includes('/maps')) {
          result.googleBusinessUrl = linkUrl.href;
        }
      } catch {
        // Invalid URL — skip
      }
    });

    // ABN detection (Australian Business Number: 11-digit number)
    const abnMatch = html.match(/\bABN[:\s]*(\d{2}\s?\d{3}\s?\d{3}\s?\d{3})\b/i);
    if (abnMatch) {
      result.abn = abnMatch[1].replace(/\s/g, '');
    }

    // Email detection from mailto links
    $('a[href^="mailto:"]').each((_, el) => {
      if (!result.email) {
        const mailto = $(el).attr('href');
        if (mailto) {
          result.email = mailto.replace('mailto:', '').split('?')[0];
        }
      }
    });

    // Phone detection from tel links
    $('a[href^="tel:"]').each((_, el) => {
      if (!result.phone) {
        const tel = $(el).attr('href');
        if (tel) {
          result.phone = tel.replace('tel:', '');
        }
      }
    });
  } catch (error) {
    logger.warn('[pipeline] Enhanced scrape failed', { error: String(error) });
  }

  return result;
}

/**
 * Agent 5: Verify social URLs via HEAD requests
 */
async function verifySocialUrls(urls: string[]): Promise<SocialProfile[]> {
  const unique = [...new Set(urls)].slice(0, 15); // Cap at 15

  const results = await Promise.allSettled(
    unique.map(async (url) => {
      try {
        const res = await fetch(url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000),
          redirect: 'follow',
        });
        return { url, verified: res.ok };
      } catch {
        return { url, verified: false };
      }
    })
  );

  return results.map((r, i) => {
    const platform = detectPlatform(unique[i]);
    if (r.status === 'fulfilled') {
      return { platform, url: r.value.url, verified: r.value.verified };
    }
    return { platform, url: unique[i], verified: false };
  });
}

/**
 * Detect which platform a social URL belongs to.
 */
function detectPlatform(url: string): string {
  const hostname = new URL(url).hostname.toLowerCase();
  if (hostname.includes('instagram.com')) return 'instagram';
  if (hostname.includes('facebook.com')) return 'facebook';
  if (hostname.includes('linkedin.com')) return 'linkedin';
  if (hostname.includes('twitter.com') || hostname.includes('x.com')) return 'x';
  if (hostname.includes('tiktok.com')) return 'tiktok';
  if (hostname.includes('youtube.com')) return 'youtube';
  if (hostname.includes('pinterest.com')) return 'pinterest';
  if (hostname.includes('reddit.com')) return 'reddit';
  if (hostname.includes('threads.net')) return 'threads';
  return 'other';
}

/**
 * Compute SEO score from signals (0-100).
 */
function computeSEOScore(seo: SEOSignals): number {
  let score = 0;
  if (seo.title) score += 20;
  if (seo.metaDescription) score += 20;
  if (seo.h1) score += 20;
  if (seo.ogTitle && seo.ogDescription && seo.ogImage) score += 20;
  if (seo.totalImages === 0 || seo.imagesWithoutAlt / seo.totalImages < 0.3) score += 20;
  return score;
}

/**
 * Determine overall health rating from SEO + PageSpeed scores.
 */
function computeOverallHealth(
  seoScore: number,
  pageSpeed: PageSpeedScores
): 'excellent' | 'good' | 'needs-work' | 'poor' {
  const avgSpeed = [pageSpeed.mobile?.score, pageSpeed.desktop?.score]
    .filter((s): s is number => s !== null && s !== undefined);
  const speedAvg = avgSpeed.length > 0 ? avgSpeed.reduce((a, b) => a + b, 0) / avgSpeed.length : 50;
  const combined = (seoScore + speedAvg) / 2;

  if (combined >= 80) return 'excellent';
  if (combined >= 60) return 'good';
  if (combined >= 40) return 'needs-work';
  return 'poor';
}

// ============================================================================
// MAIN PIPELINE
// ============================================================================

/**
 * Run the full onboarding pipeline.
 * Executes all sub-agents in parallel (~15-20 seconds total).
 */
export async function runOnboardingPipeline(
  input: PipelineInput
): Promise<PipelineResult> {
  logger.info('[pipeline] Starting onboarding pipeline', { url: input.url });
  const startTime = Date.now();

  // Run all sub-agents in parallel
  const [analysisResult, pageSpeed, seoSignals, enhancedScrape] = await Promise.all([
    runWebsiteAnalysis(input),
    runPageSpeedAnalysis(input.url),
    runSEOScrape(input.url),
    runEnhancedScrape(input.url),
  ]);

  // Collect all social links from analysis + enhanced scrape
  const allSocialUrls = [
    ...enhancedScrape.socialLinks,
    ...Object.values(analysisResult?.socialHandles ?? {}).filter(Boolean),
  ];

  // Verify social URLs (runs after the main scrapes complete)
  const socialProfiles = allSocialUrls.length > 0
    ? await verifySocialUrls(allSocialUrls)
    : [];

  // Build social handles map (platform → URL)
  const socialHandles: Record<string, string> = {
    ...(analysisResult?.socialHandles ?? {}),
  };
  for (const profile of socialProfiles) {
    if (profile.platform !== 'other' && !socialHandles[profile.platform]) {
      socialHandles[profile.platform] = profile.url;
    }
  }

  // Compute scores
  const seoScore = seoSignals ? computeSEOScore(seoSignals) : 0;
  const overallHealth = computeOverallHealth(seoScore, pageSpeed);

  // Determine logo URL (prefer schema.org → og:image → favicon)
  const logoUrl = enhancedScrape.logoUrl
    || analysisResult?.logo
    || seoSignals?.ogImage
    || null;

  const elapsed = Date.now() - startTime;
  logger.info(`[pipeline] Complete in ${elapsed}ms`);

  return {
    businessName: input.businessName,
    industry: analysisResult?.industry || 'other',
    description: analysisResult?.description || seoSignals?.metaDescription || '',
    teamSize: analysisResult?.teamSize || 'small',

    logoUrl,
    faviconUrl: enhancedScrape.faviconUrl,
    brandColours: analysisResult?.brandColors || { primary: '#06b6d4' },

    seoSignals,
    seoScore,
    pageSpeed,
    overallHealth,
    healthSummary: analysisResult
      ? `${overallHealth === 'excellent' ? 'Your website is in excellent shape' : overallHealth === 'good' ? 'Your website has a solid foundation' : overallHealth === 'needs-work' ? 'Your website has room for improvement' : 'Your website needs significant attention'}. SEO score: ${seoScore}/100.`
      : 'Website analysis could not be completed. You can re-run the audit later.',
    quickWins: [],
    contentGaps: [],
    keywordOpportunities: [],

    socialProfiles,
    socialHandles,

    keyTopics: analysisResult?.keyTopics || [],
    targetAudience: analysisResult?.targetAudience || '',
    suggestedTone: analysisResult?.suggestedTone || 'professional',
    suggestedPersonaName: analysisResult?.suggestedPersonaName || input.businessName,

    confidence: analysisResult?.confidence || 30,

    structuredData: {
      phone: enhancedScrape.phone || undefined,
      email: enhancedScrape.email || undefined,
      address: enhancedScrape.address || undefined,
      abn: enhancedScrape.abn || undefined,
      googleBusinessUrl: enhancedScrape.googleBusinessUrl || undefined,
    },

    url: input.url,
  };
}
