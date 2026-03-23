import matter from 'gray-matter';

export interface ObsidianParseResult {
  title: string;
  content: string;       // cleaned body (WikiLinks stripped)
  platform: string;      // from front matter or 'general'
  tone?: string;
  topic?: string;
  hashtags: string[];    // from front matter tags or inline #tags
  frontMatter: Record<string, unknown>;
}

/**
 * Strip WikiLinks from a markdown string.
 *
 * [[note name]]           → note name
 * [[note name|alias]]     → alias
 */
function stripWikiLinks(text: string): string {
  return text.replace(/\[\[([^\]]+)\]\]/g, (_match, inner: string) => {
    const pipeIndex = inner.indexOf('|');
    if (pipeIndex !== -1) {
      return inner.slice(pipeIndex + 1).trim();
    }
    return inner.trim();
  });
}

/**
 * Extract inline hashtags from body text.
 *
 * Matches \B#([a-zA-Z][a-zA-Z0-9_-]*) — excludes markdown headings because
 * headings start at the beginning of a line with '#', so \B (non-word
 * boundary) will not match there.
 */
function extractInlineHashtags(text: string): string[] {
  const pattern = /\B#([a-zA-Z][a-zA-Z0-9_-]*)/g;
  const tags: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    tags.push(match[1]);
  }

  return tags;
}

/**
 * Extract the first H1 heading from body text, returning null if none found.
 */
function extractFirstH1(text: string): string | null {
  const match = /^#\s+(.+)$/m.exec(text);
  return match ? match[1].trim() : null;
}

/**
 * Parse an Obsidian markdown note into a structured object.
 *
 * Parsing rules:
 * 1. YAML front matter (between ---) parsed with gray-matter
 * 2. WikiLinks [[note name]] → stripped to plain `note name`
 * 3. WikiLinks [[note|alias]]  → stripped to `alias`
 * 4. Inline hashtags #tag collected when `hashtags` not in front matter
 * 5. title: front matter title → first # H1 → fallback 'Untitled'
 * 6. platform: front matter platform (comma-split, first value) → 'general'
 * 7. tone: front matter tone (string) if present
 * 8. topic: front matter topic (string) if present
 * 9. content: body with WikiLinks stripped
 */
export function parseObsidianNote(markdown: string): ObsidianParseResult {
  if (!markdown || markdown.trim() === '') {
    return {
      title: 'Untitled',
      content: '',
      platform: 'general',
      hashtags: [],
      frontMatter: {},
    };
  }

  const parsed = matter(markdown);
  const fm = parsed.data as Record<string, unknown>;
  const rawBody = parsed.content ?? '';

  // --- title ---
  let title = 'Untitled';
  if (typeof fm['title'] === 'string' && fm['title'].trim() !== '') {
    title = fm['title'].trim();
  } else {
    const h1 = extractFirstH1(rawBody);
    if (h1) {
      title = stripWikiLinks(h1);
    }
  }

  // --- platform ---
  let platform = 'general';
  if (typeof fm['platform'] === 'string' && fm['platform'].trim() !== '') {
    const first = fm['platform'].split(',')[0];
    platform = first.trim() || 'general';
  }

  // --- tone ---
  const tone: string | undefined =
    typeof fm['tone'] === 'string' && fm['tone'].trim() !== ''
      ? fm['tone'].trim()
      : undefined;

  // --- topic ---
  const topic: string | undefined =
    typeof fm['topic'] === 'string' && fm['topic'].trim() !== ''
      ? fm['topic'].trim()
      : undefined;

  // --- content (WikiLinks stripped) ---
  const content = stripWikiLinks(rawBody);

  // --- hashtags ---
  let hashtags: string[] = [];
  if (Array.isArray(fm['hashtags'])) {
    hashtags = (fm['hashtags'] as unknown[])
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim())
      .filter((t) => t !== '');
  } else if (Array.isArray(fm['tags'])) {
    hashtags = (fm['tags'] as unknown[])
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim())
      .filter((t) => t !== '');
  } else {
    // Fall back to inline hashtag extraction on the raw body
    hashtags = extractInlineHashtags(rawBody);
  }

  return {
    title,
    content,
    platform,
    ...(tone !== undefined && { tone }),
    ...(topic !== undefined && { topic }),
    hashtags,
    frontMatter: fm,
  };
}
