# `lib/dr-repo-writer/` — Cross-Repo Committer for `disasterrecovery.com.au`

The bridge between the SYN-834 NRPG → DR pipeline and the live DR site repo. Used by `lib/nrpg-pipeline` as the `saveLandingPage`, `saveSitemapXml`, and `loadCurrentSitemapXml` callbacks.

**Linear:** SYN-834 epic — Track 2 ship-now
**Owners:** `marketing-operations-director` + `code-architect`

---

## Files

| File               | Purpose                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------- |
| `github-client.ts` | Plain-fetch GitHub Contents-API client (DI-friendly, no @octokit dep)                    |
| `page-renderer.ts` | `BuildLandingPageResult` → Next.js `page.tsx` source string                              |
| `writer.ts`        | `saveLandingPageToDrRepo` · `saveSitemapXmlToDrRepo` · `loadCurrentSitemapXmlFromDrRepo` |
| `index.ts`         | Public re-exports                                                                        |

## Hard rules (binding behaviour)

1. **Single repo, single branch.** Default coords are `CleanExpo/disasterrecovery.com.au` on `main`. Override via `opts.coords` for staging forks.
2. **Idempotent.** Each writer reads the current file first; identical content → skip the commit (returns `{ ok: true, unchanged: true }`).
3. **PUT-with-SHA on update, PUT-without on create.** Mirrors GitHub's Contents API contract. 404 on the GET means "create".
4. **No @octokit dependency.** Plain `fetch`, consistent with `lib/gbp` and `lib/bing-places`.
5. **Auth via `DR_REPO_GITHUB_TOKEN`.** Should be a fine-grained PAT with **Contents: Write** on `disasterrecovery.com.au` only — NOT a personal token.

## Direct-to-`main` vs PR-per-page

This module writes directly to `main`. For a single-tenant DR site with the `lib/landing-page` validators as the gate (Aid Rule, category-claim, schema-vs-content match, PII leak — 27 tests), direct-to-main is acceptable. If you want PR-per-page review later:

- swap the `putFile` calls in `writer.ts` for the Git-Data API branch + PR flow
- `lib/nrpg-pipeline` does NOT change — same callback shape, same idempotency contract

## Env config

| Var                    | Default | Notes                                                            |
| ---------------------- | ------- | ---------------------------------------------------------------- |
| `DR_REPO_GITHUB_TOKEN` | —       | Fine-grained PAT, Contents:Write on disasterrecovery.com.au only |

In tests, inject `opts.client` to skip fetch entirely.

## What this layer does NOT do

- It does NOT subscribe to events — `app/lib/nrpg-pipeline-bootstrap.ts` does that
- It does NOT validate the page content — `lib/landing-page` does that, the validators run before this writer is ever called
- It does NOT touch any other repo — caller controls the coords (DR by default)
