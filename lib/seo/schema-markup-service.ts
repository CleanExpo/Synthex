/**
 * Schema Markup Manager Service
 *
 * Provides schema markup validation, URL extraction, template library,
 * and rich results preview generation for JSON-LD structured data.
 *
 * Features:
 * - Validate JSON-LD structure and required fields per schema type
 * - Extract existing schema markup from any URL
 * - Template library for all 14 supported schema types
 * - Rich results preview showing how Google would display the data
 *
 * ENVIRONMENT VARIABLES: None required (no external API calls for validation/templates)
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface SchemaValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  score: number; // 0-100
}

export interface ParsedSchema {
  type: string;
  data: Record<string, unknown>;
  isValid: boolean;
  validationResult: SchemaValidationResult;
}

export interface SchemaExtractionResult {
  url: string;
  schemas: ParsedSchema[];
  totalFound: number;
  extractedAt: string;
  isDemo: boolean;
}

export interface SchemaTemplate {
  id: string;
  type: string;
  name: string;
  description: string;
  category: 'business' | 'content' | 'commerce' | 'media' | 'navigation';
  fields: Record<string, unknown>;
  popularity: number; // 1-5
}

export interface RichPreviewResult {
  type: string;
  previewType:
    | 'knowledge-panel'
    | 'product-card'
    | 'article'
    | 'faq'
    | 'event'
    | 'video'
    | 'recipe'
    | 'review'
    | 'generic';
  previewData: Record<string, string | number | boolean | string[]>;
}

// ============================================================================
// VALIDATION RULES
// ============================================================================

interface FieldRule {
  required: boolean;
  type: 'string' | 'url' | 'date' | 'number' | 'array' | 'object';
  message?: string;
}

const VALIDATION_RULES: Record<string, Record<string, FieldRule>> = {
  Organization: {
    name: { required: true, type: 'string' },
    url: { required: true, type: 'url' },
    logo: { required: false, type: 'url' },
    description: { required: false, type: 'string' },
    sameAs: { required: false, type: 'array' },
  },
  LocalBusiness: {
    name: { required: true, type: 'string' },
    address: { required: true, type: 'object' },
    telephone: { required: false, type: 'string' },
    url: { required: false, type: 'url' },
    openingHoursSpecification: { required: false, type: 'array' },
    priceRange: { required: false, type: 'string' },
  },
  Product: {
    name: { required: true, type: 'string' },
    offers: { required: true, type: 'object' },
    description: { required: false, type: 'string' },
    image: { required: false, type: 'url' },
    sku: { required: false, type: 'string' },
    brand: { required: false, type: 'object' },
    aggregateRating: { required: false, type: 'object' },
  },
  Article: {
    headline: { required: true, type: 'string' },
    author: { required: true, type: 'object' },
    datePublished: { required: true, type: 'date' },
    image: { required: false, type: 'url' },
    publisher: { required: false, type: 'object' },
    dateModified: { required: false, type: 'date' },
    description: { required: false, type: 'string' },
  },
  BlogPosting: {
    headline: { required: true, type: 'string' },
    author: { required: true, type: 'object' },
    datePublished: { required: true, type: 'date' },
    image: { required: false, type: 'url' },
    publisher: { required: false, type: 'object' },
    dateModified: { required: false, type: 'date' },
    description: { required: false, type: 'string' },
  },
  FAQ: {
    mainEntity: { required: true, type: 'array', message: 'FAQ schema requires a mainEntity array of Question items' },
  },
  HowTo: {
    name: { required: true, type: 'string' },
    step: { required: true, type: 'array', message: 'HowTo schema requires a step array of HowToStep items' },
    description: { required: false, type: 'string' },
    totalTime: { required: false, type: 'string' },
    estimatedCost: { required: false, type: 'object' },
  },
  Event: {
    name: { required: true, type: 'string' },
    startDate: { required: true, type: 'date' },
    location: { required: false, type: 'object' },
    endDate: { required: false, type: 'date' },
    description: { required: false, type: 'string' },
    offers: { required: false, type: 'object' },
    organizer: { required: false, type: 'object' },
  },
  Person: {
    name: { required: true, type: 'string' },
    url: { required: false, type: 'url' },
    jobTitle: { required: false, type: 'string' },
    worksFor: { required: false, type: 'object' },
    sameAs: { required: false, type: 'array' },
  },
  WebSite: {
    name: { required: true, type: 'string' },
    url: { required: true, type: 'url' },
    potentialAction: { required: false, type: 'object' },
    description: { required: false, type: 'string' },
  },
  BreadcrumbList: {
    itemListElement: { required: true, type: 'array', message: 'BreadcrumbList requires an itemListElement array' },
  },
  VideoObject: {
    name: { required: true, type: 'string' },
    description: { required: true, type: 'string' },
    thumbnailUrl: { required: true, type: 'url' },
    uploadDate: { required: true, type: 'date' },
    contentUrl: { required: false, type: 'url' },
    embedUrl: { required: false, type: 'url' },
    duration: { required: false, type: 'string' },
  },
  Review: {
    itemReviewed: { required: true, type: 'object' },
    author: { required: true, type: 'object' },
    reviewRating: { required: true, type: 'object' },
    reviewBody: { required: false, type: 'string' },
    datePublished: { required: false, type: 'date' },
  },
  Recipe: {
    name: { required: true, type: 'string' },
    image: { required: true, type: 'url' },
    author: { required: false, type: 'object' },
    prepTime: { required: false, type: 'string' },
    cookTime: { required: false, type: 'string' },
    totalTime: { required: false, type: 'string' },
    recipeIngredient: { required: false, type: 'array' },
    recipeInstructions: { required: false, type: 'array' },
    nutrition: { required: false, type: 'object' },
    recipeYield: { required: false, type: 'string' },
    aggregateRating: { required: false, type: 'object' },
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function isValidUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function isValidISODate(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  // Accept ISO 8601 date or datetime strings
  const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;
  if (!dateRegex.test(value)) return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
}

function validateFieldType(
  fieldName: string,
  value: unknown,
  expectedType: FieldRule['type']
): ValidationError | null {
  if (value === undefined || value === null) return null;

  switch (expectedType) {
    case 'string':
      if (typeof value !== 'string') {
        return { field: fieldName, message: `${fieldName} should be a string`, severity: 'warning' };
      }
      break;
    case 'url':
      if (typeof value === 'string' && value.length > 0 && !isValidUrl(value)) {
        return { field: fieldName, message: `${fieldName} should be a valid URL`, severity: 'warning' };
      }
      break;
    case 'date':
      if (typeof value === 'string' && value.length > 0 && !isValidISODate(value)) {
        return { field: fieldName, message: `${fieldName} should be a valid ISO date (e.g. 2024-01-15)`, severity: 'warning' };
      }
      break;
    case 'number':
      if (typeof value !== 'number' && isNaN(Number(value))) {
        return { field: fieldName, message: `${fieldName} should be numeric`, severity: 'warning' };
      }
      break;
    case 'array':
      if (!Array.isArray(value)) {
        return { field: fieldName, message: `${fieldName} should be an array`, severity: 'warning' };
      }
      break;
    case 'object':
      if (typeof value !== 'object' || Array.isArray(value)) {
        return { field: fieldName, message: `${fieldName} should be an object`, severity: 'warning' };
      }
      break;
  }

  return null;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate a JSON-LD schema object.
 * Checks structure, required fields, and field types per @type.
 */
