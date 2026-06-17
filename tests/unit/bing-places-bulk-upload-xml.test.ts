/**
 * Unit tests for the Bing Places Bulk Upload XML wire format (SYN-845).
 *
 * Covers the pure (de)serialisation the api-client relies on: a well-formed
 * Bulk Upload document, strict XML escaping, and tolerant job-status parsing.
 */
import {
  serializeBulkUploadXml,
  escapeXml,
  parseBulkUploadJobId,
  parseBulkUploadJobStatus,
  BULK_UPLOAD_NS,
} from '@/lib/bing-places/bulk-upload-xml';

describe('serializeBulkUploadXml', () => {
  it('emits one ServiceArea per locality with the StoreId and namespace', () => {
    const xml = serializeBulkUploadXml('store-1', [
      { name: 'Brisbane', postcode: '4000' },
      { name: 'Ipswich' },
    ]);
    expect(xml).toContain(`<BulkUpload xmlns="${BULK_UPLOAD_NS}">`);
    expect(xml).toContain('<StoreId>store-1</StoreId>');
    expect(xml).toContain('<Locality>Brisbane</Locality>');
    expect(xml).toContain('<PostalCode>4000</PostalCode>');
    expect(xml).toContain('<Locality>Ipswich</Locality>');
    // Ipswich has no postcode → no PostalCode element for it.
    expect((xml.match(/<PostalCode>/g) ?? []).length).toBe(1);
    expect((xml.match(/<ServiceArea>/g) ?? []).length).toBe(2);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it('escapes XML-significant characters in locality names', () => {
    const xml = serializeBulkUploadXml('s&1', [{ name: 'A & B <Co>' }]);
    expect(xml).toContain('<StoreId>s&amp;1</StoreId>');
    expect(xml).toContain('<Locality>A &amp; B &lt;Co&gt;</Locality>');
    expect(xml).not.toMatch(/<Locality>A & B/);
  });

  it('produces a valid empty ServiceAreas block for no localities', () => {
    const xml = serializeBulkUploadXml('store-1', []);
    expect(xml).toContain('<ServiceAreas>');
    expect(xml).toContain('</ServiceAreas>');
    expect(xml).not.toContain('<ServiceArea>');
  });
});

describe('escapeXml', () => {
  it('escapes all five predefined entities', () => {
    expect(escapeXml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&apos;');
  });
});

describe('parseBulkUploadJobId', () => {
  it('extracts the JobId', () => {
    expect(parseBulkUploadJobId('<r><JobId>abc-123</JobId></r>')).toBe('abc-123');
  });
  it('returns null when absent', () => {
    expect(parseBulkUploadJobId('<r></r>')).toBeNull();
  });
});

describe('parseBulkUploadJobStatus', () => {
  it('maps success-like states to Completed', () => {
    for (const s of ['Completed', 'success', 'Succeeded']) {
      expect(parseBulkUploadJobStatus(`<r><Status>${s}</Status></r>`)).toBe('Completed');
    }
  });
  it('maps failure states to Failed', () => {
    expect(parseBulkUploadJobStatus('<r><Status>Failed</Status></r>')).toBe('Failed');
    expect(parseBulkUploadJobStatus('<r><Status>error</Status></r>')).toBe('Failed');
  });
  it('treats unknown / in-flight / missing status as Pending (keep polling)', () => {
    expect(parseBulkUploadJobStatus('<r><Status>Processing</Status></r>')).toBe('Pending');
    expect(parseBulkUploadJobStatus('<r></r>')).toBe('Pending');
  });
});
