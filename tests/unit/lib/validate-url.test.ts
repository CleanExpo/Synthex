/**
 * Unit tests for lib/security/validate-url.ts
 *
 * validateExternalUrl is a pure SSRF-prevention utility — no external deps,
 * no mocks required.
 */

import { validateExternalUrl } from '@/lib/security/validate-url';

describe('validateExternalUrl', () => {
  // ── Happy paths ─────────────────────────────────────────────────────────
  describe('valid external URLs', () => {
    it('allows a plain https URL', () => {
      expect(() => validateExternalUrl('https://example.com')).not.toThrow();
    });

    it('allows an http URL', () => {
      expect(() =>
        validateExternalUrl('http://example.com/path')
      ).not.toThrow();
    });

    it('allows a URL with a path and query string', () => {
      expect(() =>
        validateExternalUrl('https://api.example.com/v1/data?foo=bar')
      ).not.toThrow();
    });

    it('allows a synthex.social URL', () => {
      expect(() =>
        validateExternalUrl('https://synthex.social/webhook')
      ).not.toThrow();
    });

    it('allows a URL with a port that is not private', () => {
      expect(() =>
        validateExternalUrl('https://example.com:8443/path')
      ).not.toThrow();
    });
  });

  // ── Invalid URL format ───────────────────────────────────────────────────
  describe('invalid URL format', () => {
    it('throws on a completely invalid URL string', () => {
      expect(() => validateExternalUrl('not-a-url')).toThrow('Invalid URL');
    });

    it('throws on an empty string', () => {
      expect(() => validateExternalUrl('')).toThrow('Invalid URL');
    });

    it('throws on just a path', () => {
      expect(() => validateExternalUrl('/api/endpoint')).toThrow('Invalid URL');
    });
  });

  // ── Protocol checks ──────────────────────────────────────────────────────
  describe('disallowed protocols', () => {
    it('throws on file:// URLs', () => {
      expect(() => validateExternalUrl('file:///etc/passwd')).toThrow(
        'URL must use http or https protocol'
      );
    });

    it('throws on ftp:// URLs', () => {
      expect(() => validateExternalUrl('ftp://ftp.example.com/file')).toThrow(
        'URL must use http or https protocol'
      );
    });

    it('throws on javascript: URLs', () => {
      // javascript: is not http/https
      expect(() => validateExternalUrl('javascript:alert(1)')).toThrow();
    });
  });

  // ── Blocked private/loopback addresses ───────────────────────────────────
  describe('blocked private addresses', () => {
    it('blocks localhost', () => {
      expect(() => validateExternalUrl('http://localhost/admin')).toThrow(
        'URL resolves to a blocked address'
      );
    });

    it('blocks localhost with port', () => {
      expect(() => validateExternalUrl('http://localhost:3000')).toThrow(
        'URL resolves to a blocked address'
      );
    });

    it('blocks 127.0.0.1', () => {
      expect(() => validateExternalUrl('http://127.0.0.1/secret')).toThrow(
        'URL resolves to a blocked address'
      );
    });

    it('blocks 0.0.0.0', () => {
      expect(() => validateExternalUrl('http://0.0.0.0/secret')).toThrow(
        'URL resolves to a blocked address'
      );
    });

    it('blocks 10.x.x.x (private class A)', () => {
      expect(() => validateExternalUrl('http://10.0.0.1/api')).toThrow(
        'URL resolves to a blocked address'
      );
    });

    it('blocks 192.168.x.x (private class C)', () => {
      expect(() => validateExternalUrl('http://192.168.1.1/')).toThrow(
        'URL resolves to a blocked address'
      );
    });

    it('blocks 172.16.x.x (private class B lower bound)', () => {
      expect(() => validateExternalUrl('http://172.16.0.1/')).toThrow(
        'URL resolves to a blocked address'
      );
    });

    it('blocks 172.31.x.x (private class B upper bound)', () => {
      expect(() => validateExternalUrl('http://172.31.255.255/')).toThrow(
        'URL resolves to a blocked address'
      );
    });

    it('does NOT block 172.32.x.x (outside private class B range)', () => {
      expect(() =>
        validateExternalUrl('https://172.32.0.1/data')
      ).not.toThrow();
    });

    it('blocks 169.254.x.x (cloud metadata / link-local)', () => {
      expect(() =>
        validateExternalUrl('http://169.254.169.254/latest/meta-data/')
      ).toThrow('URL resolves to a blocked address');
    });

    it('blocks IPv6 loopback ::1 via bracket form from URL.hostname', () => {
      expect(() => validateExternalUrl('http://[::1]/admin')).toThrow(
        'URL resolves to a blocked address'
      );
    });
  });
});
