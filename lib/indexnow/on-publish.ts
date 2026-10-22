/**
 * Ping-on-publish hook for IndexNow.
 *
 * Seam: call this after a page or post is live on the CLIENT's own site
 * (carsi.com.au, restoreassist.app), with the URLs that went live. No such
 * client-site publish event exists in Synthex yet: client sites are changed
 * by the K7 repo-writer opening a PR on the client repo, and the host builds
 * `main` after a human merge. The K7 post-deploy step is the intended caller.
 * Social posts are not client-site pages and must not call this.
 *
 * The nearest existing analogue is the NRPG -> disasterrecovery.com.au
 * pipeline (lib/nrpg-pipeline Stage 6). It is not wired here: that site is
 * not a K1 client and hosts no IndexNow key file.
 */
import { submitToIndexNow, type IndexNowSubmission } from './client';
import { buildIndexNowKeyFileArtefact } from './key';

export interface ClientSitePublishEvent {
  clientSlug: string;
  /** The client's primary site URL (manifest primary domain). */
  siteUrl: string;
  /** Absolute URLs that are now live on the client site. */
  publishedUrls: readonly string[];
}

export async function notifyIndexNowOnPublish(
  event: ClientSitePublishEvent,
  opts: { fetchImpl?: typeof fetch; endpoint?: string } = {}
): Promise<IndexNowSubmission> {
  const art = buildIndexNowKeyFileArtefact(event);
  if (event.publishedUrls.length === 0) {
    return {
      ok: false,
      host: art.host,
      requested: 0,
      rejectedOffHost: [],
      batches: [],
      reason: 'no published URLs; nothing sent',
    };
  }
  return submitToIndexNow(
    {
      host: art.host,
      key: art.key,
      keyLocation: art.keyLocation,
      urls: event.publishedUrls,
    },
    opts
  );
}
