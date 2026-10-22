# `lib/bing-webmaster/` — Bing Webmaster Tools API client (kit K1)

Adds and verifies client sites in Bing Webmaster Tools, submits sitemaps (`SubmitFeed`, the replacement for the retired anonymous Bing ping) and submits URLs within the account's quota. Not `lib/bing-places` (Bing Places for Business listings).

## API

JSON protocol, API-key auth, from the Microsoft Learn JSON samples (read 22/10/2026):

- `https://ssl.bing.com/webmaster/api.svc/json/<Method>?apikey=<key>`; POST methods take a JSON body, GET methods take query parameters.
- Success: `{"d": ...}`. Failure: HTTP 400 `{"ErrorCode": n, "Message": "..."}`.
- Access: https://learn.microsoft.com/en-us/bingwebmaster/getting-access
- Methods: https://learn.microsoft.com/en-us/dotnet/api/microsoft.bing.webmaster.api.interfaces.iwebmasterapi

| Client method           | API method              | Verb |
| ----------------------- | ----------------------- | ---- |
| `addSite`               | `AddSite`               | POST |
| `getUserSites`          | `GetUserSites`          | GET  |
| `verifySite`            | `VerifySite`            | POST |
| `submitFeed`            | `SubmitFeed`            | POST |
| `submitUrlBatch`        | `SubmitUrlBatch`        | POST |
| `getUrlSubmissionQuota` | `GetUrlSubmissionQuota` | GET  |

`submitUrlsWithinQuota(client, siteUrl, urls)` reads the quota, sends at most `min(daily, monthly)` URLs in batches of at most 500, stops at the first failed batch and returns what it `submitted` and `deferred`.

## Rules

1. **Key from `BING_WEBMASTER_API_KEY`** (or the `apiKey` option). Missing key = `not-configured`, no request sent.
2. **The key is never logged or returned.** It travels in the query string, so request URLs are not logged and error text is redacted.
3. **Honest results.** A 400 error body is `api-error` with Bing's `ErrorCode`/`Message`; a 200 without the `d` wrapper is `bad-response`; `VerifySite` returning `false` is `{ verified: false }`.

## Not yet observed

No live call has been made. The method-name casing for `SubmitUrlBatch` follows the method name; one Microsoft sample writes `SubmitUrlbatch`. Unproven until the first real call with a key.
