/**
 * Business Vetting Service
 *
 * Comprehensive health checks for:
 * - SEO (Search Engine Optimization)
 * - AEO (AI Engine Optimization)
 * - GEO (Geographic/Local SEO)
 * - Social Media Presence
 *
 * Returns overall score (0-100) and component scores.
 */

export interface VettingInput {
  businessName: string;
  website?: string;
  abnNumber?: string;
  businessLocation?: string;
}

export interface HealthCheckResult {
  overallScore: number;
  seoScore: number;
  aeoScore: number;
  geoScore: number;
  socialScore: number;
  seoDetails: SEODetails;
  aeoDetails: AEODetails;
  geoDetails: GEODetails;
  socialDetails: SocialDetails;
  recommendations: string[];
}

export interface SEODetails {
  mobileReady: boolean;
  hasRobotsTxt: boolean;
  hasSitemap: boolean;
  coreWebVitalsStatus?: string;
  indexingStatus?: string;
  metaTagsComplete: boolean;
  schemaMarkupPresent: boolean;
  mobileSpeed?: number;
  desktopSpeed?: number;
}

export interface AEODetails {
  schemaMarkup: string[];
  entityData: string[];
  eeatSignals: string[];
  aiAccessibility: boolean;
  contentStructure: string;
}

export interface GEODetails {
  googleBusinessProfile: boolean;
  localCitations: number;
  localKeywords: string[];
  mapsSignals: string;
  averageRating?: number;
  reviewCount?: number;
}

export interface SocialDetails {
  platforms: Array<{
    name: string;
    handle: string;
    followers?: number;
    isVerified?: boolean;
    lastPostDate?: string;
  }>;
  overallPresence: string;
  engagementLevel: string;
}

/**
 * Check SEO health of a website
 */
async function checkSEO(url: string): Promise<{ score: number; details: SEODetails }> {
  const details: SEODetails = {
    mobileReady: false,
    hasRobotsTxt: false,
    hasSitemap: false,
    metaTagsComplete: false,
    schemaMarkupPresent: false,
  };

  let score = 0;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SynthexBot/1.0)',
      },
    });

    if (!response.ok) {
      return { score: 10, details };
    }

    const html = await response.text();

    // Check for mobile meta tag
    if (html.includes('viewport')) {
      details.mobileReady = true;
      score += 15;
    }

    // Check for robots.txt by fetching it directly
    try {
      const robotsUrl = new URL('/robots.txt', url).href;
      const robotsRes = await fetch(robotsUrl, { signal: AbortSignal.timeout(5000) });
      if (robotsRes.ok) {
        const robotsText = await robotsRes.text();
        details.hasRobotsTxt = robotsText.toLowerCase().includes('user-agent');
        if (details.hasRobotsTxt) {
          score += 10;
          // Check for sitemap reference in robots.txt
          if (robotsText.toLowerCase().includes('sitemap:')) {
            details.hasSitemap = true;
            score += 10;
          }
        }
      }
    } catch {
      // robots.txt not reachable — that's a signal in itself
    }

    // Fallback sitemap check from HTML if not found in robots.txt
    if (!details.hasSitemap && html.includes('sitemap')) {
      details.hasSitemap = true;
      score += 10;
    }

    // Check for basic meta tags
    const metaTagsRegex = /<meta\s+(?:name|property)="(og:|twitter:|description|keywords)"/gi;
    const metaTags = html.match(metaTagsRegex) || [];
    if (metaTags.length >= 3) {
      details.metaTagsComplete = true;
      score += 15;
    }

    // Check for Schema.org markup
    if (html.includes('schema.org') || html.includes('ld+json')) {
      details.schemaMarkupPresent = true;
      score += 20;
    }

    // Basic heading structure check
    const h1Count = (html.match(/<h1>/gi) || []).length;
    if (h1Count > 0) {
      score += 15;
    }

    // Fetch real PageSpeed scores from Google PageSpeed Insights API (free tier)
    try {
      const encodedUrl = encodeURIComponent(url);
      const [mobileRes, desktopRes] = await Promise.allSettled([
        fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodedUrl}&strategy=mobile&category=performance`, { signal: AbortSignal.timeout(15000) }),
        fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodedUrl}&strategy=desktop&category=performance`, { signal: AbortSignal.timeout(15000) }),
      ]);
      if (mobileRes.status === 'fulfilled' && mobileRes.value.ok) {
        const mData = await mobileRes.value.json();
        details.mobileSpeed = Math.round((mData?.lighthouseResult?.categories?.performance?.score ?? 0) * 100);
      }
      if (desktopRes.status === 'fulfilled' && desktopRes.value.ok) {
        const dData = await desktopRes.value.json();
        details.desktopSpeed = Math.round((dData?.lighthouseResult?.categories?.performance?.score ?? 0) * 100);
      }
    } catch {
      // PageSpeed API unavailable — leave speeds as undefined (honest reporting)
    }

  } catch (error) {
    console.error('[SEO Check] Error:', error);
  }

  return { score: Math.min(score, 100), details };
}