export function validateSchema(schema: Record<string, unknown>): SchemaValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Check @context
  if (!schema['@context']) {
    errors.push({
      field: '@context',
      message: '@context is required and should be "https://schema.org"',
      severity: 'error',
    });
  } else if (
    schema['@context'] !== 'https://schema.org' &&
    schema['@context'] !== 'http://schema.org'
  ) {
    warnings.push({
      field: '@context',
      message: '@context should be "https://schema.org"',
      severity: 'warning',
    });
  }

  // Check @type
  if (!schema['@type']) {
    errors.push({
      field: '@type',
      message: '@type is required',
      severity: 'error',
    });
  }

  const schemaType = schema['@type'] as string;

  // Type-specific validation
  const rules = VALIDATION_RULES[schemaType];
  if (rules) {
    for (const [fieldName, rule] of Object.entries(rules)) {
      const value = schema[fieldName];

      // Check required fields
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field: fieldName,
          message: rule.message || `${fieldName} is required for ${schemaType} schema`,
          severity: 'error',
        });
        continue;
      }

      // Check field types
      const typeError = validateFieldType(fieldName, value, rule.type);
      if (typeError) {
        if (rule.required) {
          typeError.severity = 'error';
          errors.push(typeError);
        } else {
          warnings.push(typeError);
        }
      }
    }
  } else if (schemaType) {
    warnings.push({
      field: '@type',
      message: `Schema type "${schemaType}" is not in the standard template library. Validation may be incomplete.`,
      severity: 'warning',
    });
  }

  // Calculate score
  const score = Math.max(0, 100 - errors.length * 15 - warnings.length * 5);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    score,
  };
}

