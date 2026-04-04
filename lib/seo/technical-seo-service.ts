/**
 * Technical SEO Service
 *
 * Provides technical SEO analysis including:
 * - Mobile/desktop parity checking via PageSpeed API
 * - Robots.txt validation and AI bot access detection
 * - Core Web Vitals history from stored SEOAudit records
 *
 * ENVIRONMENT VARIABLES (OPTIONAL):
 * - GOOGLE_PAGESPEED_API_KEY: For higher rate limits (PUBLIC, optional)
 */

import { prisma } from '@/lib/prisma';

// ============================================================================
// TYPES
// ============================================================================

export interface MobileParityResult {
  contentMatch: number; // percentage 0-100
  structureMatch: number; // percentage 0-100
  issues: MobileParityIssue[];
  recommendations: string[];
  mobileScore: number;
  desktopScore: number;
  mobileMetrics: {
    lcp: number | null;
    cls: number | null;
    inp: number | null;
    fid: number | null;
  };
  desktopMetrics: {
    lcp: number | null;
    cls: number | null;
    inp: number | null;
    fid: number | null;
  };
}

export interface MobileParityIssue {
  type: 'content' | 'structure' | 'performance' | 'accessibility';
  severity: 'critical' | 'major' | 'minor';
  title: string;
  description: string;
  mobileValue?: string | number;
  desktopValue?: string | number;
}

export interface RobotsTxtResult {
  valid: boolean;
  rawContent: string;
  directives: RobotsTxtDirective[];
  aiBotsBlocked: string[];
  aiBotsAllowed: string[];
  issues: RobotsTxtIssue[];
  sitemapUrls: string[];
  crawlDelay: number | null;
}

export interface RobotsTxtDirective {
  userAgent: string;
  rules: Array<{
    type: 'allow' | 'disallow';
    path: string;
  }>;
  crawlDelay?: number;
}

export interface RobotsTxtIssue {
  severity: 'critical' | 'major' | 'minor' | 'info';
  title: string;
  description: string;
  recommendation: string;
}

export interface CwvHistoryEntry {
  date: string;
  url: string;
  lcp: number | null;
  cls: number | null;
  inp: number | null;
  fid: number | null;
  overallScore: number;
}

// AI crawlers to check
const AI_BOTS = [
  'GPTBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-Web',
  'PerplexityBot',
  'Bingbot',
  'Googlebot',
  'anthropic-ai',
  'cohere-ai',
  'Google-Extended',
  'CCBot',
];

// ============================================================================
// PAGESPEED API HELPERS
// ============================================================================

interface PageSpeedMetrics {
  lcp: number | null;
  cls: number | null;
  inp: number | null;
  fid: number | null;
  performanceScore: number;
  seoScore: number;
  accessibilityScore: number;
  bestPracticesScore: number;
}

