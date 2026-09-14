/**
 * Social posts are captions, not articles.
 * Grounded in Wikipedia:Signs of AI writing — no markdown theatre.
 */

export const SOCIAL_POST_VOICE = `
--- THIS IS A SOCIAL POST, NOT AN ARTICLE ---
Write the caption a person would tap Share on. One voice. No document.

Never use Markdown: no **, __, # headings, bullet headers, or title-case section titles.
Never use em dashes. Never open with "Here's a post" or "I hope this helps".
No "not just X, but Y", "delve", "tapestry", "landscape", "in conclusion".
No emoji as decoration around headings. Hashtags only at the end if asked.
Sound like the business talking to a neighbour, not a press release.
--- END SOCIAL POST ---
`.trim();

export function withSocialPostVoice(prompt: string): string {
  return `${prompt}\n\n${SOCIAL_POST_VOICE}`;
}
