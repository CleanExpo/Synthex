/**
 * Citation Generator — Formats verified claims into citations in 4 styles.
 *
 * Only generates citations for verified claims with verificationScore >= 0.6.
 *
 * @module lib/authority/citation-generator
 */

import type { ValidatedClaim, GeneratedCitation } from './types';

type CitationFormat = 'footnote' | 'inline' | 'apa' | 'chicago';

function formatAccessedDate(): string {
  return new Date().toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function extractYear(source: { year?: number }): string {
  return source.year ? String(source.year) : new Date().getFullYear().toString();
}

function extractAuthor(sourceName: string): string {
  // Use the source name as the author for institutional sources
  return sourceName;
}

function buildCitationText(
  claimText: string,
  source: {
    sourceName: string;
    url: string;
    title?: string;
    year?: number;
    authors?: string[];
  },
  format: CitationFormat,
  index: number
): string {
  const title = source.title ?? claimText.slice(0, 80).replace(/[""]/g, '"');
  const year  = extractYear(source);
  const author = source.authors && source.authors.length > 0
    ? source.authors[0]
    : extractAuthor(source.sourceName);
  const accessed = formatAccessedDate();

  switch (format) {
    case 'footnote':
      return `[${index}] ${source.sourceName}. "${title}." ${source.url}. Accessed ${accessed}.`;

    case 'inline':
      return `(${source.sourceName}, ${year})`;

    case 'apa':
      return `${author} (${year}). ${title}. ${source.sourceName}. ${source.url}`;

    case 'chicago':
      return `${author}. "${title}." ${source.sourceName}. Accessed ${accessed}. ${source.url}.`;

    default:
      return `[${index}] ${source.sourceName}. "${title}." ${source.url}. Accessed ${accessed}.`;
  }
}

/**
 * Generate formatted citations for verified claims.
 * Only processes claims where verified === true AND verificationScore >= 0.6.
 */
export function generateCitations(
  claims: ValidatedClaim[],
  format: CitationFormat = 'footnote'
): GeneratedCitation[] {
  const eligible = claims.filter(c => c.verified && c.verificationScore >= 0.6);

  const citations: GeneratedCitation[] = [];
  let index = 1;

  for (const claim of eligible) {
    if (claim.sources.length === 0) continue;

    // Use the first (highest-confidence) source
    const source = claim.sources[0];

    const citationText = buildCitationText(
      claim.text,
      {
        sourceName: source.sourceName,
        url: source.url,
        title: source.title,
        year: source.year,
        authors: source.authors,
      },
      format,
      index
    );

    citations.push({
      claimText: claim.text,
      sourceUrl: source.url,
      sourceType: source.sourceType,
      sourceName: source.sourceName,
      confidence: source.confidence,
      citationText,
      format,
    });

    index++;
  }

  return citations;
}

/**
 * Render a full References section as markdown from a list of footnote-style citations.
 */
export function generateFootnoteBlock(citations: GeneratedCitation[]): string {
  if (citations.length === 0) return '';

  const lines = ['## References', ''];

  citations.forEach((citation, i) => {
    // For non-footnote formats, generate a numbered line anyway
    if (citation.format === 'footnote') {
      lines.push(citation.citationText);
    } else {
      // Re-format as a numbered reference entry
      const accessed = formatAccessedDate();
      lines.push(
        `[${i + 1}] ${citation.sourceName}. "${citation.claimText.slice(0, 80)}." ${citation.sourceUrl}. Accessed ${accessed}.`
      );
    }
  });

  return lines.join('\n');
}
