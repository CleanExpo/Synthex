/**
 * SEO Metadata Utilities
 *
 * Centralized utilities for generating consistent, optimized metadata
 * across all pages for SEO and social sharing.
 */

import { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social';
const SITE_NAME = 'Synthex';
const DEFAULT_DESCRIPTION = "The world's first fully autonomous AI marketing agency. Generate viral content, automate scheduling, and optimize engagement with AI.";

export interface PageSEOConfig {
  title: string;
  description?: string;
  path?: string;
  image?: string;
  type?: 'website' | 'article';
  keywords?: string[];
  noIndex?: boolean;
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
}

/**
 * Generate comprehensive metadata for a page
 */
export function generateMetadata(config: PageSEOConfig): Metadata {
  const {
    title,
    description = DEFAULT_DESCRIPTION,
    path = '',
    image = '/og-image.png',
    type = 'website',
    keywords = [],
    noIndex = false,
    publishedTime,
    modifiedTime,
    authors,
  } = config;

  const url = `${BASE_URL}${path}`;
  const fullTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;
  const imageUrl = image.startsWith('http') ? image : `${BASE_URL}${image}`;

  const defaultKeywords = [
    'AI marketing',
    'social media automation',
    'AI content generation',
    'social media scheduling',
    'marketing automation',
    'viral content',
    'engagement analytics',
    'multi-platform management',
  ];

  return {
    metadataBase: new URL(BASE_URL),
    title: fullTitle,
    description,
    keywords: [...defaultKeywords, ...keywords].join(', '),
    authors: authors ? authors.map((name) => ({ name })) : [{ name: 'Synthex Team' }],
    creator: 'Synthex',
    publisher: 'Synthex',

    // Open Graph
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: SITE_NAME,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: 'en_US',
      type,
      ...(publishedTime && { publishedTime }),
      ...(modifiedTime && { modifiedTime }),
    },

    // Twitter
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [imageUrl],
      creator: '@synthexai',
      site: '@synthexai',
    },

    // Robots
    robots: noIndex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          nocache: false,
          googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
          },
        },

    // Verification (add your verification codes)
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION,
      // bing: process.env.BING_SITE_VERIFICATION,
    },

    // Alternates
    alternates: {
      canonical: url,
      languages: {
        'en-US': url,
        'en-AU': `${url}?locale=en-AU`,
      },
    },

    // App-specific
    applicationName: SITE_NAME,
    generator: 'Next.js',
    referrer: 'origin-when-cross-origin',
    formatDetection: {
      email: false,
      telephone: false,
    },

    // Icons
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: 'any' },
        { url: '/icon.svg', type: 'image/svg+xml' },
      ],
      apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
    },

    // Manifest
    manifest: '/manifest.json',
  };
}

/**
 * Generate metadata for marketing pages
 */
export function generateMarketingMetadata(config: Omit<PageSEOConfig, 'type'>): Metadata {
  return generateMetadata({ ...config, type: 'website' });
}

/**
 * Generate metadata for blog/article pages
 */
export function generateArticleMetadata(
  config: Omit<PageSEOConfig, 'type'> & {
    publishedTime: string;
    modifiedTime?: string;
    authors?: string[];
  }
): Metadata {
  return generateMetadata({ ...config, type: 'article' });
}

/**
 * Generate metadata for product/pricing pages
 */
export function generateProductMetadata(config: Omit<PageSEOConfig, 'type'>): Metadata {
  return generateMetadata({
    ...config,
    type: 'website',
    keywords: [
      ...(config.keywords || []),
      'pricing',
      'subscription',
      'SaaS',
      'marketing tools',
      'bring your own API keys',
      'affordable AI marketing',
    ],
  });
}

/**
 * Predefined metadata for common pages
 */