// ============================================================================
// URL EXTRACTION
// ============================================================================

/** Demo data for URL extraction fallback */
function getDemoExtractionResult(url: string): SchemaExtractionResult {
  const orgSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Example Corp',
    url: 'https://example.com',
    logo: 'https://example.com/logo.png',
    description: 'A leading technology company specializing in innovative solutions.',
    sameAs: [
      'https://twitter.com/examplecorp',
      'https://linkedin.com/company/examplecorp',
      'https://facebook.com/examplecorp',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+1-800-555-0199',
      contactType: 'customer service',
      email: 'support@example.com',
    },
  };

  const faqSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'FAQ',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What services do you offer?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'We offer web development, mobile apps, and cloud consulting services.',
        },
      },
      {
        '@type': 'Question',
        name: 'How can I contact support?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'You can reach our support team via email at support@example.com or call 1-800-555-0199.',
        },
      },
    ],
  };

  const orgValidation = validateSchema(orgSchema);
  const faqValidation = validateSchema(faqSchema);

  return {
    url,
    schemas: [
      {
        type: 'Organization',
        data: orgSchema,
        isValid: orgValidation.isValid,
        validationResult: orgValidation,
      },
      {
        type: 'FAQ',
        data: faqSchema,
        isValid: faqValidation.isValid,
        validationResult: faqValidation,
      },
    ],
    totalFound: 2,
    extractedAt: new Date().toISOString(),
    isDemo: true,
  };
}

/**
 * Extract JSON-LD schema markup from a URL.
 * Fetches the page HTML and parses all <script type="application/ld+json"> tags.
 * Falls back to demo data if fetch fails.
 */
export async function extractSchemaFromUrl(url: string): Promise<SchemaExtractionResult> {
  try {
    // Validate URL
    new URL(url);

    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'Synthex Schema Extractor/1.0',
        Accept: 'text/html',
      },
    });

    if (!response.ok) {
      console.warn(`Schema extraction: URL returned ${response.status} for ${url}`);
      return getDemoExtractionResult(url);
    }

    const html = await response.text();

    // Extract all JSON-LD script tags
    const jsonLdRegex =
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

    const schemas: ParsedSchema[] = [];
    let match: RegExpExecArray | null;

    while ((match = jsonLdRegex.exec(html)) !== null) {
      try {
        const jsonContent = match[1].trim();
        const parsed = JSON.parse(jsonContent) as Record<string, unknown>;

        // Handle both single objects and arrays of objects
        const items: Record<string, unknown>[] = Array.isArray(parsed) ? parsed : [parsed];

        for (const item of items) {
          if (item['@context'] && item['@type']) {
            const validationResult = validateSchema(item);
            schemas.push({
              type: item['@type'] as string,
              data: item,
              isValid: validationResult.isValid,
              validationResult,
            });
          }
        }
      } catch {
        // Skip malformed JSON-LD blocks
        continue;
      }
    }

    return {
      url,
      schemas,
      totalFound: schemas.length,
      extractedAt: new Date().toISOString(),
      isDemo: false,
    };
  } catch (error) {
    console.warn('Schema extraction failed, returning demo data:', error);
    return getDemoExtractionResult(url);
  }
}

