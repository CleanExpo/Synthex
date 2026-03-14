/**
 * Website Analyzer Service
 *
 * Scrapes a business website and uses AI to extract structured business details.
 * Two-tier scraping: Firecrawl (primary) → native fetch fallback.
 *
 * Used by the onboarding flow to auto-generate business profiles from a URL.
 */

import { getAIProvider } from '@/lib/ai/providers';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface WebsiteAnalysisRequest {
  url: string;
  businessName: string;
}

export interface WebsiteAnalysisResult {
  /** Mapped to INDUSTRIES enum values (technology, ecommerce, healthcare, etc.) */
  industry: string;
  /** 2-3 sentence business description */
  description: string;
  /** Best guess: solo | small | medium | large | enterprise */
  teamSize: string;
  /** Brand colors extracted from website */
  brandColors: {
    primary: string;
    secondary?: string;
    accent?: string;
  };
  /** URL to detected logo, if found */
  logo?: string;
  /** Detected social media handles */
  socialHandles: Record<string, string>;
  /** 3-5 key content topics */
  keyTopics: string[];
  /** Inferred target audience */
  targetAudience: string;
  /** Suggested persona tone */
  suggestedTone: string;
  /** Suggested persona name */
  suggestedPersonaName: string;
  /** AI confidence score 0-100 */
  confidence: number;
  /** Raw source data from scraping */
  sourceData: {
    title: string;
    metaDescription: string;
    extractedTextPreview: string;
    socialLinksFound: string[];
  };
}

interface ScrapeResult {
  title: string;
  metaDescription: string;
  content: string;
  ogImage?: string;
  favicon?: string;
  themeColor?: string;
  socialLinks: string[];
  success: boolean;
}

// ============================================================================
// INDUSTRY & TONE MAPPINGS (must match onboarding UI options)
// ============================================================================

const VALID_INDUSTRIES = [
  'technology', 'ecommerce', 'healthcare', 'finance', 'education',
  'entertainment', 'food', 'travel', 'realestate', 'nonprofit', 'agency', 'other',
];

const VALID_TONES = [
  'professional', 'friendly', 'witty', 'inspiring', 'educational', 'bold',
];

const VALID_TEAM_SIZES = ['solo', 'small', 'medium', 'large', 'enterprise'];

// ============================================================================
// SCRAPING — TIER 1: FIRECRAWL
// ============================================================================

async function scrapeWithFirecrawl(url: string): Promise<ScrapeResult | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    logger.debug('FIRECRAWL_API_KEY not set, skipping Firecrawl');
    return null;
  }

  try {
    const { default: FirecrawlApp } = await import('@mendable/firecrawl-js');
    const firecrawl = new FirecrawlApp({ apiKey });

    // Firecrawl v4 returns a Document directly (throws on failure)
    const doc = await firecrawl.scrape(url, {
      formats: ['markdown'],
    } as any);

    if (!doc || !doc.markdown) {
      logger.warn('Firecrawl scrape returned empty document', { url });
      return null;
    }

    const metadata = doc.metadata || {};

    return {
      title: metadata.title || '',
      metaDescription: metadata.description || '',
      content: doc.markdown.slice(0, 8000),
      ogImage: metadata.ogImage || undefined,
      favicon: undefined,
      themeColor: undefined,
      socialLinks: extractSocialLinksFromText(doc.markdown),
      success: true,
    };
  } catch (error) {
    logger.warn('Firecrawl error', { url, error: String(error) });
    return null;
  }
}

// ============================================================================
// SCRAPING — TIER 2: NATIVE FETCH FALLBACK
// ============================================================================

async function scrapeWithFetch(url: string): Promise<ScrapeResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'SynthexBot/1.0 (https://synthex.social)',
        'Accept': 'text/html',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return emptyResult();
    }

    const html = await response.text();

    // Extract metadata from HTML
    const title = extractTag(html, /<title[^>]*>([^<]+)<\/title>/i);
    const metaDescription =
      extractMetaContent(html, 'description') ||
      extractMetaProperty(html, 'og:description') || '';
    const ogImage = extractMetaProperty(html, 'og:image') || undefined;
    const favicon = extractLinkHref(html, 'icon') || extractLinkHref(html, 'shortcut icon') || undefined;
    const themeColor = extractMetaContent(html, 'theme-color') || undefined;

    // Extract visible text (strip tags, limit length)
    const content = stripHtml(html).slice(0, 5000);

    // Extract social media links
    const socialLinks = extractSocialLinksFromHtml(html);

    return {
      title,
      metaDescription,
      content,
      ogImage,
      favicon,
      themeColor,
      socialLinks,
      success: true,
    };
  } catch (error) {
    logger.warn('Native fetch scrape failed', { url, error: String(error) });
    return emptyResult();
  }
}