async function fetchPageSpeedData(url: string, strategy: 'mobile' | 'desktop'): Promise<PageSpeedMetrics | null> {
  try {
    const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;
    const psiUrl = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
    psiUrl.searchParams.set('url', url);
    psiUrl.searchParams.set('strategy', strategy);
    psiUrl.searchParams.set('category', 'PERFORMANCE');
    psiUrl.searchParams.set('category', 'ACCESSIBILITY');
    psiUrl.searchParams.set('category', 'SEO');
    psiUrl.searchParams.set('category', 'BEST_PRACTICES');
    if (apiKey) psiUrl.searchParams.set('key', apiKey);

    const response = await fetch(psiUrl.toString(), { signal: AbortSignal.timeout(30000) });

    if (!response.ok) {
      console.warn(`PageSpeed API returned ${response.status} for ${strategy}`);
      return null;
    }

    const psi = await response.json();

    // Extract Lighthouse scores
    const categories = psi.lighthouseResult?.categories;
    const performanceScore = Math.round((categories?.performance?.score || 0) * 100);
    const seoScore = Math.round((categories?.seo?.score || 0) * 100);
    const accessibilityScore = Math.round((categories?.accessibility?.score || 0) * 100);
    const bestPracticesScore = Math.round((categories?.['best-practices']?.score || 0) * 100);

    // Extract Core Web Vitals from field data or lab data
    const fieldMetrics = psi.loadingExperience?.metrics;
    const labAudits = psi.lighthouseResult?.audits;

    const lcpValue = fieldMetrics?.LARGEST_CONTENTFUL_PAINT_MS?.percentile
      ? fieldMetrics.LARGEST_CONTENTFUL_PAINT_MS.percentile / 1000
      : labAudits?.['largest-contentful-paint']?.numericValue
        ? labAudits['largest-contentful-paint'].numericValue / 1000
        : null;

    const clsValue = fieldMetrics?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile
      ? fieldMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100
      : labAudits?.['cumulative-layout-shift']?.numericValue ?? null;

    const inpValue = fieldMetrics?.INTERACTION_TO_NEXT_PAINT?.percentile ?? null;
    const fidValue = fieldMetrics?.FIRST_INPUT_DELAY_MS?.percentile ?? null;

    return {
      lcp: lcpValue,
      cls: clsValue,
      inp: inpValue,
      fid: fidValue,
      performanceScore,
      seoScore,
      accessibilityScore,
      bestPracticesScore,
    };
  } catch (error) {
    console.warn(`PageSpeed API failed for ${strategy}:`, error);
    return null;
  }
}

// ============================================================================
// MOBILE PARITY
// ============================================================================

/**
 * Check mobile/desktop parity by comparing PageSpeed results for both strategies.
 * Identifies differences in performance, content structure, and accessibility.
 */