// ============================================================================
// TEMPLATES
// ============================================================================

/**
 * Get predefined schema templates for all 14 supported types.
 * Templates have realistic example data grouped by category.
 */
export function getSchemaTemplates(): SchemaTemplate[] {
  return [
    // Business category
    {
      id: 'organization-standard',
      type: 'Organization',
      name: 'Organization',
      description: 'Company or organization with contact info and social profiles',
      category: 'business',
      popularity: 5,
      fields: {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Acme Corporation',
        url: 'https://www.acme.com',
        logo: 'https://www.acme.com/logo.png',
        description: 'Leading provider of innovative business solutions since 2010.',
        sameAs: [
          'https://twitter.com/acmecorp',
          'https://linkedin.com/company/acmecorp',
        ],
        contactPoint: {
          '@type': 'ContactPoint',
          telephone: '+1-800-555-0100',
          contactType: 'customer service',
          email: 'info@acme.com',
        },
      },
    },
    {
      id: 'local-business-standard',
      type: 'LocalBusiness',
      name: 'Local Business',
      description: 'Physical business location with address, hours, and contact details',
      category: 'business',
      popularity: 5,
      fields: {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: 'Downtown Coffee Shop',
        url: 'https://www.downtowncoffee.com',
        telephone: '+1-555-0123',
        email: 'hello@downtowncoffee.com',
        image: 'https://www.downtowncoffee.com/storefront.jpg',
        address: {
          '@type': 'PostalAddress',
          streetAddress: '123 Main Street',
          addressLocality: 'San Francisco',
          addressRegion: 'CA',
          postalCode: '94102',
          addressCountry: 'US',
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: 37.7749,
          longitude: -122.4194,
        },
        priceRange: '$$',
        openingHoursSpecification: [
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            opens: '07:00',
            closes: '19:00',
          },
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Saturday', 'Sunday'],
            opens: '08:00',
            closes: '17:00',
          },
        ],
      },
    },
    {
      id: 'person-professional',
      type: 'Person',
      name: 'Person / Professional Profile',
      description: 'Individual person with job title, employer, and social links',
      category: 'business',
      popularity: 3,
      fields: {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: 'Jane Smith',
        jobTitle: 'Chief Technology Officer',
        url: 'https://www.janesmith.com',
        worksFor: {
          '@type': 'Organization',
          name: 'Acme Corporation',
          url: 'https://www.acme.com',
        },
        sameAs: [
          'https://linkedin.com/in/janesmith',
          'https://twitter.com/janesmith',
          'https://github.com/janesmith',
        ],
        image: 'https://www.janesmith.com/headshot.jpg',
        email: 'jane@janesmith.com',
      },
    },

    // Content category
    {
      id: 'article-standard',
      type: 'Article',
      name: 'Article',
      description: 'News or informational article with author and publication details',
      category: 'content',
      popularity: 5,
      fields: {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: 'How to Improve Your Website Performance in 2024',
        description: 'A comprehensive guide to optimizing your website for speed and user experience.',
        image: 'https://www.example.com/article-hero.jpg',
        datePublished: '2024-03-15T08:00:00Z',
        dateModified: '2024-03-20T10:30:00Z',
        author: {
          '@type': 'Person',
          name: 'John Doe',
          url: 'https://www.example.com/author/johndoe',
        },
        publisher: {
          '@type': 'Organization',
          name: 'Tech Weekly',
          logo: {
            '@type': 'ImageObject',
            url: 'https://www.example.com/logo.png',
          },
        },
      },
    },
    {
      id: 'blogposting-standard',
      type: 'BlogPosting',
      name: 'Blog Post',
      description: 'Blog article with author, date, and publisher information',
      category: 'content',
      popularity: 4,
      fields: {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: '10 Tips for Better Content Marketing',
        description: 'Learn proven strategies to boost your content marketing results.',
        image: 'https://www.myblog.com/post-image.jpg',
        datePublished: '2024-06-01T09:00:00Z',
        dateModified: '2024-06-05T14:00:00Z',
        author: {
          '@type': 'Person',
          name: 'Sarah Johnson',
          url: 'https://www.myblog.com/author/sarah',
        },
        publisher: {
          '@type': 'Organization',
          name: 'Marketing Insights Blog',
          logo: {
            '@type': 'ImageObject',
            url: 'https://www.myblog.com/logo.png',
          },
        },
      },
    },
    {
      id: 'faq-standard',
      type: 'FAQ',
      name: 'FAQ Page',
      description: 'Frequently asked questions with expandable answers in search results',
      category: 'content',
      popularity: 5,
      fields: {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'What is your return policy?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'We offer a 30-day money-back guarantee on all purchases. Simply contact our support team to initiate a return.',
            },
          },
          {
            '@type': 'Question',
            name: 'How long does shipping take?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Standard shipping takes 5-7 business days. Express shipping is available for 2-3 business day delivery.',
            },
          },
          {
            '@type': 'Question',
            name: 'Do you offer international shipping?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes, we ship to over 50 countries worldwide. International shipping typically takes 10-15 business days.',
            },
          },
        ],
      },
    },
    {
      id: 'howto-standard',
      type: 'HowTo',
      name: 'How-To Guide',
      description: 'Step-by-step instructions that can appear as rich results in Google',
      category: 'content',
      popularity: 3,
      fields: {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: 'How to Set Up a Home Office',
        description: 'A complete guide to creating a productive home office workspace.',
        totalTime: 'PT2H',
        estimatedCost: {
          '@type': 'MonetaryAmount',
          currency: 'USD',
          value: 500,
        },
        step: [
          {
            '@type': 'HowToStep',
            position: 1,
            name: 'Choose your space',
            text: 'Select a quiet area with good natural lighting and minimal distractions.',
          },
          {
            '@type': 'HowToStep',
            position: 2,
            name: 'Get a proper desk and chair',
            text: 'Invest in an ergonomic desk and adjustable chair for long-term comfort.',
          },
          {
            '@type': 'HowToStep',
            position: 3,
            name: 'Set up your technology',
            text: 'Connect your computer, monitor, keyboard, and ensure stable internet access.',
          },
        ],
      },
    },

    // Commerce category
    {
      id: 'product-standard',
      type: 'Product',
      name: 'Product',
      description: 'Physical or digital product with price, availability, and reviews',
      category: 'commerce',
      popularity: 5,
      fields: {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: 'Wireless Noise-Canceling Headphones',
        description: 'Premium wireless headphones with active noise cancellation and 30-hour battery life.',
        image: 'https://www.store.com/headphones.jpg',
        sku: 'WNC-PRO-2024',
        brand: {
          '@type': 'Brand',
          name: 'AudioTech',
        },
        offers: {
          '@type': 'Offer',
          price: 249.99,
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          url: 'https://www.store.com/headphones',
        },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: 4.7,
          reviewCount: 1283,
        },
      },
    },
    {
      id: 'review-standard',
      type: 'Review',
      name: 'Review',
      description: 'Product or service review with rating and author information',
      category: 'commerce',
      popularity: 4,
      fields: {
        '@context': 'https://schema.org',
        '@type': 'Review',
        itemReviewed: {
          '@type': 'Product',
          name: 'Wireless Noise-Canceling Headphones',
          url: 'https://www.store.com/headphones',
        },
        author: {
          '@type': 'Person',
          name: 'Mike Chen',
        },
        reviewRating: {
          '@type': 'Rating',
          ratingValue: 5,
          bestRating: 5,
        },
        reviewBody: 'Excellent sound quality and the noise cancellation is top-notch. Battery lasts all day.',
        datePublished: '2024-05-10',
      },
    },

    // Media category
    {
      id: 'video-standard',
      type: 'VideoObject',
      name: 'Video',
      description: 'Video content with thumbnail, duration, and upload date for video rich results',
      category: 'media',
      popularity: 4,
      fields: {
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        name: 'Getting Started with Schema Markup',
        description: 'Learn how to implement JSON-LD structured data on your website for better SEO.',
        thumbnailUrl: 'https://www.example.com/video-thumb.jpg',
        uploadDate: '2024-04-01T12:00:00Z',
        duration: 'PT12M30S',
        contentUrl: 'https://www.example.com/videos/schema-markup-tutorial.mp4',
        embedUrl: 'https://www.youtube.com/embed/abc123def',
        publisher: {
          '@type': 'Organization',
          name: 'SEO Academy',
          logo: {
            '@type': 'ImageObject',
            url: 'https://www.example.com/logo.png',
          },
        },
      },
    },
    {
      id: 'recipe-standard',
      type: 'Recipe',
      name: 'Recipe',
      description: 'Cooking recipe with ingredients, steps, time, and nutritional info',
      category: 'media',
      popularity: 4,
      fields: {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Classic Margherita Pizza',
        image: 'https://www.recipes.com/margherita-pizza.jpg',
        author: {
          '@type': 'Person',
          name: 'Chef Maria',
        },
        prepTime: 'PT30M',
        cookTime: 'PT15M',
        totalTime: 'PT45M',
        recipeYield: '4 servings',
        recipeIngredient: [
          '2 cups all-purpose flour',
          '1 cup warm water',
          '2 tsp active dry yeast',
          '1 cup San Marzano tomato sauce',
          '8 oz fresh mozzarella',
          'Fresh basil leaves',
          'Extra virgin olive oil',
        ],
        recipeInstructions: [
          {
            '@type': 'HowToStep',
            text: 'Mix flour, water, and yeast. Knead for 10 minutes until smooth.',
          },
          {
            '@type': 'HowToStep',
            text: 'Let dough rise for 1 hour in a warm place.',
          },
          {
            '@type': 'HowToStep',
            text: 'Roll out dough, add sauce and toppings. Bake at 475F for 12-15 minutes.',
          },
        ],
        nutrition: {
          '@type': 'NutritionInformation',
          calories: '285 calories',
          fatContent: '10g',
          proteinContent: '12g',
        },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: 4.8,
          reviewCount: 456,
        },
      },
    },
    {
      id: 'event-standard',
      type: 'Event',
      name: 'Event',
      description: 'Conference, concert, or meetup with date, location, and ticket info',
      category: 'media',
      popularity: 3,
      fields: {
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: 'Annual Tech Conference 2024',
        description: 'Join 5000+ developers for three days of talks, workshops, and networking.',
        startDate: '2024-09-15T09:00:00-07:00',
        endDate: '2024-09-17T18:00:00-07:00',
        location: {
          '@type': 'Place',
          name: 'Moscone Center',
          address: {
            '@type': 'PostalAddress',
            streetAddress: '747 Howard Street',
            addressLocality: 'San Francisco',
            addressRegion: 'CA',
            postalCode: '94103',
            addressCountry: 'US',
          },
        },
        organizer: {
          '@type': 'Organization',
          name: 'TechEvents Inc.',
          url: 'https://www.techevents.com',
        },
        offers: {
          '@type': 'Offer',
          price: 799,
          priceCurrency: 'USD',
          url: 'https://www.techconf.com/tickets',
          availability: 'https://schema.org/InStock',
        },
        image: 'https://www.techconf.com/banner.jpg',
      },
    },

    // Navigation category
    {
      id: 'website-with-search',
      type: 'WebSite',
      name: 'Website with Sitelinks Search',
      description: 'Website schema that enables the sitelinks search box in Google',
      category: 'navigation',
      popularity: 4,
      fields: {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Acme Corporation',
        url: 'https://www.acme.com',
        description: 'Leading provider of innovative business solutions.',
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: 'https://www.acme.com/search?q={search_term_string}',
          },
          'query-input': 'required name=search_term_string',
        },
      },
    },
    {
      id: 'breadcrumb-standard',
      type: 'BreadcrumbList',
      name: 'Breadcrumb Navigation',
      description: 'Page hierarchy breadcrumbs shown in search results',
      category: 'navigation',
      popularity: 4,
      fields: {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://www.example.com',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Products',
            item: 'https://www.example.com/products',
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: 'Headphones',
            item: 'https://www.example.com/products/headphones',
          },
        ],
      },
    },
  ];
}