// ============================================================================
// HTML PARSING HELPERS
// ============================================================================

function extractTag(html: string, regex: RegExp): string {
  const match = html.match(regex);
  return match?.[1]?.trim() || '';
}

function extractMetaContent(html: string, name: string): string | null {
  const regex = new RegExp(
    `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`,
    'i'
  );
  const match = html.match(regex);
  if (match) return match[1];

  // Try reverse attribute order
  const regex2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`,
    'i'
  );
  const match2 = html.match(regex2);
  return match2?.[1] || null;
}

function extractMetaProperty(html: string, property: string): string | null {
  const regex = new RegExp(
    `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
    'i'
  );
  const match = html.match(regex);
  if (match) return match[1];

  const regex2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`,
    'i'
  );
  const match2 = html.match(regex2);
  return match2?.[1] || null;
}

function extractLinkHref(html: string, rel: string): string | null {
  const regex = new RegExp(
    `<link[^>]+rel=["']${rel}["'][^>]+href=["']([^"']+)["']`,
    'i'
  );
  const match = html.match(regex);
  if (match) return match[1];

  const regex2 = new RegExp(
    `<link[^>]+href=["']([^"']+)["'][^>]+rel=["']${rel}["']`,
    'i'
  );
  const match2 = html.match(regex2);
  return match2?.[1] || null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SOCIAL_DOMAINS = [
  { domain: 'twitter.com', key: 'twitter' },
  { domain: 'x.com', key: 'twitter' },
  { domain: 'instagram.com', key: 'instagram' },
  { domain: 'linkedin.com', key: 'linkedin' },
  { domain: 'facebook.com', key: 'facebook' },
  { domain: 'youtube.com', key: 'youtube' },
  { domain: 'tiktok.com', key: 'tiktok' },
  { domain: 'pinterest.com', key: 'pinterest' },
  { domain: 'reddit.com', key: 'reddit' },
  { domain: 'threads.net', key: 'threads' },
];

function extractSocialLinksFromHtml(html: string): string[] {
  const links: string[] = [];
  const hrefRegex = /href=["'](https?:\/\/[^"']+)["']/gi;
  let match;
  while ((match = hrefRegex.exec(html)) !== null) {
    const url = match[1];
    if (SOCIAL_DOMAINS.some((s) => url.includes(s.domain))) {
      links.push(url);
    }
  }
  return [...new Set(links)];
}

function extractSocialLinksFromText(text: string): string[] {
  const links: string[] = [];
  const urlRegex = /https?:\/\/[^\s)\]]+/g;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0];
    if (SOCIAL_DOMAINS.some((s) => url.includes(s.domain))) {
      links.push(url);
    }
  }
  return [...new Set(links)];
}

function emptyResult(): ScrapeResult {
  return {
    title: '',
    metaDescription: '',
    content: '',
    socialLinks: [],
    success: false,
  };
}

// ============================================================================
// AI ANALYSIS
// ============================================================================

function buildAnalysisPrompt(businessName: string, scrapeData: ScrapeResult): string {
  return `You are a business analyst. Analyze this website data and extract structured business details.

BUSINESS NAME: ${businessName}
WEBSITE TITLE: ${scrapeData.title}
META DESCRIPTION: ${scrapeData.metaDescription}
SOCIAL LINKS FOUND: ${scrapeData.socialLinks.join(', ') || 'None'}
WEBSITE CONTENT (excerpt):
${scrapeData.content.slice(0, 4000)}

Return a JSON object with EXACTLY these fields:

{
  "industry": "<one of: ${VALID_INDUSTRIES.join(', ')}>",
  "description": "<2-3 sentence business description>",
  "teamSize": "<one of: ${VALID_TEAM_SIZES.join(', ')} — best guess based on signals>",
  "brandColors": {
    "primary": "<hex color — extract from website or infer from branding>",
    "secondary": "<hex color or null>",
    "accent": "<hex color or null>"
  },
  "socialHandles": {
    "<platform>": "<handle or URL>"
  },
  "keyTopics": ["<topic1>", "<topic2>", "<topic3>"],
  "targetAudience": "<1-2 sentence description of target audience>",
  "suggestedTone": "<one of: ${VALID_TONES.join(', ')}>",
  "suggestedPersonaName": "<creative persona name based on brand identity>",
  "confidence": <0-100 integer — how confident you are in these results>
}

RULES:
- industry MUST be one of the exact values listed above
- suggestedTone MUST be one of the exact values listed above
- teamSize MUST be one of the exact values listed above
- socialHandles should map detected social links to platform keys (twitter, instagram, linkedin, facebook, youtube, tiktok, pinterest, reddit, threads)
- If you cannot determine a value, make your best guess and lower the confidence score
- Return ONLY valid JSON, no markdown fences or explanation`;
}