export async function checkMobileParity(url: string): Promise<MobileParityResult> {
  // Fetch both mobile and desktop data in parallel
  const [mobileData, desktopData] = await Promise.all([
    fetchPageSpeedData(url, 'mobile'),
    fetchPageSpeedData(url, 'desktop'),
  ]);

  const issues: MobileParityIssue[] = [];
  const recommendations: string[] = [];

  // Default values if API fails
  const mobileScore = mobileData?.performanceScore ?? 0;
  const desktopScore = desktopData?.performanceScore ?? 0;

  // Calculate content and structure match based on available data
  let contentMatch = 100;
  let structureMatch = 100;

  if (mobileData && desktopData) {
    // Check performance parity
    const perfDiff = Math.abs(mobileScore - desktopScore);
    if (perfDiff > 20) {
      issues.push({
        type: 'performance',
        severity: perfDiff > 30 ? 'critical' : 'major',
        title: 'Significant performance difference',
        description: `Mobile performance (${mobileScore}) differs from desktop (${desktopScore}) by ${perfDiff} points`,
        mobileValue: mobileScore,
        desktopValue: desktopScore,
      });
      structureMatch -= Math.min(perfDiff, 30);
      recommendations.push('Optimize mobile-specific resources (images, scripts) to reduce performance gap');
    }

    // Check SEO score parity
    const seoDiff = Math.abs((mobileData.seoScore) - (desktopData.seoScore));
    if (seoDiff > 10) {
      issues.push({
        type: 'content',
        severity: seoDiff > 20 ? 'major' : 'minor',
        title: 'SEO score mismatch',
        description: `Mobile SEO (${mobileData.seoScore}) differs from desktop (${desktopData.seoScore})`,
        mobileValue: mobileData.seoScore,
        desktopValue: desktopData.seoScore,
      });
      contentMatch -= Math.min(seoDiff * 2, 20);
      recommendations.push('Ensure mobile version has same meta tags, headings, and content as desktop');
    }

    // Check accessibility parity
    const a11yDiff = Math.abs((mobileData.accessibilityScore) - (desktopData.accessibilityScore));
    if (a11yDiff > 10) {
      issues.push({
        type: 'accessibility',
        severity: a11yDiff > 20 ? 'major' : 'minor',
        title: 'Accessibility score mismatch',
        description: `Mobile accessibility (${mobileData.accessibilityScore}) differs from desktop (${desktopData.accessibilityScore})`,
        mobileValue: mobileData.accessibilityScore,
        desktopValue: desktopData.accessibilityScore,
      });
      contentMatch -= Math.min(a11yDiff, 15);
      recommendations.push('Review mobile accessibility features like tap targets, contrast, and focus states');
    }

    // Check LCP parity
    if (mobileData.lcp && desktopData.lcp) {
      const lcpDiff = Math.abs(mobileData.lcp - desktopData.lcp);
      if (lcpDiff > 1.5) {
        issues.push({
          type: 'performance',
          severity: lcpDiff > 2.5 ? 'critical' : 'major',
          title: 'LCP timing mismatch',
          description: `Mobile LCP (${mobileData.lcp.toFixed(2)}s) differs significantly from desktop (${desktopData.lcp.toFixed(2)}s)`,
          mobileValue: mobileData.lcp,
          desktopValue: desktopData.lcp,
        });
        structureMatch -= Math.min(lcpDiff * 5, 20);
        recommendations.push('Optimize largest contentful paint element for mobile devices');
      }
    }

    // Check CLS parity
    if (mobileData.cls !== null && desktopData.cls !== null) {
      const clsDiff = Math.abs(mobileData.cls - desktopData.cls);
      if (clsDiff > 0.05) {
        issues.push({
          type: 'structure',
          severity: clsDiff > 0.1 ? 'major' : 'minor',
          title: 'Layout shift difference',
          description: `Mobile CLS (${mobileData.cls.toFixed(3)}) differs from desktop (${desktopData.cls.toFixed(3)})`,
          mobileValue: mobileData.cls,
          desktopValue: desktopData.cls,
        });
        structureMatch -= Math.min(clsDiff * 100, 15);
        recommendations.push('Add explicit dimensions to images and embeds on mobile');
      }
    }
  } else {
    // One or both API calls failed
    if (!mobileData) {
      issues.push({
        type: 'performance',
        severity: 'critical',
        title: 'Mobile data unavailable',
        description: 'Could not fetch mobile PageSpeed data. The page may be blocking bots or timing out.',
      });
      contentMatch = 0;
      structureMatch = 0;
      recommendations.push('Ensure the page is accessible to Googlebot and responds within 30 seconds');
    }
    if (!desktopData) {
      issues.push({
        type: 'performance',
        severity: 'major',
        title: 'Desktop data unavailable',
        description: 'Could not fetch desktop PageSpeed data for comparison.',
      });
    }
  }

  // Add general recommendations if no issues found
  if (issues.length === 0) {
    recommendations.push('Mobile and desktop versions are well aligned. Continue monitoring parity.');
  }

  return {
    contentMatch: Math.max(0, Math.round(contentMatch)),
    structureMatch: Math.max(0, Math.round(structureMatch)),
    issues,
    recommendations,
    mobileScore,
    desktopScore,
    mobileMetrics: {
      lcp: mobileData?.lcp ?? null,
      cls: mobileData?.cls ?? null,
      inp: mobileData?.inp ?? null,
      fid: mobileData?.fid ?? null,
    },
    desktopMetrics: {
      lcp: desktopData?.lcp ?? null,
      cls: desktopData?.cls ?? null,
      inp: desktopData?.inp ?? null,
      fid: desktopData?.fid ?? null,
    },
  };
}

// ============================================================================
// ROBOTS.TXT VALIDATION
// ============================================================================

/**
 * Fetch and validate robots.txt, checking directives and AI bot access.
 */
