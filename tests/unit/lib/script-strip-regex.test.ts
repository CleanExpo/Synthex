/**
 * SYN-863: <script>-strip regexes across the codebase must be case-insensitive
 * and tolerate whitespace + non-whitespace variants in opening/closing tags.
 *
 * Prior implementations were case-sensitive single-line patterns that could be
 * bypassed with <SCRIPT>, <ScRiPt>, </script > (trailing whitespace), or the
 * HTML-permissive variant </script foo bar> (non-whitespace before the closing >).
 *
 * Canonical pattern (used in 7 strip sites — see PR description):
 *   /<script[^>]*>[\s\S]*?<\/\s*script\b[^>]*>/gi
 *
 * \b after `script` ensures we still need a word boundary (avoids matching
 * </scripts>); [^>]* then absorbs any garbage between the name and `>`.
 */
const STRIP = /<script[^>]*>[\s\S]*?<\/\s*script\b[^>]*>/gi;

function strip(input: string): string {
  return input.replace(STRIP, '');
}

describe('script-strip regex (SYN-863)', () => {
  it('strips lowercase <script>', () => {
    expect(strip('a<script>x</script>b')).toBe('ab');
  });

  it('strips uppercase <SCRIPT> (closes case-sensitive bypass)', () => {
    expect(strip('a<SCRIPT>x</SCRIPT>b')).toBe('ab');
  });

  it('strips mixed-case <ScRiPt> (closes case-sensitive bypass)', () => {
    expect(strip('a<ScRiPt>x</ScRiPt>b')).toBe('ab');
  });

  it('strips opening tag with attributes and whitespace', () => {
    expect(strip('a<script type="text/javascript" >x</script>b')).toBe('ab');
  });

  it('strips closing tag with leading whitespace </ script>', () => {
    expect(strip('a<script>x</ script>b')).toBe('ab');
  });

  it('strips closing tag with trailing whitespace </script >', () => {
    expect(strip('a<script>x</script >b')).toBe('ab');
  });

  it('strips closing tag with tab + newline (CodeQL js/bad-tag-filter)', () => {
    expect(strip('a<script>x</script\t\n>b')).toBe('ab');
  });

  it('strips closing tag with non-whitespace content (HTML-permissive bypass)', () => {
    expect(strip('a<script>x</script foo bar>b')).toBe('ab');
  });

  it('does NOT strip </scripts> (word boundary preserves false-tag safety)', () => {
    expect(strip('<script>a</scripts>')).toBe('<script>a</scripts>');
  });

  it('strips multi-line script body', () => {
    const input = 'a<script>\n  var x = 1;\n  alert(x);\n</script>b';
    expect(strip(input)).toBe('ab');
  });

  it('strips multiple script blocks in one string', () => {
    expect(strip('<script>a</script>X<SCRIPT>b</SCRIPT>')).toBe('X');
  });

  it('leaves non-script content untouched', () => {
    expect(strip('<p>hello</p>')).toBe('<p>hello</p>');
  });
});
