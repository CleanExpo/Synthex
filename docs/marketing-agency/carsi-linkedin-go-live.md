# CARSI LinkedIn Go-Live Runbook

Converts the CARSI LinkedIn proof (`public/marketing-agency/today-publish-proof/`)
into a live organic post on the CARSI company page. The publish code is complete
and correctly gated — everything below is external/human config. Do the three
gates in order; each one is enforced by a specific code check that will silently
block publishing if skipped.

Live state (audit 2026-06-15): CARSI LinkedIn = `blocked: oauth_connection_missing`.
Disaster Recovery LinkedIn is connected but still blocked by
`oauth_scope_missing` + `owned_profile_allowlist_missing` — it is the live proof
that connecting alone is **not** enough. Re-run the audit any time:

```bash
npx tsx scripts/social-launch-readiness.ts --stdout
```

CARSI LinkedIn is ready when its `status` flips from `blocked` to `ready`.

---

## Gate 1 — Connect CARSI LinkedIn as the company page

**Blocker resolved:** `oauth_connection_missing`
**Enforced by:** `app/api/social/post/route.ts:289` (connection must exist) and
`:302-308` (account type must be business/company **with** a stored numeric
`profileId`).

1. In Synthex, signed in as the CARSI org owner, go to integrations and click
   Connect on LinkedIn.
2. In the LinkedIn consent screen, authorise the **CARSI company page**
   (`linkedin.com/company/carsiaus`) — not a personal profile. The connection
   must come back as a business/company account with a numeric organisation id,
   or Gate 3 cannot be satisfied.

OAuth app credentials already exist (`onepassword-carsi-linkedin`), so no
developer-app setup is needed for this gate.

---

## Gate 2 — Grant the organisation publishing scope

**Blocker resolved:** `oauth_scope_missing`
**Enforced by:** `lib/social/publishing-scope-policy.ts:11` (LinkedIn requires
`w_organization_social`) and `app/api/social/post/route.ts:317-325`.

The connect flow only **requests** `w_organization_social` when both of these
are true (`app/api/auth/oauth/[platform]/route.ts:144-149`):

1. **`LINKEDIN_ORGANIZATION_SOCIAL_ENABLED=true` in Vercel production.**
   `.env.example:199` ships `false`; production is currently effectively off
   (DR connected but missing the scope). Set it to `true` in the Vercel
   dashboard, then redeploy.
2. **The LinkedIn developer app is approved for `w_organization_social`**
   (LinkedIn's Community Management API product). This requires LinkedIn app
   review and has external lead time — start it first if not already done.

If you connect (Gate 1) before both are in place, the connection stores only
`w_member_social` and publishing stays blocked. Reconnect after enabling.

---

## Gate 3 — Allowlist CARSI's owned LinkedIn page

**Blocker resolved:** `owned_profile_allowlist_missing` / `active_profile_not_allowlisted`
**Enforced by:** `app/api/social/post/route.ts:298-315` — the connection's
`profileId` must appear in the org's owned-profile allowlist.

CARSI's owned-page config (`lib/social/owned-page-policy.ts:16-30`) lists the
LinkedIn page URL but has **no** `allowedProfileIds.linkedin` entry. After Gate 1,
read the verified numeric organisation id off the new connection and add it:

```ts
// lib/social/owned-page-policy.ts — carsi.allowedProfileIds
allowedProfileIds: {
  facebook: ['107529017631636'],
  instagram: ['carsi_aus'],
  youtube: ['@carsi6767'],
  linkedin: ['<verified-numeric-org-id-from-connection>'],
},
```

Use the exact id from the connection — do not guess it. This mirrors the
`facebook` pattern (numeric page id), not a slug.

---

## Final step — shadow to live

With all three gates green and the audit reporting CARSI LinkedIn `ready`,
record approval + asset-rights confirmation per
`docs/marketing-agency/CONSENT-AND-STORY-EVIDENCE-POLICY.md`, then move the
approved post (caption + visual in
`public/marketing-agency/today-publish-proof/linkedin-ready/`) from shadow to
live through Synthex. The unified publish route is
`POST /api/social/post` with `platforms: ['linkedin']`.
