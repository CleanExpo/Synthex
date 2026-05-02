/**
 * SYN-863: <script>-strip regexes across the codebase must be case-insensitive
 * and tolerate whitespace variants in opening/closing tags.
 *
 * Prior implementations were case-sensitive single-line patterns that could be
 * bypassed with <SCRIPT>, <ScRiPt>, or </script > (trailing whitespace before
 * the closing >).
 *
 * Canonical pattern (used in 7 strip sites — see PR description):
 *   /<script[^>]*>[\s\S]*?<\/\s*script\s*>/gi
 */
const STRIP = /<script[^>]*>[\s\S]*?<\/\s*script\s*>/gi;

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
