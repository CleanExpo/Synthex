/**
 * Unit Tests for lib/sanitize.ts — HTML Sanitization Utility
 *
 * Tests:
 * - HTML entities are escaped / dangerous tags stripped
 * - Script tags are removed
 * - Event handler attributes are removed
 * - SQL injection patterns are handled (passed through as text, not executed)
 * - Normal content passes through unchanged
 * - Edge cases: empty string, whitespace-only, very long input
 * - sanitizeHtml — full tag allowlist
 * - sanitizeInlineHtml — inline-only strict config
 */

import { sanitizeHtml, sanitizeInlineHtml } from '@/lib/sanitize';

// ============================================================================
// sanitizeHtml
// ============================================================================

describe('sanitizeHtml()', () => {
  // ----------------------------------------------------------------
  // Dangerous tags are stripped
  // ----------------------------------------------------------------

  describe('script tags are stripped', () => {
    it('should strip a plain <script> tag', () => {
      const result = sanitizeHtml('<script>alert("xss")</script>Hello');
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert("xss")');
      expect(result).toContain('Hello');
    });

    it('should strip <script> with src attribute', () => {
      const result = sanitizeHtml(
        '<script src="https://evil.com/xss.js"></script>Safe content'
      );
      expect(result).not.toContain('<script');
      expect(result).toContain('Safe content');
    });

    it('should strip <script> with type attribute', () => {
      const result = sanitizeHtml(
        '<script type="text/javascript">document.cookie</script>'
      );
      expect(result).not.toContain('<script');
      expect(result).not.toContain('document.cookie');
    });
  });

  describe('iframe and embed tags are stripped', () => {
    it('should strip <iframe>', () => {
      const result = sanitizeHtml('<iframe src="https://evil.com"></iframe>');
      expect(result).not.toContain('<iframe');
    });

    it('should strip <object>', () => {
      const result = sanitizeHtml('<object data="evil.swf"></object>');
      expect(result).not.toContain('<object');
    });

    it('should strip <embed>', () => {
      const result = sanitizeHtml('<embed src="evil.swf">');
      expect(result).not.toContain('<embed');
    });
  });

  describe('event handler attributes are removed', () => {
    it('should remove onclick', () => {
      const result = sanitizeHtml('<p onclick="alert(1)">Hello</p>');
      expect(result).not.toContain('onclick');
      expect(result).toContain('Hello');
    });

    it('should remove onerror from img tags', () => {
      const result = sanitizeHtml('<img src="x" onerror="alert(1)">');
      expect(result).not.toContain('onerror');
    });

    it('should remove onload', () => {
      const result = sanitizeHtml(
        '<body onload="stealCookies()">content</body>'
      );
      expect(result).not.toContain('onload');
    });

    it('should remove onmouseover', () => {
      const result = sanitizeHtml('<a href="#" onmouseover="evil()">Link</a>');
      expect(result).not.toContain('onmouseover');
    });
  });

  describe('javascript: URI schemes are blocked', () => {
    it('should strip javascript: href', () => {
      const result = sanitizeHtml('<a href="javascript:alert(1)">Click me</a>');
      expect(result).not.toContain('javascript:');
    });

    it('should strip javascript: in img src', () => {
      const result = sanitizeHtml('<img src="javascript:evil()">');
      expect(result).not.toContain('javascript:');
    });

    it('should strip data: URI in href', () => {
      const result = sanitizeHtml(
        '<a href="data:text/html,<script>alert(1)</script>">link</a>'
      );
      expect(result).not.toContain('data:');
    });
  });

  // ----------------------------------------------------------------
  // Safe content passes through
  // ----------------------------------------------------------------

  describe('safe HTML tags and attributes are preserved', () => {
    it('should preserve <p> tags', () => {
      const result = sanitizeHtml('<p>Hello world</p>');
      expect(result).toContain('<p>Hello world</p>');
    });

    it('should preserve heading tags', () => {
      const result = sanitizeHtml('<h1>Title</h1><h2>Subtitle</h2>');
      expect(result).toContain('<h1>Title</h1>');
      expect(result).toContain('<h2>Subtitle</h2>');
    });

    it('should preserve <strong> and <em>', () => {
      const result = sanitizeHtml('<strong>Bold</strong> and <em>italic</em>');
      expect(result).toContain('<strong>Bold</strong>');
      expect(result).toContain('<em>italic</em>');
    });

    it('should preserve <ul> and <li>', () => {
      const result = sanitizeHtml('<ul><li>Item 1</li><li>Item 2</li></ul>');
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>Item 1</li>');
    });

    it('should preserve <a> with href and title', () => {
      const result = sanitizeHtml(
        '<a href="https://example.com" title="Example">Link</a>'
      );
      expect(result).toContain('href="https://example.com"');
      expect(result).toContain('Link');
    });

    it('should preserve <img> with src and alt', () => {
      const result = sanitizeHtml(
        '<img src="https://example.com/img.png" alt="Image">'
      );
      expect(result).toContain('src="https://example.com/img.png"');
      expect(result).toContain('alt="Image"');
    });

    it('should preserve <blockquote>', () => {
      const result = sanitizeHtml('<blockquote>Quote text</blockquote>');
      expect(result).toContain('<blockquote>');
    });

    it('should preserve <code> and <pre>', () => {
      const result = sanitizeHtml('<pre><code>const x = 1;</code></pre>');
      expect(result).toContain('<code>');
      expect(result).toContain('const x = 1;');
    });

    it('should preserve table elements', () => {
      const result = sanitizeHtml(
        '<table><thead><tr><th>Name</th></tr></thead><tbody><tr><td>Alice</td></tr></tbody></table>'
      );
      expect(result).toContain('<table>');
      expect(result).toContain('<th>Name</th>');
      expect(result).toContain('<td>Alice</td>');
    });
  });

  // ----------------------------------------------------------------
  // SQL injection patterns are treated as plain text
  // ----------------------------------------------------------------

  describe('SQL injection patterns are handled safely', () => {
    it('should strip SQL injection in a <script> context', () => {
      // SQL in a script tag — the script is stripped
      const result = sanitizeHtml(
        "<script>'; DROP TABLE users; --</script>Safe text"
      );
      expect(result).not.toContain('<script>');
      expect(result).toContain('Safe text');
    });

    it('should preserve SQL text if in plain text (not executable)', () => {
      // SQL as visible text inside a <p> tag is safe — it is rendered as text, not executed
      const result = sanitizeHtml('<p>SELECT * FROM users WHERE id = 1</p>');
      expect(result).toContain('SELECT * FROM users');
    });

    it('should handle UNION-based SQL in text', () => {
      const result = sanitizeHtml(
        '<p>Query: 1 UNION SELECT * FROM passwords</p>'
      );
      expect(result).toContain('UNION SELECT');
    });
  });

  // ----------------------------------------------------------------
  // Normal content passes through unchanged
  // ----------------------------------------------------------------

  describe('normal content passes through unchanged', () => {
    it('should not alter plain text with no HTML', () => {
      const text = 'This is a simple sentence with no HTML.';
      const result = sanitizeHtml(text);
      expect(result).toBe(text);
    });

    it('should not alter safe formatted blog content', () => {
      const blogContent =
        '<h2>My Post</h2><p>Content here with <strong>bold</strong> and <em>italic</em>.</p>';
      const result = sanitizeHtml(blogContent);
      expect(result).toContain('<h2>My Post</h2>');
      expect(result).toContain('<strong>bold</strong>');
    });

    it('should preserve href with https protocol', () => {
      const result = sanitizeHtml(
        '<a href="https://synthex.social">Synthex</a>'
      );
      expect(result).toContain('href="https://synthex.social"');
    });

    it('should preserve href with mailto protocol', () => {
      const result = sanitizeHtml(
        '<a href="mailto:hello@example.com">Email us</a>'
      );
      expect(result).toContain('href="mailto:hello@example.com"');
    });
  });

  // ----------------------------------------------------------------
  // Edge cases
  // ----------------------------------------------------------------

  describe('edge cases', () => {
    it('should return empty string for empty input', () => {
      const result = sanitizeHtml('');
      expect(result).toBe('');
    });

    it('should handle whitespace-only input', () => {
      const result = sanitizeHtml('   ');
      // DOMPurify may return trimmed or the same whitespace — just should not throw
      expect(typeof result).toBe('string');
    });

    it('should handle a string with only tags and no text', () => {
      const result = sanitizeHtml('<p></p>');
      expect(typeof result).toBe('string');
    });

    it('should handle deeply nested safe HTML', () => {
      const nested = '<div><p><strong><em>Deep nesting</em></strong></p></div>';
      const result = sanitizeHtml(nested);
      expect(result).toContain('Deep nesting');
    });

    it('should handle mixed safe and unsafe tags', () => {
      const mixed = '<p>Safe</p><script>evil()</script><p>Also safe</p>';
      const result = sanitizeHtml(mixed);
      expect(result).not.toContain('<script>');
      expect(result).toContain('Safe');
      expect(result).toContain('Also safe');
    });

    it('should handle very long content without throwing', () => {
      const longContent = '<p>' + 'word '.repeat(5000) + '</p>';
      expect(() => sanitizeHtml(longContent)).not.toThrow();
    });

    it('should handle HTML entities in text', () => {
      const result = sanitizeHtml('<p>&lt;not a tag&gt;</p>');
      expect(typeof result).toBe('string');
      expect(result).not.toContain('<not a tag>');
    });
  });
});

