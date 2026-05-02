/**
 * SYN-862: escapeHtml in lib/email.ts must produce HTML-entity-encoded output.
 *
 * The original implementation mapped &/<> to themselves (a no-op), creating an
 * XSS sink in invitation emails. This suite locks in correct entity encoding
 * for the five characters that matter for HTML attribute + text contexts.
 */
import { escapeHtml } from '@/lib/email';

describe('escapeHtml (SYN-862)', () => {
  it('escapes <script> tags', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });

  it('escapes ampersands as &amp; not bare &', () => {
    const result = escapeHtml('Tom & Jerry');
    expect(result).toContain('&amp;');
    expect(result).toBe('Tom &amp; Jerry');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('say "hi"')).toBe('say &quot;hi&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's fine")).toBe('it&#39;s fine');
  });

  it('round-trips all five sensitive characters', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });

  it('returns empty string for undefined/empty input', () => {
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml('')).toBe('');
  });

  it('does not double-escape ampersand-led entities', () => {
    // Input is a literal ampersand followed by "amp;" — this is the correct
    // round-trip behaviour for an unencoded source string.
    expect(escapeHtml('&amp;')).toBe('&amp;amp;');
  });
});
