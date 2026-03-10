/**
 * Structured Data Components for SEO
 *
 * Implements schema.org JSON-LD structured data for:
 * - Organization
 * - WebSite
 * - SoftwareApplication
 * - FAQPage
 * - VideoObject
 * - BreadcrumbList
 */

import Script from 'next/script';

// Organization Schema
export interface OrganizationData {
  name: string;
  url: string;
  logo: string;
  description: string;
  sameAs?: string[];
  contactPoint?: {
    type: string;
    telephone?: string;
    email?: string;
    contactType: string;
  };
}

export function OrganizationSchema({ data }: { data: OrganizationData }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: data.name,
    url: data.url,
    logo: data.logo,
    description: data.description,
    sameAs: data.sameAs || [],
    ...(data.contactPoint && {
      contactPoint: {
        '@type': 'ContactPoint',
        ...data.contactPoint,
      },
    }),
  };

  return (
    <Script
      id="organization-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      strategy="afterInteractive"
    />
  );
}

// WebSite Schema with SearchAction
export interface WebSiteData {
  name: string;
  url: string;
  description: string;
  potentialAction?: {
    target: string;
    queryInput: string;
  };
}

export function WebSiteSchema({ data }: { data: WebSiteData }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: data.name,
    url: data.url,
    description: data.description,
    ...(data.potentialAction && {
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: data.potentialAction.target,
        },
        'query-input': data.potentialAction.queryInput,
      },
    }),
  };

  return (
    <Script
      id="website-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      strategy="afterInteractive"
    />
  );
}

// SoftwareApplication Schema
export interface SoftwareApplicationData {
  name: string;
  description: string;
  url: string;
  applicationCategory: string;
  operatingSystem: string;
  offers?: {
    price: string;
    priceCurrency: string;
  };
  aggregateRating?: {
    ratingValue: number;
    ratingCount: number;
    bestRating?: number;
    worstRating?: number;
  };
  featureList?: string[];
}

export function SoftwareApplicationSchema({ data }: { data: SoftwareApplicationData }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: data.name,
    description: data.description,
    url: data.url,
    applicationCategory: data.applicationCategory,
    operatingSystem: data.operatingSystem,
    ...(data.offers && {
      offers: {
        '@type': 'Offer',
        price: data.offers.price,
        priceCurrency: data.offers.priceCurrency,
      },
    }),
    ...(data.aggregateRating && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: data.aggregateRating.ratingValue,
        ratingCount: data.aggregateRating.ratingCount,
        bestRating: data.aggregateRating.bestRating || 5,
        worstRating: data.aggregateRating.worstRating || 1,
      },
    }),
    ...(data.featureList && { featureList: data.featureList }),
  };

  return (
    <Script
      id="software-application-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      strategy="afterInteractive"
    />
  );
}

// VideoObject Schema
export interface VideoObjectData {
  name: string;
  description: string;
  thumbnailUrl: string;
  uploadDate: string;
  duration: string; // ISO 8601 duration format (e.g., PT2M30S)
  contentUrl?: string;
  embedUrl?: string;
  publisher?: {
    name: string;
    logo: string;
  };
}

export function VideoObjectSchema({ data }: { data: VideoObjectData }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: data.name,
    description: data.description,
    thumbnailUrl: data.thumbnailUrl,
    uploadDate: data.uploadDate,
    duration: data.duration,
    ...(data.contentUrl && { contentUrl: data.contentUrl }),
    ...(data.embedUrl && { embedUrl: data.embedUrl }),
    ...(data.publisher && {
      publisher: {
        '@type': 'Organization',
        name: data.publisher.name,
        logo: {
          '@type': 'ImageObject',
          url: data.publisher.logo,
        },
      },
    }),
  };

  return (
    <Script
      id="video-object-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      strategy="afterInteractive"
    />
  );
}

// FAQPage Schema
export interface FAQItem {
  question: string;
  answer: string;
}

export function FAQPageSchema({ items }: { items: FAQItem[] }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <Script
      id="faq-page-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      strategy="afterInteractive"
    />
  );
}

