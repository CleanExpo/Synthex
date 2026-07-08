# CARSI H5 Launch — Publishing Handoff

## Honest channel status

| Channel | Status | Blocker |
| --- | --- | --- |
| CARSI LinkedIn | **Blocked** | `oauth_connection_missing` — CARSI LinkedIn is not connected. |
| Facebook (Meta) | **Blocked** | Meta-console owner tasks pending (App Domains, Business Verification, publishing permissions). |
| Instagram (Meta) | **Blocked** | Same Meta-console tasks as Facebook. |
| Blog (owned) | **Ready** | None — publish after final human review. |
| Email (owned) | **Ready** | None — publish after final human review. |

No post in this pack is live. Per Synthex policy, nothing is marked "live" without a
platform receipt (API response / URL). The acceptance signal is the publish
response, not any readiness audit.

Re-run the readiness audit any time:

```bash
npx tsx scripts/social-launch-readiness.ts --stdout
```

## Two content-side gates before any external post

1. **Course URL live.** At the 2026-07-08 check the course page returned "Course
   Not Found". Confirm https://carsi.com.au/courses/avian-influenza-awareness-restoration-iaq-facilities
   returns HTTP 200 with real content before publishing any post that claims the
   course is live or links to it.
2. **Video overview.** LI-12 is held (`mediaPending: narrated-video-overview`). Do
   not schedule it until the Cloudinary video URL is confirmed HTTP 200; then add
   the URL to `mediaUrls` in `scheduler-payloads.json` and clear the `hold`.

## Founder steps — connect LinkedIn (CARSI company page)

Full detail in `docs/marketing-agency/carsi-linkedin-go-live.md`. Summary:

1. **Gate 1 — connect as admin.** Confirm Phill's personal LinkedIn is a Super or
   Content admin of `linkedin.com/company/carsiaus`, then in Synthex (signed in as
   the CARSI org owner) go to integrations and click Connect on LinkedIn; authorise
   with that admin account. The connection must return a business/company account
   type. If the page is orphaned (no reachable Super Admin), start the "Request
   admin access" flow now — it is the multi-day long-pole.
2. **Gate 2 — grant org publishing scope.** Set
   `LINKEDIN_ORGANIZATION_SOCIAL_ENABLED=true` in Vercel production and redeploy;
   the LinkedIn app must be approved for `w_organization_social` (Community
   Management API). Reconnect after enabling if you connected earlier.
3. **Gate 3 — post AS the company page.** The stored connection `profileId` must be
   CARSI's **numeric** LinkedIn organisation id (not the non-numeric OpenID member
   id the callback stores by default). Get the numeric id from LinkedIn's admin
   view; do not guess it. Without this, posts go to the personal feed.

## Founder steps — connect Meta (Facebook + Instagram)

Follow the `connecting-meta-facebook-instagram` skill. Owner-only console tasks:

1. Add the app's domains (App Domains) and confirm the Facebook Login for Business
   `config_id` matches the app you control.
2. Complete Business Verification.
3. Request/confirm `pages_manage_posts` (Facebook) and `instagram_content_publish`
   (Instagram) permissions.
4. Connect the CARSI Facebook Page and linked Instagram professional account in
   Synthex integrations, signed in as the CARSI org owner.

## How to load `scheduler-payloads.json` once connected

The payload array maps to the Synthex scheduler (`app/api/scheduler/posts`). Each
entry: `{ platform, content, mediaUrls[], suggestedScheduleAt, link }`.

1. **Field rename:** the scheduler body uses `scheduledAt`; this file uses
   `suggestedScheduleAt`. Rename at load, or map in your loader.
2. **Skip held posts:** exclude any entry with `status: "hold"` (currently only
   `LI-12`) until its media is confirmed.
3. **Per post**, POST to `/api/scheduler/posts` (signed in as the CARSI org owner)
   with:
   - `content` — verbatim from the entry (UTM link already embedded).
   - `platform` — `linkedin` | `facebook` | `instagram`.
   - `scheduledAt` — the entry's `suggestedScheduleAt` (ISO, +10:00). A past time
     means publish on the next cron run; keep them future-dated.
   - `mediaUrls` — the entry's Cloudinary URLs.
   The cron `/api/cron/publish-scheduled` publishes each post at its `scheduledAt`.
4. **Record approval + asset rights** per
   `docs/marketing-agency/CONSENT-AND-STORY-EVIDENCE-POLICY.md` before the first
   external post.
5. **Acceptance** = the publish response returns `success: true` with a `url`, and
   the LinkedIn post is visible on `linkedin.com/company/carsiaus` (not the personal
   profile). Store the receipt back into the campaign pack.

## Owned media (publish now, after human review)

- **Blog** (`platform-drafts.md` -> BL-01) — publish to the readiness hub / CARSI
  blog. Include the official DAFF/ACDC source links already in the draft.
- **Emails** (EM-01 launch, EM-02 mid-campaign) — send to the restoration,
  cleaning and IAQ lists. Suggested: EM-01 on 2026-07-09, EM-02 on 2026-07-23.

## Pre-publish self-check (run before every external post)

Banned-phrasing sweep already passed for this pack (0 hits):

```bash
grep -rniE 'IICRC[ -]accredited|IICRC certification course|kills? H5N1|\b(outbreak|crisis)\b|\bcolor\b|\bmold\b|\borganize\b' \
  docs/marketing-agency/campaigns/carsi-h5-launch-2026-07-08
```

Audit result at generation: **0 banned IICRC phrasings, 0 US spellings, 0 fear
descriptors (the proper noun "Emergency Animal Disease Hotline" excepted), 0
product-kills-H5N1 claims.**
