# `lib/indexnow/` — IndexNow submission for client sites (kit K1)

Tells IndexNow-participating search engines (Bing and others) that client-site URLs changed. Replaces the retired Bing sitemap ping for page-level discovery. Client metric: `both` (CARSI enrolments, RestoreAssist trial sign-ups), through faster discovery of new pages.

Protocol: https://www.indexnow.org/documentation (read 22/10/2026).

## Files

| File            | Purpose                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------- |
| `key.ts`        | `deriveIndexNowKey`, `buildIndexNowKeyFileArtefact`: deterministic key and the key file to host |
| `client.ts`     | `classifyIndexNowStatus`, `buildIndexNowRequests` (10,000 per POST), `submitToIndexNow`         |
| `on-publish.ts` | `notifyIndexNowOnPublish`: the ping-on-publish hook for pages that went live on a client site   |

## Rules

1. **Only HTTP 200 is success.** 202 = received, key validation pending; 400 = bad format; 403 = key not verified; 422 = URLs not on the host; 429 = retry later; anything else = unexpected. None of these is reported as success.
2. **At most 10,000 URLs per POST.** Larger lists are chunked; one result per chunk.
3. **Off-host or malformed URLs are not sent.** They come back in `rejectedOffHost`, and the submission is then not `ok`.
4. **Never throws.** Network errors become a `network-error` batch result.

## Key file artefact (for the K7 repo-writer)

IndexNow keys are public by design: ownership is proven by the site serving `https://<host>/<key>.txt` whose body is the key. The key is derived from the client manifest's `slug` and primary domain (`sha256("synthex-indexnow-v1:<slug>:<host>")`, first 32 hex characters), so nothing is stored and nothing is secret.

Synthex cannot serve that file for carsi.com.au or restoreassist.app. `buildIndexNowKeyFileArtefact({ clientSlug, siteUrl })` returns `{ path: "/<key>.txt", content: "<key>", keyLocation }`; the K7 repo-writer places it in the client repo's public root (for a Next.js site, `public/<key>.txt`) through the client repo's own PR and human merge. Until the file is live, IndexNow answers 403 or 202, which this module reports as not verified or pending.

## Seam: ping on publish

Call `notifyIndexNowOnPublish({ clientSlug, siteUrl, publishedUrls })` after pages are live on the client site. No client-site publish event exists in Synthex yet; the intended caller is the K7 step that runs after the client repo's merge has deployed. Social posts are not client-site pages and must not call it.

The NRPG → disasterrecovery.com.au pipeline (`lib/nrpg-pipeline` Stage 6) is the nearest existing analogue. It is not wired: that site is not a K1 client and hosts no key file.
