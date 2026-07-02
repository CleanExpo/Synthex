/**
 * Bing Places Bulk Upload XML wire format (SYN-845).
 *
 * Bing Places service-area updates flow through the Bulk Upload XML format, not
 * a JSON partial-update endpoint. This module is the pure (de)serialisation
 * layer the api-client uses; the diff / idempotency / distance logic upstream is
 * unchanged — only the wire format is swapped.
 *
 * Dependency-free by design (no XML package added): the schema is small and
 * fixed, so a hand-rolled serialiser with strict escaping is safer than pulling
 * a parser into the bundle.
 *
 * @see SYN-845 (parent: SYN-834 epic) · lib/bing-places/README.md
 */
import type { BingLocality } from './types';

export const BULK_UPLOAD_NS =
  'http://schemas.microsoft.com/bingplaces/bulkupload/v1';

/** Escape the five XML predefined entities. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Serialise a store's full service-area locality set into a Bing Places Bulk
 * Upload XML document. The caller supplies the already-computed union (current
 * + additions) — this is a raw write, mirroring `putServiceArea`.
 */
export function serializeBulkUploadXml(
  storeId: string,
  localities: BingLocality[],
): string {
  const areas = localities
    .map((l) => {
      const postal = l.postcode
        ? `\n        <PostalCode>${escapeXml(l.postcode)}</PostalCode>`
        : '';
      return (
        `      <ServiceArea>\n` +
        `        <Locality>${escapeXml(l.name)}</Locality>${postal}\n` +
        `      </ServiceArea>`
      );
    })
    .join('\n');

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<BulkUpload xmlns="${BULK_UPLOAD_NS}">\n` +
    `  <Store>\n` +
    `    <StoreId>${escapeXml(storeId)}</StoreId>\n` +
    `    <ServiceAreas>\n` +
    (areas ? `${areas}\n` : '') +
    `    </ServiceAreas>\n` +
    `  </Store>\n` +
    `</BulkUpload>\n`
  );
}

/** Terminal + in-flight states a bulk-upload job can report. */
export type BulkUploadJobStatus = 'Pending' | 'Completed' | 'Failed';

/** Extract a single tag's text content (first match, namespace-agnostic). */
function extractTag(xml: string, tag: string): string | null {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(xml);
  return m ? m[1].trim() : null;
}

/** Read the JobId Bing returns from a bulk-upload submission. */
export function parseBulkUploadJobId(responseXml: string): string | null {
  return extractTag(responseXml, 'JobId');
}

/**
 * Normalise the Status from a job-status poll response. Anything that is not a
 * recognised terminal/known state is treated as `Pending` (keep polling) rather
 * than guessed — except an explicit failure, which surfaces as `Failed`.
 */
export function parseBulkUploadJobStatus(statusXml: string): BulkUploadJobStatus {
  const raw = (extractTag(statusXml, 'Status') ?? '').toLowerCase();
  if (raw === 'completed' || raw === 'success' || raw === 'succeeded') {
    return 'Completed';
  }
  if (raw === 'failed' || raw === 'error') {
    return 'Failed';
  }
  return 'Pending';
}
