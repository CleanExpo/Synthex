/**
 * Unit tests — Vault DOCX upload content verification — SYN-701
 *
 * Covers the ZIP magic-byte check that gates the mammoth parser. Before the
 * fix, the endpoint trusted `blob.type` and `blob.name` (both client-
 * controlled). Now it inspects the first 4 bytes of the actual upload.
 */

import { hasZipMagic } from '@/lib/vault/zip-magic';

describe('SYN-701 — OOXML/ZIP magic-byte verification', () => {
  it('accepts a standard ZIP local-file header (PK\\x03\\x04)', () => {
    expect(hasZipMagic(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]))).toBe(true);
  });

  it('accepts an empty-archive end-of-central-directory record (PK\\x05\\x06)', () => {
    expect(hasZipMagic(Buffer.from([0x50, 0x4b, 0x05, 0x06, 0, 0]))).toBe(true);
  });

  it('accepts a spanned-archive header (PK\\x07\\x08)', () => {
    expect(hasZipMagic(Buffer.from([0x50, 0x4b, 0x07, 0x08, 0, 0]))).toBe(true);
  });

  it('rejects a plain text file', () => {
    expect(hasZipMagic(Buffer.from('Hello from a plain text file'))).toBe(
      false
    );
  });

  it('rejects a PDF (begins with %PDF)', () => {
    expect(hasZipMagic(Buffer.from([0x25, 0x50, 0x44, 0x46]))).toBe(false);
  });

  it('rejects a PNG image', () => {
    expect(hasZipMagic(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
  });

  it('rejects a JPEG', () => {
    expect(hasZipMagic(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(false);
  });

  it('rejects a buffer shorter than 4 bytes', () => {
    expect(hasZipMagic(Buffer.from([0x50, 0x4b]))).toBe(false);
    expect(hasZipMagic(Buffer.from([]))).toBe(false);
  });

  it('rejects bytes that look like PK but wrong signature', () => {
    // PK followed by wrong second-pair bytes (common in truncated or
    // corrupted files) must be rejected.
    expect(hasZipMagic(Buffer.from([0x50, 0x4b, 0x00, 0x00]))).toBe(false);
    expect(hasZipMagic(Buffer.from([0x50, 0x4b, 0xff, 0xff]))).toBe(false);
  });
});