export async function validateRobotsTxt(url: string): Promise<RobotsTxtResult> {
  const parsedUrl = new URL(url);
  const robotsUrl = `${parsedUrl.protocol}//${parsedUrl.host}/robots.txt`;

  let rawContent = '';
  let valid = false;
  const directives: RobotsTxtDirective[] = [];
  const issues: RobotsTxtIssue[] = [];
  const sitemapUrls: string[] = [];
  let crawlDelay: number | null = null;

  try {
    const response = await fetch(robotsUrl, {
      headers: { 'User-Agent': 'SynthexBot/1.0 (+https://synthex.social)' },
      signal: AbortSignal.timeout(15000),
    });

    if (response.ok) {
      rawContent = await response.text();
      valid = true;
    } else if (response.status === 404) {
      issues.push({
        severity: 'minor',
        title: 'No robots.txt found',
        description: 'The site does not have a robots.txt file.',
        recommendation: 'Create a robots.txt file to control crawler access and specify sitemap location.',
      });
      return {
        valid: false,
        rawContent: '',
        directives: [],
        aiBotsBlocked: [],
        aiBotsAllowed: AI_BOTS,
        issues,
        sitemapUrls: [],
        crawlDelay: null,
      };
    } else {
      issues.push({
        severity: 'major',
        title: 'robots.txt not accessible',
        description: `Server returned status ${response.status} when fetching robots.txt`,
        recommendation: 'Ensure robots.txt is publicly accessible and returns a 200 status.',
      });
      return {
        valid: false,
        rawContent: '',
        directives: [],
        aiBotsBlocked: [],
        aiBotsAllowed: [],
        issues,
        sitemapUrls: [],
        crawlDelay: null,
      };
    }
  } catch (error) {
    issues.push({
      severity: 'critical',
      title: 'Failed to fetch robots.txt',
      description: error instanceof Error ? error.message : 'Network error',
      recommendation: 'Check server connectivity and ensure robots.txt is accessible.',
    });
    return {
      valid: false,
      rawContent: '',
      directives: [],
      aiBotsBlocked: [],
      aiBotsAllowed: [],
      issues,
      sitemapUrls: [],
      crawlDelay: null,
    };
  }

  // Parse robots.txt content
  const lines = rawContent.split('\n').map(line => line.trim());
  let currentUserAgent: string | null = null;
  let currentRules: Array<{ type: 'allow' | 'disallow'; path: string }> = [];
  let currentCrawlDelay: number | undefined;

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.startsWith('#') || line === '') continue;

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const directive = line.substring(0, colonIndex).trim().toLowerCase();
    const value = line.substring(colonIndex + 1).trim();

    switch (directive) {
      case 'user-agent':
        // Save previous user-agent block if exists
        if (currentUserAgent !== null) {
          directives.push({
            userAgent: currentUserAgent,
            rules: [...currentRules],
            ...(currentCrawlDelay !== undefined && { crawlDelay: currentCrawlDelay }),
          });
        }
        currentUserAgent = value;
        currentRules = [];
        currentCrawlDelay = undefined;
        break;

      case 'disallow':
        if (currentUserAgent !== null && value) {
          currentRules.push({ type: 'disallow', path: value });
        }
        break;

      case 'allow':
        if (currentUserAgent !== null && value) {
          currentRules.push({ type: 'allow', path: value });
        }
        break;

      case 'crawl-delay':
        const delay = parseFloat(value);
        if (!isNaN(delay)) {
          currentCrawlDelay = delay;
          if (crawlDelay === null || delay > crawlDelay) {
            crawlDelay = delay;
          }
        }
        break;

      case 'sitemap':
        if (value) {
          sitemapUrls.push(value);
        }
        break;
    }
  }

  // Save last user-agent block
  if (currentUserAgent !== null) {
    directives.push({
      userAgent: currentUserAgent,
      rules: [...currentRules],
      ...(currentCrawlDelay !== undefined && { crawlDelay: currentCrawlDelay }),
    });
  }

  // Check AI bot access
  const aiBotsBlocked: string[] = [];
  const aiBotsAllowed: string[] = [];

  for (const bot of AI_BOTS) {
    const botLower = bot.toLowerCase();

    // Find matching user-agent directive (exact match or wildcard)
    const matchingDirective = directives.find(d =>
      d.userAgent.toLowerCase() === botLower ||
      d.userAgent === '*'
    );

    // Check if bot is blocked (disallow: /)
    const isBlocked = matchingDirective?.rules.some(
      rule => rule.type === 'disallow' && (rule.path === '/' || rule.path === '/*')
    );

    // Check if explicitly allowed
    const isExplicitlyAllowed = directives.some(d =>
      d.userAgent.toLowerCase() === botLower &&
      d.rules.some(rule => rule.type === 'allow' && (rule.path === '/' || rule.path === '/*'))
    );

    if (isBlocked && !isExplicitlyAllowed) {
      aiBotsBlocked.push(bot);
    } else {
      aiBotsAllowed.push(bot);
    }
  }

  // Generate issues based on analysis
  if (aiBotsBlocked.length > 0) {
    const blockedAIBots = aiBotsBlocked.filter(b =>
      ['GPTBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-Web', 'PerplexityBot', 'anthropic-ai'].includes(b)
    );

    if (blockedAIBots.length > 0) {
      issues.push({
        severity: 'info',
        title: 'AI crawlers blocked',
        description: `The following AI bots are blocked: ${blockedAIBots.join(', ')}`,
        recommendation: 'Consider if blocking AI crawlers aligns with your AI visibility strategy.',
      });
    }
  }

  if (sitemapUrls.length === 0) {
    issues.push({
      severity: 'minor',
      title: 'No sitemap specified',
      description: 'robots.txt does not include a Sitemap directive.',
      recommendation: 'Add a Sitemap directive to help crawlers discover your content.',
    });
  }

  if (crawlDelay !== null && crawlDelay > 10) {
    issues.push({
      severity: 'major',
      title: 'High crawl delay',
      description: `Crawl-delay is set to ${crawlDelay} seconds, which may slow indexing.`,
      recommendation: 'Consider reducing crawl-delay to improve crawl efficiency.',
    });
  }

  // Check for overly permissive rules
  const wildcardDirective = directives.find(d => d.userAgent === '*');
  if (wildcardDirective) {
    const hasDisallowAll = wildcardDirective.rules.some(r => r.type === 'disallow' && r.path === '/');
    const hasEmptyDisallow = wildcardDirective.rules.some(r => r.type === 'disallow' && r.path === '');

    if (hasDisallowAll && !wildcardDirective.rules.some(r => r.type === 'allow')) {
      issues.push({
        severity: 'critical',
        title: 'All crawling blocked',
        description: 'Disallow: / for all user-agents blocks all crawlers.',
        recommendation: 'Remove or modify this rule if you want search engines to index your site.',
      });
    }

    if (hasEmptyDisallow) {
      issues.push({
        severity: 'info',
        title: 'Empty disallow rule',
        description: 'An empty Disallow directive allows full crawling.',
        recommendation: 'This is intentional if you want full access; otherwise, specify paths to block.',
      });
    }
  }

  return {
    valid,
    rawContent,
    directives,
    aiBotsBlocked,
    aiBotsAllowed,
    issues,
    sitemapUrls,
    crawlDelay,
  };
}

