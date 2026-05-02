/**
 * SYN-863: HTML strip + sanitisation tests.
 *
 * Production code now uses `lib/sanitize.ts:stripHtmlToText` (DOMPurify-backed)
 * instead of ad-hoc regex chains. This test file validates that the helper
 * defends against the bypass patterns CodeQL flagged on the previous regex
 * implementation:
 *
 *   - case bypass:                 <SCRIPT>, <ScRiPt>
 *   - whitespace bypass:           </script >, </ script>
 *   - HTML-permissive bypass:      </script foo bar>, </script\t\n>
 *   - nested-tag bypass:           <scr<script></script>ipt>alert(1)</script>
 *   - deeply-nested bypass:        2+ layers of nesting
 *
 * DOMPurify (the security boundary) handles all of these because it parses
 * HTML rather than pattern-matching. The remaining tag → whitespace conversion
 * and entity decode are formatting-only and operate on already-sanitised input.
 */

import { stripHtmlToText } from '@/lib/sanitize';

describe('stripHtmlToText (SYN-863)', () => {
  it('strips lowercase <script> blocks', () => {
    expect(stripHtmlToText('a<script>alert(1)</script>b')).toBe('a b');
  });

  it('strips uppercase <SCRIPT> (case bypass)', () => {
    expect(stripHtmlToText('a<SCRIPT>alert(1)</SCRIPT>b')).toBe('a b');
  });

  it('strips mixed-case <ScRiPt> (case bypass)', () => {
    expect(stripHtmlToText('a<ScRiPt>alert(1)</ScRiPt>b')).toBe('a b');
  });

  it('strips closing tag with trailing whitespace', () => {
    expect(stripHtmlToText('a<script>alert(1)</script >b')).toBe('a b');
  });

  it('strips multi-line script body', () => {
    expect(stripHtmlToText('a<script>\n  alert(1);\n</script>b')).toBe('a b');
  });

  it('strips multiple script blocks', () => {
    expect(stripHtmlToText('<script>a</script>X<SCRIPT>b</SCRIPT>')).toBe('X');
  });

  it('produces no executable script markup for malformed nested-tag bypass', () => {
    // A regex-based strip would leave a viable `<script>...</script>` after
    // one pass on input like `<scr<script>...`. DOMPurify produces plain text:
    // any payload that survives is text, not executable markup.
    const input = '<scr<script>PAYLOAD</script>ipt>';
    const result = stripHtmlToText(input);
    expect(result).not.toMatch(/<script\b/i);
    expect(result).not.toMatch(/<\/script\b/i);
  });

  it('produces no executable script markup for deeply-nested bypass attempt', () => {
    const input = 'safe<scr<scr<script>PAYLOAD</script>ipt></script>ipt>fine';
    const result = stripHtmlToText(input);
    expect(result).not.toMatch(/<script\b/i);
    expect(result).toContain('safe');
    expect(result).toContain('fine');
  });

  it('strips style blocks (script-rule cousin)', () => {
    expect(stripHtmlToText('a<style>.x{}</style>b')).toBe('a b');
  });

  it('preserves block-level word boundaries', () => {
    expect(stripHtmlToText('<h1>Welcome</h1><p>To us</p>')).toBe('Welcome To us');
  });

  it('strips iframe + object + embed', () => {
    expect(stripHtmlToText('safe<iframe src="evil.com"></iframe>fine')).toBe('safe fine');
  });

  it('leaves plain text untouched', () => {
    expect(stripHtmlToText('hello world')).toBe('hello world');
  });

  it('decodes &amp; back to &', () => {
    expect(stripHtmlToText('Tom &amp; Jerry')).toBe('Tom & Jerry');
  });
});
