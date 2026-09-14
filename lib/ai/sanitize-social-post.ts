/** Strip AI-article markup so a generated caption can sit on Instagram or LinkedIn. */

export function sanitizeSocialPost(raw: string): string {
  let text = (raw ?? '').trim();
  if (!text) return '';

  text = text.replace(/^```[a-z]*\n?|\n?```$/gim, '');
  text = text.replace(/^#{1,6}\s+/gm, '');
  text = text.replace(/\*\*(.+?)\*\*/g, '$1');
  text = text.replace(/__(.+?)__/g, '$1');
  text = text.replace(/^\s*[-*]\s+/gm, '');
  text = text.replace(/\u2014|\u2013/g, ', ');
  text = text.replace(/[\u201C\u201D]/g, '"');
  text = text.replace(/[\u2018\u2019]/g, "'");
  text = text.replace(
    /^here(?:'s| is)(?: a| your)?(?: social media)? post:?\s*/gim,
    ''
  );
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}