// ============================================================================
// CWV HISTORY
// ============================================================================

/**
 * Get Core Web Vitals history from stored SEOAudit records.
 * Queries the last 30 days of audits with CWV data.
 */
export async function getCwvHistory(userId: string): Promise<CwvHistoryEntry[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const audits = await prisma.sEOAudit.findMany({
    where: {
      userId,
      createdAt: {
        gte: thirtyDaysAgo,
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
    select: {
      url: true,
      createdAt: true,
      overallScore: true,
      rawData: true,
    },
    take: 100, // Limit to prevent excessive data
  });

  const history: CwvHistoryEntry[] = [];

  for (const audit of audits) {
    // Extract CWV data from rawData
    const rawData = audit.rawData as Record<string, unknown> | null;
    const categories = rawData?.categories as Record<string, unknown> | undefined;
    const cwv = categories?.coreWebVitals as Record<string, { value: number | null }> | undefined;

    if (cwv || rawData) {
      history.push({
        date: audit.createdAt.toISOString(),
        url: audit.url,
        lcp: cwv?.lcp?.value ?? null,
        cls: cwv?.cls?.value ?? null,
        inp: cwv?.inp?.value ?? null,
        fid: cwv?.fid?.value ?? null,
        overallScore: audit.overallScore,
      });
    }
  }

  return history;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const technicalSeoService = {
  checkMobileParity,
  validateRobotsTxt,
  getCwvHistory,
};

export default technicalSeoService;
