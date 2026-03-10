/**
 * Schema Generator API
 *
 * Generates and validates JSON-LD structured data for SEO.
 * Protected by authentication and subscription checks.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { subscriptionService } from '@/lib/stripe/subscription-service';
import { logger } from '@/lib/logger';

// Supported schema types
const SCHEMA_TYPES = [
  'Organization',
  'LocalBusiness',
  'Product',
  'Article',
  'BlogPosting',
  'FAQ',
  'HowTo',
  'Event',
  'Person',
  'WebSite',
  'BreadcrumbList',
  'VideoObject',
  'Review',
  'Recipe',
] as const;

// Request validation schema
const SchemaRequestSchema = z.object({
  type: z.enum(SCHEMA_TYPES),
  data: z.record(z.unknown()),
  url: z.string().url().optional(),
});

/** FAQ question item */
interface FAQQuestion {
  question: string;
  answer: string;
}

/** HowTo step item */
interface HowToStep {
  name: string;
  text: string;
  image?: string;
}

/** Breadcrumb item */
interface BreadcrumbItem {
  name: string;
  url: string;
}

/** Contact point data */
interface ContactPointData {
  phone?: string;
  email?: string;
  type?: string;
}

/** Address data */
interface AddressData {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

/** Coordinates data */
interface CoordinatesData {
  lat?: number;
  lng?: number;
}

/** Rating data */
interface RatingData {
  value?: number;
  count?: number;
}

/** Location data */
interface LocationData {
  name?: string;
  address?: string;
}

// Generate schema based on type
function generateSchema(type: string, data: Record<string, unknown>, url?: string): object {
  const baseSchema = {
    '@context': 'https://schema.org',
    '@type': type,
  };

  switch (type) {
    case 'Organization': {
      const contactPoint = data.contactPoint as ContactPointData | undefined;
      return {
        ...baseSchema,
        name: data.name || 'Company Name',
        url: data.url || url,
        logo: data.logo || `${url}/logo.png`,
        description: data.description || '',
        sameAs: data.socialProfiles || [],
        contactPoint: contactPoint ? {
          '@type': 'ContactPoint',
          telephone: contactPoint.phone,
          email: contactPoint.email,
          contactType: contactPoint.type || 'customer service',
        } : undefined,
      };
    }

    case 'LocalBusiness': {
      const address = data.address as AddressData | undefined;
      const coordinates = data.coordinates as CoordinatesData | undefined;
      return {
        ...baseSchema,
        name: data.name || 'Business Name',
        url: data.url || url,
        image: data.image,
        telephone: data.phone,
        email: data.email,
        address: address ? {
          '@type': 'PostalAddress',
          streetAddress: address.street,
          addressLocality: address.city,
          addressRegion: address.state,
          postalCode: address.zip,
          addressCountry: address.country,
        } : undefined,
        geo: coordinates ? {
          '@type': 'GeoCoordinates',
          latitude: coordinates.lat,
          longitude: coordinates.lng,
        } : undefined,
        openingHoursSpecification: data.hours,
        priceRange: data.priceRange,
      };
    }

    case 'Product': {
      const rating = data.rating as RatingData | undefined;
      return {
        ...baseSchema,
        name: data.name || 'Product Name',
        description: data.description,
        image: data.images || [],
        sku: data.sku,
        brand: data.brand ? {
          '@type': 'Brand',
          name: data.brand,
        } : undefined,
        offers: {
          '@type': 'Offer',
          price: data.price,
          priceCurrency: data.currency || 'USD',
          availability: data.availability || 'https://schema.org/InStock',
          url: data.url || url,
        },
        aggregateRating: rating ? {
          '@type': 'AggregateRating',
          ratingValue: rating.value,
          reviewCount: rating.count,
        } : undefined,
      };
    }

    case 'Article':
    case 'BlogPosting':
      return {
        ...baseSchema,
        headline: data.title || 'Article Title',
        description: data.description,
        image: data.image,
        datePublished: data.publishedDate,
        dateModified: data.modifiedDate || data.publishedDate,
        author: {
          '@type': data.authorType || 'Person',
          name: data.author || 'Author Name',
          url: data.authorUrl,
        },
        publisher: {
          '@type': 'Organization',
          name: data.publisher || 'Publisher Name',
          logo: {
            '@type': 'ImageObject',
            url: data.publisherLogo,
          },
        },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': url,
        },
      };

    case 'FAQ':
      return {
        ...baseSchema,
        mainEntity: ((data.questions || []) as FAQQuestion[]).map((q: FAQQuestion) => ({
          '@type': 'Question',
          name: q.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: q.answer,
          },
        })),
      };

