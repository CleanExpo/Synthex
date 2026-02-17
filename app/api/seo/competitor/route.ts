/**
 * Competitor Pages API
 *
 * Generates SEO-optimized comparison and alternatives page outlines.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';

const RequestSchema = z.object({
  brandName: z.string().min(1).max(100),
  competitorName: z.string().min(1).max(100),
});

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function generateCompetitorPages(brandName: string, competitorName: string) {
  const brandSlug = slugify(brandName);
  const competitorSlug = slugify(competitorName);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social';

  // X vs Y Comparison Page
  const comparisonPage = {
    type: 'comparison' as const,
    title: `${brandName} vs ${competitorName}: Detailed Comparison (${new Date().getFullYear()})`,
    metaDescription: `Compare ${brandName} and ${competitorName} side by side. See features, pricing, pros & cons, and which is right for your business.`,
    slug: `compare/${brandSlug}-vs-${competitorSlug}`,
    outline: [
      { heading: `${brandName} vs ${competitorName}: Quick Overview`, type: 'h2' as const, notes: 'Summary table with key differences at a glance' },
      { heading: 'Feature Comparison', type: 'h2' as const, notes: 'Detailed feature-by-feature matrix' },
      { heading: 'AI Content Generation', type: 'h3' as const, notes: 'Compare AI capabilities of both platforms' },
      { heading: 'Social Media Management', type: 'h3' as const, notes: 'Compare scheduling, publishing, and platform support' },
      { heading: 'Analytics & Reporting', type: 'h3' as const, notes: 'Compare analytics depth and reporting tools' },
      { heading: 'Pricing Comparison', type: 'h2' as const, notes: 'Side-by-side pricing tables with value analysis' },
      { heading: 'Pros & Cons', type: 'h2' as const, notes: 'Balanced pros/cons for each platform' },
      { heading: `${brandName} Pros`, type: 'h3' as const, notes: 'Key advantages of your platform' },
      { heading: `${competitorName} Pros`, type: 'h3' as const, notes: 'Fair acknowledgment of competitor strengths' },
      { heading: 'Who Should Choose Which?', type: 'h2' as const, notes: 'Use-case based recommendations' },
      { heading: 'Verdict', type: 'h2' as const, notes: 'Final recommendation with clear CTA' },
    ],
    schema: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: `${brandName} vs ${competitorName} Comparison`,
      description: `Detailed comparison of ${brandName} and ${competitorName}`,
      url: `${baseUrl}/compare/${brandSlug}-vs-${competitorSlug}`,
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            item: {
              '@type': 'SoftwareApplication',
              name: brandName,
              applicationCategory: 'BusinessApplication',
            },
          },
          {
            '@type': 'ListItem',
            position: 2,
            item: {
              '@type': 'SoftwareApplication',
              name: competitorName,
              applicationCategory: 'BusinessApplication',
            },
          },
        ],
      },
    },
    keywords: [
      `${brandName} vs ${competitorName}`,
      `${competitorName} vs ${brandName}`,
      `${brandName} alternative`,
      `${competitorName} alternative`,
      `${brandName} comparison`,
      `${competitorName} comparison`,
      `best ${competitorName} alternative`,
    ],
  };

  // Alternatives Page
  const alternativesPage = {
    type: 'alternatives' as const,
    title: `Best ${competitorName} Alternatives (${new Date().getFullYear()}) — Why ${brandName} Leads`,
    metaDescription: `Looking for ${competitorName} alternatives? Discover why ${brandName} is the top choice with AI-powered features, better pricing, and more.`,
    slug: `alternatives/${competitorSlug}-alternatives`,
    outline: [
      { heading: `Why People Switch from ${competitorName}`, type: 'h2' as const, notes: 'Common pain points and limitations' },
      { heading: `Top ${competitorName} Alternatives`, type: 'h2' as const, notes: 'List of alternatives with your brand featured prominently' },
      { heading: `1. ${brandName} — Best Overall Alternative`, type: 'h3' as const, notes: 'Detailed feature overview and unique selling points' },
      { heading: 'Key Features', type: 'h3' as const, notes: 'Highlight differentiating features' },
      { heading: 'Pricing', type: 'h3' as const, notes: 'Transparent pricing comparison' },
      { heading: '2-5. Other Alternatives', type: 'h3' as const, notes: 'Brief mentions of other alternatives for fairness' },
      { heading: 'Comparison Table', type: 'h2' as const, notes: 'Feature matrix of all alternatives vs competitor' },
      { heading: `How to Migrate from ${competitorName}`, type: 'h2' as const, notes: 'Step-by-step migration guide' },
      { heading: 'Frequently Asked Questions', type: 'h2' as const, notes: 'FAQ schema markup opportunity' },
    ],
    schema: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: `Best ${competitorName} Alternatives`,
      description: `Top alternatives to ${competitorName} for social media marketing`,
      url: `${baseUrl}/alternatives/${competitorSlug}-alternatives`,
      mainEntity: {
        '@type': 'ItemList',
        name: `${competitorName} Alternatives`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            item: {
              '@type': 'SoftwareApplication',
              name: brandName,
              applicationCategory: 'BusinessApplication',
              description: `AI-powered alternative to ${competitorName}`,
            },
          },
        ],
      },
    },
    keywords: [
      `${competitorName} alternatives`,
      `best ${competitorName} alternative`,
      `${competitorName} replacement`,
      `switch from ${competitorName}`,
      `${competitorName} competitor`,
      `${brandName} vs ${competitorName}`,
      `tools like ${competitorName}`,
    ],
  };

  return [comparisonPage, alternativesPage];
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

    const pages = generateCompetitorPages(validation.data.brandName, validation.data.competitorName);
    return APISecurityChecker.createSecureResponse({ success: true, pages });
  } catch (error) {
    console.error('Competitor pages error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to generate competitor pages' },
      500
    );
  }
}
