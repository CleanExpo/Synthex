/**
 * Lightweight topic + hashtag extraction from post text.
 * Frequency-based — no NLP dependency.
 */

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'are',
  'but',
  'not',
  'you',
  'all',
  'can',
  'her',
  'was',
  'one',
  'our',
  'out',
  'has',
  'have',
  'had',
  'this',
  'that',
  'with',
  'from',
  'they',
  'will',
  'what',
  'when',
  'your',
  'more',
  'about',
  'into',
  'than',
  'them',
  'then',
  'some',
  'would',
  'there',
  'their',
  'which',
  'were',
  'been',
  'being',
  'also',
  'just',
  'like',
  'over',
  'such',
  'only',
  'other',
  'into',
  'after',
  'before',
  'because',
  'could',
  'should',
  'these',
  'those',
  'here',
  'where',
  'while',
  'each',
  'make',
  'made',
  'how',
  'who',
  'why',
  'its',
  'it',
  'we',
  'i',
  'a',
  'an',
  'to',
  'of',
  'in',
  'on',
  'at',
  'by',
  'or',
  'as',
  'is',
  'be',
  'do',
  'if',
  'so',
  'no',
  'up',
  'my',
  'me',
  'he',
  'she',
  'his',
  'him',
  'us',
  'new',
  'get',
  'got',
  'amp',
  'via',
  'http',
  'https',
  'www',
  'com',
  'today',
  'week',
  'year',
  'time',
  'people',
  'really',
  'very',
  'much',
  'many',
  'good',
  'great',
  'best',
  'work',
  'working',
  'please',
  'thanks',
  'thank',
  'share',
  'comment',
  'comments',
  'like',
  'likes',
  'post',
  'posts',
  'click',
  'link',
  'read',
  'watch',
  'learn',
  'join',
]);

function tokenise(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? []).filter(
    w => !STOPWORDS.has(w) && !/^\d+$/.test(w)
  );
}

/**
 * Rank distinctive words that appear in at least two posts (or twice in one
 * long corpus). Returns title-cased labels.
 */
export function extractPrimaryTopics(
  texts: string[],
  limit = 5
): string[] {
  const counts = new Map<string, number>();
  for (const text of texts) {
    const seen = new Set<string>();
    for (const word of tokenise(text)) {
      if (seen.has(word)) continue;
      seen.add(word);
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }

  const minCount = texts.length >= 2 ? 2 : 1;
  return [...counts.entries()]
    .filter(([, n]) => n >= minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
}

export function extractHashtags(texts: string[], limit = 5): string[] {
  const counts = new Map<string, number>();
  for (const text of texts) {
    const tags = text.match(/#[A-Za-z][\w]*/g) ?? [];
    for (const tag of tags) {
      const key = tag.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}
