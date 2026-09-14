import { sanitizeSocialPost } from '@/lib/ai/sanitize-social-post';

describe('sanitizeSocialPost', () => {
  it('turns markdown headings and bold into a normal caption', () => {
    const raw = `**Why This Matters**\n\nWe fixed the leaky tap this morning — really.\n\nHere's a post:`;
    const out = sanitizeSocialPost(raw);
    expect(out).not.toMatch(/\*\*/);
    expect(out).not.toMatch(/^#/m);
    expect(out).not.toMatch(/—/);
    expect(out).not.toMatch(/here(?:'s| is) a post/i);
    expect(out).toMatch(/leaky tap/i);
  });
});