export const PAGE_METADATA = {
  home: generateMetadata({
    title: 'Synthex - AI-Powered Marketing Agency',
    description: "The world's first fully autonomous AI marketing agency. Generate viral content, automate scheduling, and optimize engagement 24/7.",
    path: '/',
    keywords: ['AI marketing agency', 'autonomous marketing', 'social media AI'],
  }),

  features: generateMetadata({
    title: 'Features',
    description: 'Explore Synthex\'s powerful AI features: content generation, smart scheduling, multi-platform management, and real-time analytics.',
    path: '/features',
    keywords: ['AI features', 'content generation', 'smart scheduling', 'analytics'],
  }),

  pricing: generateProductMetadata({
    title: 'Pricing',
    description: 'Affordable AI marketing from $199/month. Use your own API keys to dramatically reduce costs. Enterprise plans with custom rates available.',
    path: '/pricing',
    keywords: ['pricing plans', 'BYOK', 'bring your own API keys', 'affordable AI', 'custom rates'],
  }),

  about: generateMetadata({
    title: 'About Us',
    description: 'Learn about Synthex\'s mission to democratize AI marketing. Meet our team and discover our story.',
    path: '/about',
    keywords: ['about synthex', 'company', 'mission', 'team'],
  }),

  blog: generateMetadata({
    title: 'Blog',
    description: 'Stay updated with the latest in AI marketing, social media trends, and Synthex product updates.',
    path: '/blog',
    keywords: ['marketing blog', 'AI insights', 'social media tips'],
  }),

  demo: generateMetadata({
    title: 'Demo',
    description: 'See Synthex in action. Watch how AI transforms your social media marketing workflow.',
    path: '/demo',
    keywords: ['demo', 'product tour', 'walkthrough'],
  }),

  login: generateMetadata({
    title: 'Login',
    description: 'Login to your Synthex account to manage your AI-powered marketing campaigns.',
    path: '/login',
    noIndex: true,
  }),

  signup: generateMetadata({
    title: 'Sign Up',
    description: 'Create your free Synthex account and start automating your social media marketing with AI.',
    path: '/signup',
    keywords: ['sign up', 'create account', 'free trial'],
  }),

  privacy: generateMetadata({
    title: 'Privacy Policy',
    description: 'Learn how Synthex protects your data and respects your privacy.',
    path: '/privacy',
    keywords: ['privacy policy', 'data protection', 'GDPR'],
  }),

  terms: generateMetadata({
    title: 'Terms of Service',
    description: 'Read Synthex\'s terms of service and usage policies.',
    path: '/terms',
    keywords: ['terms of service', 'legal', 'policies'],
  }),

  apiReference: generateMetadata({
    title: 'API Reference',
    description: 'Comprehensive API documentation for developers integrating with Synthex.',
    path: '/api-reference',
    keywords: ['API', 'developer docs', 'integration', 'REST API'],
  }),

  contact: generateMetadata({
    title: 'Contact Us',
    description: 'Get in touch with the Synthex team. We\'re here to help with sales, support, and partnerships.',
    path: '/contact',
    keywords: ['contact', 'support', 'sales', 'partnerships'],
  }),

  careers: generateMetadata({
    title: 'Careers',
    description: 'Join the Synthex team and help build the future of AI-powered marketing. View open positions.',
    path: '/careers',
    keywords: ['careers', 'jobs', 'hiring', 'work at synthex'],
  }),

  caseStudies: generateMetadata({
    title: 'Case Studies',
    description: 'See how businesses use Synthex to transform their social media marketing with AI automation.',
    path: '/case-studies',
    keywords: ['case studies', 'success stories', 'customer results', 'ROI'],
  }),

  changelog: generateMetadata({
    title: 'Changelog',
    description: 'Stay up to date with the latest Synthex product updates, new features, and improvements.',
    path: '/changelog',
    keywords: ['changelog', 'updates', 'releases', 'new features'],
  }),

  roadmap: generateMetadata({
    title: 'Product Roadmap',
    description: 'See what\'s coming next for Synthex. Our public roadmap shows upcoming features and improvements.',
    path: '/roadmap',
    keywords: ['roadmap', 'upcoming features', 'product plans'],
  }),

  security: generateMetadata({
    title: 'Security',
    description: 'Learn about Synthex\'s security practices, data protection measures, and compliance certifications.',
    path: '/security',
    keywords: ['security', 'data protection', 'compliance', 'SOC 2', 'encryption'],
  }),

  support: generateMetadata({
    title: 'Support',
    description: 'Get help with Synthex. Access documentation, FAQs, tutorials, and contact our support team.',
    path: '/support',
    keywords: ['support', 'help center', 'FAQ', 'documentation', 'tutorials'],
  }),

  docs: generateMetadata({
    title: 'Documentation',
    description: 'Comprehensive documentation for getting started with Synthex. Guides, tutorials, and API reference.',
    path: '/docs',
    keywords: ['documentation', 'guides', 'tutorials', 'getting started'],
  }),
};

/**
 * Generate viewport settings (separate from metadata in Next.js 14+)
 */
export function generateViewport() {
  return {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    themeColor: [
      { media: '(prefers-color-scheme: light)', color: '#0a1628' },
      { media: '(prefers-color-scheme: dark)', color: '#0a1628' },
    ],
  };
}
