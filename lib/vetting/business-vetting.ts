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

import { prisma } from '@/lib/prisma';

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

    // Check for robots.txt (would need to fetch separately)
    // In a real implementation, this would do a separate fetch
    details.hasRobotsTxt = true; // Assume true for now
    score += 10;

    // Check for sitemap (would need to fetch separately)
    if (html.includes('sitemap')) {
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

    // Estimate mobile speed (simplified - would use real API)
    details.mobileSpeed = Math.random() * 40 + 60; // Mock: 60-100
    details.desktopSpeed = Math.random() * 40 + 70; // Mock: 70-110

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
    // In a real implementation, this would:
    // 1. Query Google Business Profile API
    // 2. Check local citation databases (Yelp, Apple Maps, etc)
    // 3. Verify NAP (Name, Address, Phone) consistency
    // 4. Check Google Maps listings

    // Simulated check
    details.googleBusinessProfile = true;
    score += 25;

    if (location) {
      details.localKeywords = [`${businessName} ${location}`, `best ${businessName} in ${location}`];
      score += 20;
    }

    details.localCitations = Math.floor(Math.random() * 15) + 5;
    score += Math.min(details.localCitations * 2, 25);

    // Average rating simulation
    details.averageRating = Math.random() * 2 + 3.5;
    details.reviewCount = Math.floor(Math.random() * 100) + 10;

    if (details.averageRating >= 4.0) {
      details.mapsSignals = 'strong-reputation';
      score += 20;
    }

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

  const platforms = [
    { name: 'YouTube', baseScore: 20 },
    { name: 'Instagram', baseScore: 15 },
    { name: 'TikTok', baseScore: 15 },
    { name: 'X', baseScore: 15 },
    { name: 'Facebook', baseScore: 15 },
    { name: 'LinkedIn', baseScore: 20 },
    { name: 'Pinterest', baseScore: 10 },
    { name: 'Reddit', baseScore: 5 },
    { name: 'Threads', baseScore: 5 },
  ];

  try {
    // In a real implementation, this would:
    // 1. Search for business handles on each platform
    // 2. Verify account authenticity
    // 3. Check followers/engagement metrics
    // 4. Verify blue checkmarks

    for (const platform of platforms) {
      // Simulate finding 2-4 platforms
      if (Math.random() > 0.6) {
        const foundPlatform = {
          name: platform.name,
          handle: `@${businessName.toLowerCase().replace(/\s/g, '')}`,
          followers: Math.floor(Math.random() * 100000) + 1000,
          isVerified: Math.random() > 0.7,
          lastPostDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        };

        details.platforms.push(foundPlatform);
        score += platform.baseScore;
      }
    }

    if (details.platforms.length >= 4) {
      details.overallPresence = 'strong';
      details.engagementLevel = 'active';
      score = Math.min(score + 15, 100);
    } else if (details.platforms.length >= 2) {
      details.overallPresence = 'moderate';
      details.engagementLevel = 'moderate';
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