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

The LinkedIn account that authorises is Phill's **personal** LinkedIn (the
Carsi 1Password "LinkedIn" item is that personal email login, not a CARSI-owned
developer app). Posting to the company page works through that personal account
**only if it is an admin of** `linkedin.com/company/carsiaus` — `w_organization_social`
posts as the organisation through an authorised admin member. Personal-profile
posting is rejected outright (see "Why personal posting is blocked" below).

1. **Confirm admin rights first** (owner: Phill, on LinkedIn). One of:
   - Personal account is already a Super or Content admin of the CARSI page →
     proceed. Timeline: none.
   - Someone else holds Super Admin → they add the personal account at
     Page → Admin tools → Manage admins. Timeline: minutes. Risk: low.
   - **No one currently holds Super Admin (orphaned page)** → use
     Page → More → Request admin access; LinkedIn verifies the association and
     this can take several days plus a possible support ticket. Risk: this is
     the real long-pole — if the page was created under an inaccessible account,
     recovery is multi-day, so check this *now*, not at publish time.
2. In Synthex, signed in as the CARSI org owner, go to integrations and click
   Connect on LinkedIn; authorise with the admin personal account. The
   connection must come back as a business/company account type with a numeric
   organisation id, or Gate 3 cannot be satisfied.

A stale inactive LinkedIn connection already exists for CARSI (audit:
`totalConnectionCount=1`, `activeConnectionCount=0`); reconnecting replaces it,
so it is not a blocker.

The Synthex LinkedIn **app** (client id/secret) is already configured in the
platform-credentials store — audit reports `oauthAppCredentials=True` — so no
developer-app setup is needed for this gate. The 1Password item is the member
login that authorises, not the app connector.

### Why personal posting is blocked

`app/api/social/post/route.ts:302-308` rejects the publish unless the connection
is a business account type with an allowlisted org id:

```ts
if (
  !organizationId ||
  !isBusinessSocialAccountType(connection.accountType) ||
  !connection.profileId ||
  allowedProfileIds.length === 0 ||
  !allowedProfileIds.includes(connection.profileId)
) { /* blocked: not an allowlisted owned page */ }
```

and `lib/social/owned-page-policy.ts:103-105` defines the accepted types —
personal profiles are not among them:

```ts
export function isBusinessSocialAccountType(accountType: string): boolean {
  return ['business', 'business_page', 'company'].includes(accountType);
}
```

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

## Gate 3 — Make the connection post AS the company page (the real gap)

**Not an allowlist problem.** As of commits #372/#374/#382, the publish route
auto-enables LinkedIn: `evaluateOwnedConnectionPublishGate`
(`lib/social/owned-page-policy.ts:174-207`, called at
`app/api/social/post/route.ts:318`) returns `allowed` for any active org-scoped
LinkedIn connection with a real `profileId` — **no allowlist entry needed**.
(The readiness audit still reports `owned_profile_allowlist_missing` for
LinkedIn; that is the audit using the old model — it over-reports a blocker the
live route no longer enforces.)

**The actual gate is which URN the post targets.** `lib/social/linkedin-service.ts:601-611`:

```ts
const storedUserId = this.credentials?.platformUserId; // = connection.profileId
if (storedUserId && /^\d+$/.test(storedUserId)) {
  authorUrn = `urn:li:organization:${storedUserId}`;   // company page
} else {
  authorUrn = `urn:li:person:${profile.id}`;            // PERSONAL feed
}
```

The connect callback stores `profileId = data.sub` — LinkedIn's OpenID member id,
which is **non-numeric** (`app/api/auth/callback/[platform]/route.ts:520-526,890`).
So with the connection as-built, the numeric test fails and the post goes to the
**personal feed**, not the CARSI company page — even with admin rights and
`w_organization_social` granted.

To publish as the company page, the connection's `profileId` must be CARSI's
**numeric LinkedIn organisation id** (e.g. `112760720`). The connect flow does not
capture it today, so after Gate 1 it must be set explicitly — either by updating
the stored connection's `profileId` to the verified org id, or by extending the
LinkedIn callback to fetch the member's admin'd organisation and store its id.
Get the numeric id from LinkedIn (the admin can read it from the page's admin
view / organizationAcls API). Do not guess it.

---

## Final step — shadow to live

With Gate 1 (connected as admin), Gate 2 (`w_organization_social` granted) and
Gate 3 (`profileId` = numeric org id) all done, record approval + asset-rights
confirmation per `docs/marketing-agency/CONSENT-AND-STORY-EVIDENCE-POLICY.md`,
then publish the approved post (caption + visual in
`public/marketing-agency/today-publish-proof/linkedin-ready/`) via
`POST /api/social/post` with `platforms: ['linkedin']`.

**Acceptance is the response, not the readiness audit.** The audit still uses the
old allowlist model and will not flip LinkedIn to `ready`; the real proof is the
publish call returning `success: true` with a `url` on the CARSI company page
(`linkedin.com/company/carsiaus`). Confirm the post is visible there, not on the
personal profile.