// ============================================================================
// sanitizeInlineHtml
// ============================================================================

describe('sanitizeInlineHtml()', () => {
  describe('only allows inline formatting tags', () => {
    it('should preserve <strong>', () => {
      const result = sanitizeInlineHtml('<strong>Bold</strong>');
      expect(result).toContain('<strong>Bold</strong>');
    });

    it('should preserve <em>', () => {
      const result = sanitizeInlineHtml('<em>Italic</em>');
      expect(result).toContain('<em>Italic</em>');
    });

    it('should preserve <code>', () => {
      const result = sanitizeInlineHtml('<code>const x = 1</code>');
      expect(result).toContain('<code>');
    });

    it('should preserve <br>', () => {
      const result = sanitizeInlineHtml('Line 1<br>Line 2');
      expect(result).toContain('<br>');
    });
  });

  describe('strips block-level and dangerous tags', () => {
    it('should strip <p> tags (block-level not allowed)', () => {
      const result = sanitizeInlineHtml('<p>Paragraph</p>');
      expect(result).not.toContain('<p>');
      expect(result).toContain('Paragraph');
    });

    it('should strip <div>', () => {
      const result = sanitizeInlineHtml('<div>Content</div>');
      expect(result).not.toContain('<div>');
    });

    it('should strip <script>', () => {
      const result = sanitizeInlineHtml('<script>alert(1)</script>text');
      expect(result).not.toContain('<script>');
    });

    it('should strip <a> (not in inline allowlist)', () => {
      const result = sanitizeInlineHtml('<a href="https://evil.com">Click</a>');
      expect(result).not.toContain('<a');
      expect(result).toContain('Click');
    });
  });

  describe('strips all attributes', () => {
    it('should strip class attribute from allowed tags', () => {
      const result = sanitizeInlineHtml(
        '<strong class="highlight">Bold</strong>'
      );
      expect(result).not.toContain('class=');
      expect(result).toContain('Bold');
    });

    it('should strip id attribute', () => {
      const result = sanitizeInlineHtml('<em id="myid">Italic</em>');
      expect(result).not.toContain('id=');
      expect(result).toContain('Italic');
    });
  });

  describe('edge cases', () => {
    it('should return empty string for empty input', () => {
      const result = sanitizeInlineHtml('');
      expect(result).toBe('');
    });

    it('should return plain text unchanged', () => {
      const result = sanitizeInlineHtml('Just plain text');
      expect(result).toBe('Just plain text');
    });
  });
});
