/**
 * SYN-863: <script>-strip regexes across the codebase must be case-insensitive,
 * tolerate whitespace + non-whitespace variants in opening/closing tags, AND
 * loop until stable to defeat nested-tag bypass (CodeQL js/incomplete-multi-
 * character-sanitization).
 *
 * Prior implementations were case-sensitive single-line patterns that could be
 * bypassed with <SCRIPT>, <ScRiPt>, </script > (trailing whitespace), or the
 * HTML-permissive variant </script foo bar> (non-whitespace before the closing >).
 *
 * Single-pass strip alone could also be bypassed with `<scr<script></script>ipt>`
 * — after one pass the inner tag is removed, leaving a viable outer tag. The
 * bounded do/while in production callers handles this.
 *
 * Canonical pattern (used in 7 strip sites — see PR description):
 *   /<script[^>]*>[\s\S]*?<\/\s*script\b[^>]*>/gi
 *
 * \b after `script` ensures we still need a word boundary (avoids matching
 * </scripts>); [^>]* then absorbs any garbage between the name and `>`.
 */
const STRIP = /<script[^>]*>[\s\S]*?<\/\s*script\b[^>]*>/gi;

/** Mirror of the recursive-until-stable pattern used in production sanitisers. */
function strip(input: string, depth = 0): string {
  if (depth > 10) return input;
  const stripped = input.replace(STRIP, '');
  return stripped === input ? stripped : strip(stripped, depth + 1);
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

  it('strips nested-tag bypass (CodeQL js/incomplete-multi-character-sanitization)', () => {
    // Iter 1 strips inner `<script></script>` pair → leaves `<script>danger</script>`.
    // Iter 2 strips that. Without the loop, `danger` would survive inside a viable script tag.
    expect(strip('safe<scr<script></script>ipt>danger</scr<script></script>ipt>fine')).toBe('safefine');
  });

  it('strips deeply-nested tag bypass within bounded iterations', () => {
    // Three iterations needed: peel one nesting layer per pass.
    const input = 'safe<scr<scr<script></script>ipt></script>ipt>danger</scr<scr<script></script>ipt></script>ipt>fine';
    expect(strip(input)).toBe('safefine');
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