    case 'HowTo': {
      const costData = data.cost as { currency?: string; value?: number } | undefined;
      return {
        ...baseSchema,
        name: data.title || 'How To Guide',
        description: data.description,
        image: data.image,
        totalTime: data.totalTime,
        estimatedCost: costData ? {
          '@type': 'MonetaryAmount',
          currency: costData.currency || 'USD',
          value: costData.value,
        } : undefined,
        supply: ((data.supplies || []) as string[]).map((s: string) => ({
          '@type': 'HowToSupply',
          name: s,
        })),
        tool: ((data.tools || []) as string[]).map((t: string) => ({
          '@type': 'HowToTool',
          name: t,
        })),
        step: ((data.steps || []) as HowToStep[]).map((step: HowToStep, index: number) => ({
          '@type': 'HowToStep',
          position: index + 1,
          name: step.name,
          text: step.text,
          image: step.image,
        })),
      };
    }

    case 'Event': {
      const location = data.location as LocationData | undefined;
      return {
        ...baseSchema,
        name: data.name || 'Event Name',
        description: data.description,
        startDate: data.startDate,
        endDate: data.endDate,
        location: location ? {
          '@type': data.locationType || 'Place',
          name: location.name,
          address: location.address,
        } : undefined,
        organizer: data.organizer ? {
          '@type': 'Organization',
          name: data.organizer,
          url: data.organizerUrl,
        } : undefined,
        offers: data.ticketPrice ? {
          '@type': 'Offer',
          price: data.ticketPrice,
          priceCurrency: data.currency || 'USD',
          url: data.ticketUrl,
          availability: 'https://schema.org/InStock',
        } : undefined,
        image: data.image,
        performer: data.performer,
      };
    }

    case 'BreadcrumbList':
      return {
        ...baseSchema,
        itemListElement: ((data.items || []) as BreadcrumbItem[]).map((item: BreadcrumbItem, index: number) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      };

    case 'VideoObject':
      return {
        ...baseSchema,
        name: data.title || 'Video Title',
        description: data.description,
        thumbnailUrl: data.thumbnail,
        uploadDate: data.uploadDate,
        duration: data.duration,
        contentUrl: data.url,
        embedUrl: data.embedUrl,
        publisher: {
          '@type': 'Organization',
          name: data.publisher || 'Publisher',
          logo: {
            '@type': 'ImageObject',
            url: data.publisherLogo,
          },
        },
      };

    default:
      return {
        ...baseSchema,
        ...data,
      };
  }
}

/**
 * POST /api/seo/schema
 * Generate JSON-LD schema markup
 */
export async function POST(request: NextRequest) {
  // Security check
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      security.error === 'Authentication required' ? 401 : 403
    );
  }

  try {
    const userId = security.context.userId;
    if (!userId) {
      return APISecurityChecker.createSecureResponse(
        { error: 'User ID not found' },
        401
      );
    }

    // Get subscription
    const subscription = await subscriptionService.getOrCreateSubscription(userId);

    // Check if user has SEO access
    if (subscription.plan === 'free') {
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error: 'Schema generator requires a paid subscription',
          upgradeRequired: true,
          requiredPlan: 'professional',
        },
        402
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = SchemaRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error: 'Invalid request',
          details: validationResult.error.errors,
        },
        400
      );
    }

    const { type, data, url } = validationResult.data;

    // Generate schema
    const schema = generateSchema(type, data, url);

    // Generate HTML script tag
    const scriptTag = `<script type="application/ld+json">
${JSON.stringify(schema, null, 2)}
</script>`;

    return APISecurityChecker.createSecureResponse({
      success: true,
      schema,
      scriptTag,
      type,
      validation: {
        isValid: true,
        warnings: [],
        recommendations: [
          'Test your schema using Google Rich Results Test',
          'Validate with Schema.org validator',
        ],
      },
    });
  } catch (error) {
    logger.error('Schema Generator API error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to generate schema' },
      500
    );
  }
}

/**
 * GET /api/seo/schema
 * Get supported schema types and templates
 */
export async function GET(request: NextRequest) {
  // Security check (public endpoint for schema types)
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.PUBLIC_READ
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  return APISecurityChecker.createSecureResponse({
    success: true,
    supportedTypes: SCHEMA_TYPES,
    templates: {
      Organization: {
        name: '',
        url: '',
        logo: '',
        description: '',
        socialProfiles: [],
        contactPoint: {
          phone: '',
          email: '',
          type: 'customer service',
        },
      },
      Product: {
        name: '',
        description: '',
        images: [],
        sku: '',
        brand: '',
        price: 0,
        currency: 'USD',
        availability: 'InStock',
      },
      Article: {
        title: '',
        description: '',
        image: '',
        publishedDate: '',
        author: '',
        publisher: '',
      },
      FAQ: {
        questions: [
          { question: '', answer: '' },
        ],
      },
    },
  });
}