/**
 * Check AEO (AI Engine Optimization) health
 */
async function checkAEO(url: string): Promise<{ score: number; details: AEODetails }> {
  const details: AEODetails = {
    schemaMarkup: [],
    entityData: [],
    eeatSignals: [],
    aiAccessibility: false,
    contentStructure: 'standard',
  };

  let score = 0;

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!response.ok) {
      return { score: 15, details };
    }

    const html = await response.text();

    // Check for structured data
    if (html.includes('schema.org')) {
      details.schemaMarkup = ['Organization', 'LocalBusiness'];
      score += 20;
    }

    // Check for author information (E-E-A-T)
    if (html.includes('author') || html.includes('byline')) {
      details.eeatSignals.push('author-present');
      score += 15;
    }

    // Check for publication date (signals freshness/expertise)
    if (html.includes('published') || html.includes('modified')) {
      details.eeatSignals.push('publication-dates');
      score += 15;
    }

    // Check for entity data (company name, etc)
    if (html.includes('organization') || html.includes('company')) {
      details.entityData.push('organization-data');
      score += 15;
    }

    // Check for content accessibility to AI
    // Good if HTML is clean, semantic, not overly JavaScript-heavy
    if (!html.includes('window.location=') && html.includes('<main')) {
      details.aiAccessibility = true;
      score += 20;
    }

    // Check content structure (paragraphs, headers, lists)
    const paragraphs = (html.match(/<p>/gi) || []).length;
    const headers = (html.match(/<h[2-6]>/gi) || []).length;
    if (paragraphs > 3 && headers > 2) {
      details.contentStructure = 'well-organized';
      score += 15;
    }

  } catch (error) {
    console.error('[AEO Check] Error:', error);
  }

  return { score: Math.min(score, 100), details };
}

/**
 * Check GEO (Geographic/Local SEO) health
 */
async function checkGEO(businessName: string, location?: string): Promise<{ score: number; details: GEODetails }> {
  const details: GEODetails = {
    googleBusinessProfile: false,
    localCitations: 0,
    localKeywords: [],
    mapsSignals: 'not-verified',
  };

  let score = 0;

  try {
    // NOTE: Full Google Business Profile API requires OAuth + verified account.
    // For now we report only what we can verify without external API keys:
    // - Generate local keyword suggestions based on business name + location
    // - Mark GBP and citation data as unverified (null)

    // Google Business Profile status is unknown without API access
    details.googleBusinessProfile = false; // Cannot verify without GBP API
    details.mapsSignals = 'unverified';

    if (location) {
      details.localKeywords = [
        `${businessName} ${location}`,
        `best ${businessName} in ${location}`,
        `${businessName} near me`,
      ];
      score += 20; // Credit for having a location to target
    }

    // Citation count and ratings cannot be verified without external APIs
    // Report null instead of fake numbers — UI should show "Not yet verified"
    details.localCitations = 0;
    details.averageRating = undefined;
    details.reviewCount = undefined;

  } catch (error) {
    console.error('[GEO Check] Error:', error);
  }

  return { score: Math.min(score, 100), details };
}

/**
 * Check social media presence
 */