// BreadcrumbList Schema
export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function BreadcrumbSchema({ items }: { items: BreadcrumbItem[] }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <Script
      id="breadcrumb-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      strategy="afterInteractive"
    />
  );
}

// Product Schema (for pricing page)
export interface ProductData {
  name: string;
  description: string;
  image: string;
  brand: string;
  offers: Array<{
    name: string;
    price: string;
    priceCurrency: string;
    description?: string;
  }>;
}

export function ProductSchema({ data }: { data: ProductData }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: data.name,
    description: data.description,
    image: data.image,
    brand: {
      '@type': 'Brand',
      name: data.brand,
    },
    offers: data.offers.map((offer) => ({
      '@type': 'Offer',
      name: offer.name,
      price: offer.price,
      priceCurrency: offer.priceCurrency,
      description: offer.description,
      availability: 'https://schema.org/InStock',
      priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    })),
  };

  return (
    <Script
      id="product-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      strategy="afterInteractive"
    />
  );
}

// SocialMediaPosting Schema
export interface SocialMediaPostingData {
  headline: string;
  articleBody: string;
  datePublished: string;
  dateModified?: string;
  author: {
    name: string;
    url?: string;
  };
  sharedContent?: {
    url: string;
    headline?: string;
  };
  platform?: string;
}

export function SocialMediaPostingSchema({ data }: { data: SocialMediaPostingData }) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social';

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SocialMediaPosting',
    headline: data.headline,
    articleBody: data.articleBody,
    datePublished: data.datePublished,
    ...(data.dateModified && { dateModified: data.dateModified }),
    author: {
      '@type': 'Person',
      name: data.author.name,
      ...(data.author.url && { url: data.author.url }),
    },
    publisher: {
      '@type': 'Organization',
      name: 'Synthex',
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/logo.png`,
      },
    },
    ...(data.sharedContent && {
      sharedContent: {
        '@type': 'WebPage',
        url: data.sharedContent.url,
        ...(data.sharedContent.headline && { headline: data.sharedContent.headline }),
      },
    }),
    ...(data.platform && {
      isPartOf: {
        '@type': 'WebSite',
        name: data.platform,
      },
    }),
  };

  return (
    <Script
      id="social-media-posting-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      strategy="afterInteractive"
    />
  );
}

// Combined Schema for main pages
export function SynthexMainSchema() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social';

  return (
    <>
      <OrganizationSchema
        data={{
          name: 'Synthex',
          url: baseUrl,
          logo: `${baseUrl}/logo.png`,
          description: "The world's first fully autonomous AI marketing agency. AI-powered social media automation, content generation, and analytics.",
          sameAs: [
            'https://twitter.com/synthexai',
            'https://linkedin.com/company/synthex',
            'https://github.com/synthex',
          ],
          contactPoint: {
            type: 'ContactPoint',
            email: 'support@synthex.social',
            contactType: 'customer service',
          },
        }}
      />
      <WebSiteSchema
        data={{
          name: 'Synthex - AI Marketing Agency',
          url: baseUrl,
          description: 'AI-powered social media automation platform for content creation, scheduling, and analytics.',
          potentialAction: {
            target: `${baseUrl}/search?q={search_term_string}`,
            queryInput: 'required name=search_term_string',
          },
        }}
      />
      <SoftwareApplicationSchema
        data={{
          name: 'Synthex',
          description: 'AI-powered social media automation platform. Generate viral content, schedule posts, and analyze engagement across all major social platforms.',
          url: baseUrl,
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          offers: {
            price: '0',
            priceCurrency: 'USD',
          },
          aggregateRating: {
            ratingValue: 4.9,
            ratingCount: 2847,
            bestRating: 5,
            worstRating: 1,
          },
          featureList: [
            'AI Content Generation',
            'Smart Post Scheduling',
            'Multi-Platform Management',
            'Real-Time Analytics',
            'Engagement Optimization',
            'Brand Voice Learning',
          ],
        }}
      />
    </>
  );
}
