/**
 * IndexNow key derivation and the key-file artefact the client site hosts.
 *
 * IndexNow keys are public by design: the protocol proves ownership by the
 * site serving `https://<host>/<key>.txt` containing the key
 * (https://www.indexnow.org/documentation). So the key is not a secret and
 * is derived deterministically from the client manifest's slug and primary
 * site URL; the same inputs always give the same key, with nothing stored.
 *
 * Synthex cannot serve that file for a client's domain (carsi.com.au,
 * restoreassist.app). The artefact below is what the K7 repo-writer places
 * in the client repo's public root, so the client site serves it.
 */
import { createHash } from 'crypto';

/** Bump to rotate every client's key at once. */
export const INDEXNOW_KEY_NAMESPACE = 'synthex-indexnow-v1';

/** Protocol: 8 to 128 characters of a-z, A-Z, 0-9 and dash. */
const KEY_PATTERN = /^[a-zA-Z0-9-]{8,128}$/;

export interface IndexNowKeyInput {
  /** Client manifest slug, e.g. `carsi`. */
  clientSlug: string;
  /** Client manifest primary domain, e.g. `https://carsi.com.au`. */
  siteUrl: string;
}

export interface IndexNowKeyFileArtefact {
  clientSlug: string;
  /** Bare host the key file is served on, e.g. `carsi.com.au`. */
  host: string;
  key: string;
  /** Path at the site root, `/<key>.txt`. */
  path: string;
  /** Exact file body (UTF-8): the key itself. */
  content: string;
  /** Public URL of the key file, sent as `keyLocation`. */
  keyLocation: string;
  /** Who writes the file into the client repo. */
  placedBy: 'K7 repo-writer';
  note: string;
}

export function isValidIndexNowKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

/** Lower-cased host of a site URL; throws on a malformed URL. */
export function hostOf(siteUrl: string): string {
  return new URL(siteUrl).host.toLowerCase();
}

/** Deterministic 32-hex-character key for a client's primary site. */
export function deriveIndexNowKey(input: IndexNowKeyInput): string {
  const slug = input.clientSlug.trim().toLowerCase();
  if (!slug) throw new Error('clientSlug required');
  const host = hostOf(input.siteUrl);
  return createHash('sha256')
    .update(`${INDEXNOW_KEY_NAMESPACE}:${slug}:${host}`)
    .digest('hex')
    .slice(0, 32);
}

/** The key file the client site must serve at `https://<host>/<key>.txt`. */
export function buildIndexNowKeyFileArtefact(
  input: IndexNowKeyInput
): IndexNowKeyFileArtefact {
  const key = deriveIndexNowKey(input);
  const host = hostOf(input.siteUrl);
  return {
    clientSlug: input.clientSlug,
    host,
    key,
    path: `/${key}.txt`,
    content: key,
    keyLocation: `https://${host}/${key}.txt`,
    placedBy: 'K7 repo-writer',
    note:
      'Place in the client repo public root so the site serves it at the ' +
      'root of every host it answers (apex and www). Until it is served, ' +
      'IndexNow answers 403 (key not verified) or 202 (validation pending).',
  };
}