async function checkSocial(businessName: string): Promise<{ score: number; details: SocialDetails }> {
  const details: SocialDetails = {
    platforms: [],
    overallPresence: 'low',
    engagementLevel: 'minimal',
  };

  let score = 0;

  // Generate a likely handle from the business name
  const handle = businessName.toLowerCase().replace(/[^a-z0-9]/g, '');

  const platformChecks = [
    { name: 'YouTube', baseScore: 20, url: `https://www.youtube.com/@${handle}` },
    { name: 'Instagram', baseScore: 15, url: `https://www.instagram.com/${handle}/` },
    { name: 'TikTok', baseScore: 15, url: `https://www.tiktok.com/@${handle}` },
    { name: 'X', baseScore: 15, url: `https://x.com/${handle}` },
    { name: 'Facebook', baseScore: 15, url: `https://www.facebook.com/${handle}` },
    { name: 'LinkedIn', baseScore: 20, url: `https://www.linkedin.com/company/${handle}` },
  ];

  try {
    // Check each platform URL with a lightweight HEAD/GET request
    // A 200-ish response suggests the handle exists (not conclusive for all platforms)
    const results = await Promise.allSettled(
      platformChecks.map(async (platform) => {
        const res = await fetch(platform.url, {
          method: 'HEAD',
          redirect: 'follow',
          signal: AbortSignal.timeout(8000),
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SynthexBot/1.0)' },
        });
        return { platform, found: res.ok || res.status === 301 || res.status === 302 };
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.found) {
        const { platform } = result.value;
        details.platforms.push({
          name: platform.name,
          handle: `@${handle}`,
          // Follower counts, verification, and last post date require authenticated API access
          // Report undefined instead of fake numbers
          followers: undefined,
          isVerified: undefined,
          lastPostDate: undefined,
        });
        score += platform.baseScore;
      }
    }

    if (details.platforms.length >= 4) {
      details.overallPresence = 'strong';
      details.engagementLevel = 'likely-active';
      score = Math.min(score + 15, 100);
    } else if (details.platforms.length >= 2) {
      details.overallPresence = 'moderate';
      details.engagementLevel = 'moderate';
    } else {
      details.overallPresence = 'low';
      details.engagementLevel = 'minimal';
    }

  } catch (error) {
    console.error('[Social Check] Error:', error);
  }

  return { score: Math.min(score, 100), details };
}

/**
 * Perform comprehensive business vetting
 */
export async function performBusinessVetting(input: VettingInput): Promise<HealthCheckResult> {
  const [seoResult, aeoResult, geoResult, socialResult] = await Promise.all([
    input.website ? checkSEO(input.website) : Promise.resolve({ score: 0, details: {} as SEODetails }),
    input.website ? checkAEO(input.website) : Promise.resolve({ score: 0, details: {} as AEODetails }),
    checkGEO(input.businessName, input.businessLocation),
    checkSocial(input.businessName),
  ]);

  // Calculate overall score (weighted average)
  const weights = {
    seo: 0.25,
    aeo: 0.25,
    geo: 0.25,
    social: 0.25,
  };

  const overallScore = Math.round(
    seoResult.score * weights.seo +
    aeoResult.score * weights.aeo +
    geoResult.score * weights.geo +
    socialResult.score * weights.social
  );

  // Generate recommendations based on scores
  const recommendations: string[] = [];

  if (seoResult.score < 50) {
    recommendations.push('Improve on-page SEO: add meta descriptions, optimize mobile experience');
  }
  if (aeoResult.score < 50) {
    recommendations.push('Add structured data (Schema.org) and E-E-A-T signals');
  }
  if (geoResult.score < 50) {
    recommendations.push('Claim and optimize your Google Business Profile');
  }
  if (socialResult.score < 50) {
    recommendations.push('Establish presence on at least 3-4 social platforms');
  }

  return {
    overallScore,
    seoScore: seoResult.score,
    aeoScore: aeoResult.score,
    geoScore: geoResult.score,
    socialScore: socialResult.score,
    seoDetails: seoResult.details,
    aeoDetails: aeoResult.details,
    geoDetails: geoResult.details,
    socialDetails: socialResult.details,
    recommendations,
  };
}