// ============================================================================
// RICH PREVIEW
// ============================================================================

/**
 * Generate a SERP-like rich results preview based on schema @type.
 * Returns structured data describing how Google would display the rich result.
 */
export function generateRichPreview(schema: Record<string, unknown>): RichPreviewResult {
  const schemaType = (schema['@type'] as string) || 'Unknown';

  switch (schemaType) {
    case 'Organization':
      return {
        type: schemaType,
        previewType: 'knowledge-panel',
        previewData: {
          name: (schema.name as string) || 'Organization Name',
          description: (schema.description as string) || '',
          logo: (schema.logo as string) || '',
          url: (schema.url as string) || '',
          socialLinks: Array.isArray(schema.sameAs) ? (schema.sameAs as string[]) : [],
          hasContactInfo: !!schema.contactPoint,
        },
      };

    case 'LocalBusiness':
      return {
        type: schemaType,
        previewType: 'knowledge-panel',
        previewData: {
          name: (schema.name as string) || 'Business Name',
          address: schema.address
            ? formatAddress(schema.address as Record<string, unknown>)
            : '',
          telephone: (schema.telephone as string) || '',
          priceRange: (schema.priceRange as string) || '',
          url: (schema.url as string) || '',
          hasHours: !!schema.openingHoursSpecification,
          hasLocation: !!schema.geo,
        },
      };

    case 'Product': {
      const offers = schema.offers as Record<string, unknown> | undefined;
      const rating = schema.aggregateRating as Record<string, unknown> | undefined;
      return {
        type: schemaType,
        previewType: 'product-card',
        previewData: {
          name: (schema.name as string) || 'Product Name',
          price: offers?.price !== undefined ? String(offers.price) : '',
          currency: (offers?.priceCurrency as string) || 'USD',
          availability: offers?.availability
            ? (offers.availability as string).replace('https://schema.org/', '')
            : 'Unknown',
          rating: rating?.ratingValue !== undefined ? Number(rating.ratingValue) : 0,
          reviewCount: rating?.reviewCount !== undefined ? Number(rating.reviewCount) : 0,
          image: (schema.image as string) || '',
          hasRating: !!rating,
        },
      };
    }

    case 'Article':
    case 'BlogPosting': {
      const author = schema.author as Record<string, unknown> | undefined;
      return {
        type: schemaType,
        previewType: 'article',
        previewData: {
          headline: (schema.headline as string) || 'Article Title',
          datePublished: (schema.datePublished as string) || '',
          author: (author?.name as string) || 'Unknown Author',
          image: (schema.image as string) || '',
          description: (schema.description as string) || '',
          isNewsArticle: schemaType === 'Article',
        },
      };
    }

    case 'FAQ':
    case 'FAQPage': {
      const questions = (schema.mainEntity as Record<string, unknown>[]) || [];
      return {
        type: schemaType,
        previewType: 'faq',
        previewData: {
          questionCount: questions.length,
          questions: questions
            .slice(0, 5)
            .map((q) => (q.name as string) || ''),
          answers: questions
            .slice(0, 5)
            .map((q) => {
              const answer = q.acceptedAnswer as Record<string, unknown> | undefined;
              return (answer?.text as string) || '';
            }),
          hasExpandableAnswers: true,
        },
      };
    }

    case 'Event': {
      const eventOffers = schema.offers as Record<string, unknown> | undefined;
      const location = schema.location as Record<string, unknown> | undefined;
      return {
        type: schemaType,
        previewType: 'event',
        previewData: {
          name: (schema.name as string) || 'Event Name',
          startDate: (schema.startDate as string) || '',
          endDate: (schema.endDate as string) || '',
          location: location?.name
            ? (location.name as string)
            : location?.address
              ? typeof location.address === 'string'
                ? location.address
                : formatAddress(location.address as Record<string, unknown>)
              : '',
          ticketPrice: eventOffers?.price !== undefined ? String(eventOffers.price) : '',
          ticketCurrency: (eventOffers?.priceCurrency as string) || 'USD',
          image: (schema.image as string) || '',
          hasTickets: !!eventOffers,
        },
      };
    }

    case 'VideoObject':
      return {
        type: schemaType,
        previewType: 'video',
        previewData: {
          title: (schema.name as string) || 'Video Title',
          description: (schema.description as string) || '',
          thumbnail: (schema.thumbnailUrl as string) || '',
          duration: (schema.duration as string) || '',
          uploadDate: (schema.uploadDate as string) || '',
          hasEmbed: !!schema.embedUrl,
        },
      };

    case 'Recipe': {
      const recipeRating = schema.aggregateRating as Record<string, unknown> | undefined;
      const nutrition = schema.nutrition as Record<string, unknown> | undefined;
      return {
        type: schemaType,
        previewType: 'recipe',
        previewData: {
          name: (schema.name as string) || 'Recipe Name',
          image: (schema.image as string) || '',
          rating: recipeRating?.ratingValue !== undefined ? Number(recipeRating.ratingValue) : 0,
          reviewCount: recipeRating?.reviewCount !== undefined ? Number(recipeRating.reviewCount) : 0,
          totalTime: (schema.totalTime as string) || '',
          calories: nutrition?.calories !== undefined ? String(nutrition.calories) : '',
          recipeYield: (schema.recipeYield as string) || '',
          hasNutrition: !!nutrition,
        },
      };
    }

    case 'Review': {
      const reviewRating = schema.reviewRating as Record<string, unknown> | undefined;
      const reviewAuthor = schema.author as Record<string, unknown> | undefined;
      const reviewed = schema.itemReviewed as Record<string, unknown> | undefined;
      return {
        type: schemaType,
        previewType: 'review',
        previewData: {
          rating: reviewRating?.ratingValue !== undefined ? Number(reviewRating.ratingValue) : 0,
          bestRating: reviewRating?.bestRating !== undefined ? Number(reviewRating.bestRating) : 5,
          author: (reviewAuthor?.name as string) || 'Anonymous',
          reviewBody: (schema.reviewBody as string) || '',
          itemReviewed: (reviewed?.name as string) || 'Unknown Item',
          datePublished: (schema.datePublished as string) || '',
        },
      };
    }

    default:
      return {
        type: schemaType,
        previewType: 'generic',
        previewData: {
          title: (schema.name as string) || (schema.headline as string) || schemaType,
          description: (schema.description as string) || '',
          url: (schema.url as string) || '',
        },
      };
  }
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

function formatAddress(address: Record<string, unknown>): string {
  const parts: string[] = [];
  if (address.streetAddress) parts.push(address.streetAddress as string);
  if (address.addressLocality) parts.push(address.addressLocality as string);
  if (address.addressRegion) parts.push(address.addressRegion as string);
  if (address.postalCode) parts.push(address.postalCode as string);
  if (address.addressCountry) parts.push(address.addressCountry as string);
  return parts.join(', ');
}
