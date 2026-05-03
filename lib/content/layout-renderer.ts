/**
 * Layout Renderer — SYN-475
 *
 * Post-processes AI-generated HTML articles to inject:
 * - Author block after first paragraph
 * - Schema.org structured data (HowTo for how_to, Article for others)
 * - Location signals in headings (if suburb absent)
 * - CTA block before closing paragraph
 *
 * Operates on raw HTML strings returned by the content generator.
 */

import { stripHtmlToText } from '@/lib/sanitize';

export interface AuthorBlockProps {
  name: string;
  credential: string;
  experienceYears: number;
  gbpLink?: string;
  photoUrl?: string;
  bio?: string;
}

type SeoContentType =
  | 'blog_local_authority'
  | 'how_to'
  | 'listicle'
  | 'news_item'
  | 'comparison'
  | 'case_study';

interface OrgData {
  name: string;
  suburb: string;
  phone?: string;
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export type ContentMode = 'standard' | 'aeo' | 'geo';

export function injectLayoutSignals(
  html: string,
  orgData: OrgData,
  author: AuthorBlockProps,
  seoContentType: SeoContentType,
  contentMode?: ContentMode
): string {
  let result = html;

  // 1. Inject author block after first paragraph
  result = injectAuthorBlock(result, author, orgData);

  // 2. Ensure suburb appears in at least 2 headings
  result = ensureLocalSignals(result, orgData.suburb);

  // 3. Add CTA block before last closing tag
  if (orgData.phone || orgData.name) {
    result = injectCTABlock(result, orgData);
  }

  // 4. Inject JSON-LD schema
  const schema = buildSchema(result, orgData, author, seoContentType);
  if (schema) {
    result =
      result +
      `\n<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
  }

  // 5. GEO mode: inject LocalBusiness JSON-LD + NAP block
  if (contentMode === 'geo') {
    result = injectNAPBlock(result, orgData);
    const localBusinessSchema = buildLocalBusinessSchema(orgData, author);
    result =
      result +
      `\n<script type="application/ld+json">\n${JSON.stringify(localBusinessSchema, null, 2)}\n</script>`;
  }

  // 6. AEO mode: inject FAQ JSON-LD from Q:/A: pairs
  if (contentMode === 'aeo') {
    const faqSchema = buildFAQSchema(result);
    if (faqSchema) {
      result =
        result +
        `\n<script type="application/ld+json">\n${JSON.stringify(faqSchema, null, 2)}\n</script>`;
    }
  }

  return result;
}

// ============================================================================
// HELPERS
// ============================================================================

function injectAuthorBlock(
  html: string,
  author: AuthorBlockProps,
  orgData: OrgData
): string {
  const authorHtml = buildAuthorHtml(author, orgData);
  // Insert after first </p>
  return html.replace('</p>', `</p>\n${authorHtml}`);
}

function buildAuthorHtml(author: AuthorBlockProps, orgData: OrgData): string {
  const yearsText =
    author.experienceYears > 0
      ? `${author.experienceYears} years experience`
      : '';
  return `<div class="author-block" style="display:flex;gap:16px;align-items:center;padding:16px;background:#f9fafb;border-radius:8px;margin:24px 0;">
  ${author.photoUrl ? `<img src="${escapeHtml(author.photoUrl)}" alt="${escapeHtml(author.name)}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;" />` : ''}
  <div>
    <strong style="display:block;">${escapeHtml(author.name)}</strong>
    <span style="font-size:0.875em;color:#374151;">${escapeHtml(author.credential)}${yearsText ? ` · ${yearsText}` : ''}</span>
    ${author.bio ? `<p style="margin:4px 0 0;font-size:0.875em;color:#6b7280;">${escapeHtml(author.bio)}</p>` : ''}
    ${author.gbpLink ? `<a href="${escapeHtml(author.gbpLink)}" style="font-size:0.875em;color:#f97316;" rel="noopener">View ${escapeHtml(orgData.name)} on Google</a>` : ''}
  </div>
</div>`;
}

function ensureLocalSignals(html: string, suburb: string): string {
  if (!suburb) return html;

  // Count how many headings already mention the suburb
  const headingMatches = (
    html.match(/<h[2-4][^>]*>[^<]*<\/h[2-4]>/gi) ?? []
  ).filter(h => h.toLowerCase().includes(suburb.toLowerCase()));

  if (headingMatches.length >= 2) return html;

  // Append "in [suburb]" to the second H2 if suburb not present
  let count = 0;
  return html.replace(/<h2([^>]*)>(.*?)<\/h2>/gi, (match, attrs, content) => {
    count++;
    if (count === 2 && !content.toLowerCase().includes(suburb.toLowerCase())) {
      return `<h2${attrs}>${content} in ${suburb}</h2>`;
    }
    return match;
  });
}

function injectCTABlock(html: string, orgData: OrgData): string {
  const ctaHtml = `<div class="cta-block" style="background:#fff7ed;border:1px solid #fdba74;border-radius:8px;padding:20px;margin:32px 0;text-align:center;">
  <p style="margin:0 0 12px;font-size:1em;font-weight:600;color:#9a3412;">Ready to get started?</p>
  <p style="margin:0 0 16px;color:#374151;">Contact ${escapeHtml(orgData.name)}${orgData.suburb ? ` in ${escapeHtml(orgData.suburb)}` : ''} today.</p>
  ${orgData.phone ? `<a href="tel:${orgData.phone}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;">Call ${escapeHtml(orgData.phone)}</a>` : ''}
</div>`;

  // Insert before the last closing block element
  return html.replace(
    /(<\/(?:div|article|main|section|body)>)\s*$/,
    `\n${ctaHtml}\n$1`
  );
}

function buildSchema(
  html: string,
  orgData: OrgData,
  author: AuthorBlockProps,
  seoContentType: SeoContentType
): Record<string, unknown> | null {
  const baseAuthor = {
    '@type': 'Person',
    name: author.name,
    description: `${author.credential}${author.experienceYears > 0 ? `, ${author.experienceYears} years experience` : ''}`,
  };

  if (seoContentType === 'how_to') {
    // Extract steps from numbered headings
    const steps: string[] = [];
    const stepMatches = html.matchAll(/<h2[^>]*>\d+\.\s*(.*?)<\/h2>/gi);
    for (const m of stepMatches) {
      steps.push(m[1]);
    }

    return {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: extractH1(html) ?? `How to — ${orgData.name}`,
      author: baseAuthor,
      step: steps.map((name, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        name,
      })),
    };
  }

  // Default: Article schema
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: extractH1(html) ?? `Article by ${orgData.name}`,
    author: baseAuthor,
    publisher: {
      '@type': 'Organization',
      name: orgData.name,
    },
    datePublished: new Date().toISOString(),
  };
}

function extractH1(html: string): string | null {
  const match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  return match ? stripHtmlToText(match[1]) : null;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function injectNAPBlock(html: string, orgData: OrgData): string {
  const napHtml = `<div class="nap-block" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:24px 0;font-size:0.9em;color:#374151;">
  <strong>${escapeHtml(orgData.name)}</strong><br/>
  ${orgData.suburb ? `${escapeHtml(orgData.suburb)}<br/>` : ''}
  ${orgData.phone ? `<a href="tel:${orgData.phone}" style="color:#f97316;">${escapeHtml(orgData.phone)}</a>` : ''}
</div>`;
  // Insert before the CTA block or at the end of the article
  return (
    html.replace(/(<div class="cta-block")/, `${napHtml}\n$1`) ||
    html + '\n' + napHtml
  );
}

function buildLocalBusinessSchema(
  orgData: OrgData,
  author: AuthorBlockProps
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: orgData.name,
    description: author.bio ?? undefined,
    ...(orgData.suburb
      ? {
          address: {
            '@type': 'PostalAddress',
            addressLocality: orgData.suburb,
            addressCountry: 'AU',
          },
        }
      : {}),
    ...(orgData.phone ? { telephone: orgData.phone } : {}),
    ...(author.gbpLink ? { url: author.gbpLink } : {}),
  };
}

function buildFAQSchema(html: string): Record<string, unknown> | null {
  // Extract Q:/A: pairs from the article
  const pairs: { q: string; a: string }[] = [];
  const regex = /Q:\s*([^\n]+)\s*\nA:\s*([^\n]+)/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    pairs.push({ q: match[1].trim(), a: match[2].trim() });
  }
  if (pairs.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: pairs.map(p => ({
      '@type': 'Question',
      name: p.q,
      acceptedAnswer: { '@type': 'Answer', text: p.a },
    })),
  };
}
