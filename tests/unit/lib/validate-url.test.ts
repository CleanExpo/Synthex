/**
 * Unit tests for lib/security/validate-url.ts
 *
 * validateExternalUrl is a pure SSRF-prevention utility — no external deps,
 * no mocks required.
 */

jest.mock('node:dns/promises', () => ({ lookup: jest.fn() }));

import { lookup } from 'node:dns/promises';
import {
  validateExternalUrl,
  assertExternalUrlSafe,
} from '@/lib/security/validate-url';

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

  // ── SYN-995: IPv4-mapped IPv6 SSRF bypass ────────────────────────────────
  describe('IPv4-mapped IPv6 (SYN-995 P0)', () => {
    it('blocks cloud metadata via mapped IPv6 [::ffff:169.254.169.254]', () => {
      expect(() =>
        validateExternalUrl('http://[::ffff:169.254.169.254]/latest/meta-data')
      ).toThrow('URL resolves to a blocked address');
    });

    it('blocks the runtime-compressed mapped form [::ffff:a9fe:a9fe]', () => {
      expect(() =>
        validateExternalUrl('http://[::ffff:a9fe:a9fe]/')
      ).toThrow('URL resolves to a blocked address');
    });

    it('blocks mapped IPv6 loopback [::ffff:127.0.0.1]', () => {
      expect(() =>
        validateExternalUrl('http://[::ffff:127.0.0.1]/')
      ).toThrow('URL resolves to a blocked address');
    });

    it('allows a genuine global IPv6 literal', () => {
      expect(() =>
        validateExternalUrl('http://[2606:4700:4700::1111]/')
      ).not.toThrow();
    });
  });

  // ── SYN-995: DNS-resolving guard for public fetch paths ──────────────────
  describe('assertExternalUrlSafe (DNS resolution)', () => {
    const mockLookup = lookup as jest.MockedFunction<typeof lookup>;
    beforeEach(() => mockLookup.mockReset());

    it('allows a hostname that resolves to a public IP', async () => {
      mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
      await expect(
        assertExternalUrlSafe('https://example.com')
      ).resolves.toBeUndefined();
    });

    it('blocks a hostname whose A record points at cloud metadata (DNS rebind)', async () => {
      mockLookup.mockResolvedValue([{ address: '169.254.169.254', family: 4 }]);
      await expect(
        assertExternalUrlSafe('https://rebind.evil.test')
      ).rejects.toThrow('URL resolves to a blocked address');
    });

    it('blocks a hostname resolving to a private IP', async () => {
      mockLookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);
      await expect(
        assertExternalUrlSafe('https://internal.evil.test')
      ).rejects.toThrow('URL resolves to a blocked address');
    });

    it('fails closed when DNS resolution fails', async () => {
      mockLookup.mockRejectedValue(new Error('ENOTFOUND'));
      await expect(
        assertExternalUrlSafe('https://nope.evil.test')
      ).rejects.toThrow('URL resolves to a blocked address');
    });

    it('rejects a mapped-IPv6 literal without calling DNS', async () => {
      await expect(
        assertExternalUrlSafe('http://[::ffff:169.254.169.254]/latest/meta-data')
      ).rejects.toThrow('URL resolves to a blocked address');
      expect(mockLookup).not.toHaveBeenCalled();
    });
  });
});