async function analyzeWithAI(
  businessName: string,
  scrapeData: ScrapeResult
): Promise<Omit<WebsiteAnalysisResult, 'sourceData'> | null> {
  try {
    const ai = getAIProvider();
    const prompt = buildAnalysisPrompt(businessName, scrapeData);

    const response = await ai.complete({
      model: ai.models.balanced,
      messages: [
        { role: 'system', content: 'You are a precise business analyst. Return only valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content || '';

    // Parse JSON — handle markdown fences if present
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    // Validate and clamp values to valid enums
    return {
      industry: VALID_INDUSTRIES.includes(parsed.industry) ? parsed.industry : 'other',
      description: String(parsed.description || '').slice(0, 500),
      teamSize: VALID_TEAM_SIZES.includes(parsed.teamSize) ? parsed.teamSize : 'small',
      brandColors: {
        primary: parsed.brandColors?.primary || '#06b6d4',
        secondary: parsed.brandColors?.secondary || undefined,
        accent: parsed.brandColors?.accent || undefined,
      },
      logo: scrapeData.ogImage || undefined,
      socialHandles: parsed.socialHandles || {},
      keyTopics: Array.isArray(parsed.keyTopics) ? parsed.keyTopics.slice(0, 5) : [],
      targetAudience: String(parsed.targetAudience || ''),
      suggestedTone: VALID_TONES.includes(parsed.suggestedTone) ? parsed.suggestedTone : 'professional',
      suggestedPersonaName: String(parsed.suggestedPersonaName || businessName),
      confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 50)),
    };
  } catch (error) {
    logger.error('AI analysis failed', { error: String(error) });
    return null;
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Analyze a business website and return structured business details.
 *
 * Uses Firecrawl for scraping (if API key available), with native fetch fallback.
 * Then sends scraped content to AI for structured extraction.
 *
 * @param request - Business name and website URL
 * @returns Structured business analysis, or null if completely failed
 */
export async function analyzeWebsite(
  request: WebsiteAnalysisRequest
): Promise<WebsiteAnalysisResult | null> {
  const { url, businessName } = request;

  logger.info('Starting website analysis', { url, businessName });

  // Tier 1: Try Firecrawl
  let scrapeData = await scrapeWithFirecrawl(url);

  // Tier 2: Fallback to native fetch
  if (!scrapeData) {
    logger.info('Falling back to native fetch', { url });
    scrapeData = await scrapeWithFetch(url);
  }

  // If scraping completely failed, return minimal result
  if (!scrapeData.success && !scrapeData.title && !scrapeData.content) {
    logger.warn('All scraping methods failed', { url });
    return {
      industry: 'other',
      description: '',
      teamSize: 'small',
      brandColors: { primary: '#06b6d4' },
      socialHandles: {},
      keyTopics: [],
      targetAudience: '',
      suggestedTone: 'professional',
      suggestedPersonaName: businessName,
      confidence: 0,
      sourceData: {
        title: '',
        metaDescription: '',
        extractedTextPreview: '',
        socialLinksFound: [],
      },
    };
  }

  // Send to AI for analysis
  const aiResult = await analyzeWithAI(businessName, scrapeData);

  // Build social handles from scraped links if AI didn't extract them
  const scrapedHandles: Record<string, string> = {};
  for (const link of scrapeData.socialLinks) {
    for (const { domain, key } of SOCIAL_DOMAINS) {
      if (link.includes(domain) && !scrapedHandles[key]) {
        scrapedHandles[key] = link;
      }
    }
  }

  if (aiResult) {
    // Merge scraped social handles with AI-detected ones (AI takes priority)
    const mergedHandles = { ...scrapedHandles, ...aiResult.socialHandles };

    return {
      ...aiResult,
      logo: aiResult.logo || scrapeData.ogImage,
      socialHandles: mergedHandles,
      sourceData: {
        title: scrapeData.title,
        metaDescription: scrapeData.metaDescription,
        extractedTextPreview: scrapeData.content.slice(0, 500),
        socialLinksFound: scrapeData.socialLinks,
      },
    };
  }

  // AI failed — return scrape-only result with low confidence
  return {
    industry: 'other',
    description: scrapeData.metaDescription || '',
    teamSize: 'small',
    brandColors: {
      primary: scrapeData.themeColor || '#06b6d4',
    },
    logo: scrapeData.ogImage,
    socialHandles: scrapedHandles,
    keyTopics: [],
    targetAudience: '',
    suggestedTone: 'professional',
    suggestedPersonaName: businessName,
    confidence: 15,
    sourceData: {
      title: scrapeData.title,
      metaDescription: scrapeData.metaDescription,
      extractedTextPreview: scrapeData.content.slice(0, 500),
      socialLinksFound: scrapeData.socialLinks,
    },
  };
}
