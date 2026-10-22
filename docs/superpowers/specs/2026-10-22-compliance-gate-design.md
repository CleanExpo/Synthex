# Compliance gate in the approval path: design spec

**Status:** proposal (22/10/2026), not approved for build
**Client metric:** both — every CARSI enrolment email, RestoreAssist trial nurture email, SMS and ad that Synthex sends on its own must survive Australian spam, advertising and platform rules, or the autonomy that is meant to grow those numbers gets paused by a regulator, a mailbox provider or an ad platform.
**Rests on:** synthex-intel-07-advantages-and-proposals (unnumbered proposal group "Compliance built into the approval gate", plus proposals 5, 6 and 10), synthex-intel-06-trends-and-signals (§3.1 Australian rules), ai-tools-radar-2026-10-22 (harvey row: approval-gated outbox), and repo evidence in `lib/publish/safetyChecks.ts`, `lib/marketing-agency/campaign-authority-manifest.ts`, `app/api/newsletter/unsubscribe/route.ts`, `lib/email/index.ts` and `app/api/cron/drip-day3/route.ts`.
**Relation to the fleet programme:** extends P7 / M6 (delegated publish, built and never activated) by adding the compliance blockers that must exist before any human turns the P7 policy on, and touches P8 / M12 only where M12 already asks for a "claims check" on review-request sends. It does not duplicate P8's content-quality judges. Email has no fleet phase today; this spec covers it because no phase does.

## Finish line

A planted non-compliant item is refused on each path that can reach a recipient without a person pressing send, and a compliant twin passes. On social, the publish queue holds (never retries) any item whose campaign manifest lacks a passed compliance section, and the reason names the rule. On email, the one shared send function refuses a commercial message that has no working unsubscribe link, no `List-Unsubscribe` and `List-Unsubscribe-Post` headers, no sender identification, or a recipient who is unsubscribed or whose suppression status cannot be read. A POST of `List-Unsubscribe=One-Click` to the unsubscribe route returns 200 with no redirect and actually suppresses the address. Every rule in the rule set carries a source link, a "verified on" date, and a "lawyer reviewed: no" flag until a lawyer signs it off. Each of these is a unit test that has been seen to fail before it was seen to pass.

## Decision up front

Build, in-house, small. The gate is a set of deterministic rules added to the two places that already decide "may this go out": the campaign-manifest evaluator that `runSafetyChecks` calls before every queue publish, and a new fail-closed send-time check inside `lib/email/index.ts`, which today has no check at all. Do the email slice first, because it is live exposure now: the unsubscribe route claims RFC 8058 one-click support it does not have, reports success when it is not configured, and nothing the drip crons send reads either suppression store. Do the social blockers with P7, before activation. Buy nothing. Study `errata-ai/vale` for the claims rule-file shape. Defer C2PA signing (`contentauth/c2pa-js`, MIT) until a target platform is confirmed to need it. A lawyer reviews the rule set before any rule is trusted as legal cover.

**Disposition test.** This does not move O1-O7 or the client metric directly. It protects both client metrics. Without it, P7 cannot safely be activated for CARSI or RestoreAssist, and the email path is already exposed. Recommend build, scoped to the slices below. Cut anything that only adds reporting.

## Goals & non-goals

**Goals**
- One compliance decision inside the existing approval path, fail-closed: unknown, unreadable or missing means blocked.
- Spam Act basics on every commercial email and SMS: consent recorded, sender identified, a working unsubscribe that is honoured.
- RFC 8058 one-click unsubscribe that a mailbox provider can actually call.
- Claims rules per brand: insurance-adjacent restoration claims and CARSI course claims need evidence and human sign-off.
- AI-disclosure flags per platform, carried on the manifest, so the platform's own disclosure control gets set when a rule says so.
- A rule set where every rule carries its source, a verified-on date and a lawyer-review flag.

**Non-goals**
- Not a legal opinion. The gate enforces rules a person wrote down. It cannot decide whether copy is true.
- No consent-ledger table or suppression table in this spec. They are asked, not built (DECISIONS A-24 / D3).
- No C2PA signing in the first three slices.
- No change to `HOLD_FOR_REVIEW`, `check-held.mjs` or any protected path.
- No launch, pricing or customer-readiness framing. Gate 1 of `runSafetyChecks` checks for an active subscription [VERIFIED lib/publish/safetyChecks.ts:136-160]. That check is SaaS framing for an internal agency. This spec does not build on it, and proposal 5 already lists the subscription surfaces for retirement.

## Approach

### What exists today (the evidence)

- **Social approval path.** The queue drain calls `runSafetyChecks` for every due item [VERIFIED lib/publish/publishQueue.ts:585]. Gate 4 runs `assertCampaignPublishable` on the slot's authority manifest [VERIFIED lib/publish/safetyChecks.ts:236-253], which runs `evaluateCampaignEvidenceManifest` [VERIFIED lib/marketing-agency/campaign-authority-manifest.ts:312]. That evaluator already blocks claims with no evidence, claims that need human approval, and assets without cleared rights [VERIFIED lib/marketing-agency/campaign-authority-manifest.ts:341-373]. This is the right home: compliance blockers become more entries in the same `blockers` array.
- **Held versus retried.** A failed gate is held only if its name is on the list at [VERIFIED lib/publish/publishQueue.ts:600-614]. Any other gate name falls into the retry branch and retries on every interval. A new gate name that is not added to that list would retry forever. Pushing compliance blockers into Gate 4 avoids this, because `campaign_authority_blocked` is already on the held list.
- **The autopilot is held.** `HOLD_FOR_REVIEW` is `true` [VERIFIED lib/autopilot/hold-for-review.ts:23], and the regex quality gate can only return draft or reject [VERIFIED lib/autopilot/quality-gate.ts:62-87]. P7's `resolveHoldState` does not exist yet. `check-held.mjs` is ready for it [VERIFIED scripts/gate/check-held.mjs:20]. Proposal 1 in synthex-intel-07 also says nothing on main schedules the queue drain yet, so the social path is not live today [INFERENCE from synthex-intel-07 proposal 1, not re-checked in `vercel.json`].
- **One AI-disclosure rule exists.** The campaign quality gate blocks a `youtube_shorts` draft whose media plan does not set `aiDisclosureRequired` [VERIFIED lib/marketing-agency/campaign-quality-gate.ts:271-276]. BACKLOG item 16 records that nothing tests the allow side of that rule [VERIFIED BACKLOG.md:29].
- **The claims tripwire covers Synthex's own public copy, not client content.** [VERIFIED __tests__/landing/public-claims.test.ts:1-20].
- **The brand configs seed unverified claims into generation.** The Disaster Recovery sample phrases include "Insurance-approved restoration, coordinated fast." [VERIFIED lib/agency/portfolio-brand-configs.ts:51]. NRPG's include "Built for IICRC-certified contractors." [VERIFIED lib/agency/portfolio-brand-configs.ts:71]. CARSI's include "Maintain your IICRC CEC online." [VERIFIED lib/agency/portfolio-brand-configs.ts:112]. Each is a factual claim that needs evidence before it goes out under the brand's name.
- **Email has no approval path.** The email-sequence route only drafts and never sends [VERIFIED app/api/marketing/email-sequence/route.ts:1-7]. The drip cron calls the send function directly. It skips a user only on its idempotency flag, never on an unsubscribe [VERIFIED app/api/cron/drip-day3/route.ts:94-105]. `canSendTo` exists [VERIFIED lib/email/index.ts:309-326], has no callers in `lib` or `app` (grep for `canSendTo` returned only its definition), and allows any address it does not know [VERIFIED lib/email/index.ts:315].
- **Two unsubscribe stores that do not talk to each other.** The newsletter route writes only to the Resend audience [VERIFIED app/api/newsletter/unsubscribe/route.ts:84-88]. The SendGrid webhook writes `user.preferences.emailStatus` [VERIFIED app/api/webhooks/email/sendgrid/route.ts:223-248]. The drip emails link to the newsletter route [VERIFIED lib/email/billing-emails.ts:362]. So a person who unsubscribes from a drip is recorded in Resend, and the next drip is sent anyway [INFERENCE from the three lines above; not run]. That is the same shape as the Lululemon case below.
- **The unsubscribe route fails open and does not support one-click.** With `RESEND_AUDIENCE_ID` unset, it returns "Unsubscribed successfully" and records nothing [VERIFIED app/api/newsletter/unsubscribe/route.ts:73-78]. Its header comment claims RFC 8058 support [VERIFIED app/api/newsletter/unsubscribe/route.ts:22-23], but POST parses JSON [VERIFIED app/api/newsletter/unsubscribe/route.ts:29], while a one-click POST sends the form body `List-Unsubscribe=One-Click` [VERIFIED https://www.rfc-editor.org/rfc/rfc8058.txt fetched 22/10/2026]. GET answers with redirects [VERIFIED app/api/newsletter/unsubscribe/route.ts:64-67], and RFC 8058 says the sender MUST NOT return a redirect [VERIFIED https://www.rfc-editor.org/rfc/rfc8058.txt fetched 22/10/2026]. A grep for `List-Unsubscribe` across `lib` and `app` finds only that comment, so no outgoing email sets the headers.
- **Dead unsubscribe links.** The monthly story and effect report emails link to `/unsubscribe` [VERIFIED lib/email/monthly-story-email.ts:185] [VERIFIED lib/email/effect-report-email.ts:246]. There is no `app/unsubscribe` route (`ls app/unsubscribe` returned "No such file"). The only page is `app/unsubscribed`.
- **SMS.** `lib/sms/index.ts` builds a Twilio provider and exports no opt-out or STOP handler (grep of `lib/sms/index.ts` and `lib/sms/types.ts` only; `twilio-provider.ts` was not read). Latitude's fine below was for SMS STOP replies that did not work.
- **No consent fields.** `Contact` has name, email, role and phone, and no consent or opt-out fields [VERIFIED prisma/schema.prisma:7345-7359].

### What the rules say (the sources)

- **Spam Act, ACMA guidance.** You need consent before you send, and you must be able to prove it. Every message must identify the sender with contact details that stay correct for at least 30 days. Every commercial message needs an unsubscribe that is clear, is honoured within 5 working days, costs nothing, works for at least 30 days after sending, and needs no login or extra personal information [VERIFIED https://www.acma.gov.au/avoid-sending-spam fetched 22/10/2026]. This is ACMA guidance, not the Act itself. The section numbers are [UNVERIFIED].
- **Lululemon, 11/03/2026.** A$702,900 for more than 370,000 emails with commercial content and no way to unsubscribe. The emails were order and delivery messages that carried sales content. ACMA's advice: keep service messages apart from sales content [VERIFIED https://www.acma.gov.au/articles/2026-03/lululemon-penalised-702k-spam-breaches fetched 22/10/2026].
- **Latitude Finance, 15/04/2026.** A$3.96M for more than 2.7 million breaches. 2.3 million messages had inaccurate contact details, and 344,416 of those also had no working unsubscribe. Recipients were told to reply STOP, but many messages could not take a reply [VERIFIED https://www.acma.gov.au/articles/2026-04/latitude-finance-pays-396m-more-spam-breaches fetched 22/10/2026]. So "mostly unsubscribe failures" is only partly right: Latitude's larger count was sender identification.
- **Gmail bulk senders.** Senders of more than 5,000 messages a day to Gmail must support one-click unsubscribe with `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, and must also show a visible unsubscribe link [VERIFIED https://support.google.com/mail/answer/81126 fetched 22/10/2026]. RFC 8058 also requires a DKIM signature that covers both headers [VERIFIED https://www.rfc-editor.org/rfc/rfc8058.txt fetched 22/10/2026].
- **ASQA (CARSI).** Training marketing must clearly separate Nationally Recognised Training from non-accredited training, under the NRT logo conditions in Schedule 2. Where a third party delivers part of the service, the marketing must say who delivers what [VERIFIED https://www.asqa.gov.au/for-providers/standards-for-RTOs/practice-guides/compliance-standards-for-rtos/information-and-transparency-practice-guide fetched 22/10/2026]. Whether CARSI is itself an RTO, a third party to one, or neither is [UNVERIFIED]. That decides which rules apply (open question Q3).
- **Google Ads "How this ad was made".** Per a secondary source, the panel was added to My Ad Center on 09/07/2026. Ads built with Google's own AI tools are disclosed automatically. Ads built with outside tools rely on an advertiser control. Google's help page reportedly says "Not all AI-created content needs to be labeled" and names the EU, India and New York as places with requirements [VERIFIED https://ppc.land/google-adds-how-this-ad-was-made-ai-labels-24-days-before-eu-deadline/ fetched 22/10/2026, a secondary source]. Google's own help page was not fetched, so the rule itself is [UNVERIFIED].
- **Meta.** The 01/06/2026 update to Meta's midterms post says Meta adds information to ads it detects were made with third-party AI tools, and that self-disclosure is required for social-issue, election and political ads [VERIFIED https://about.fb.com/news/2026/02/meta-prepares-for-2026-us-midterms/ fetched 22/10/2026]. Meta's general rule for commercial ads, including the claim that it reads C2PA metadata, came only from secondary search results and is [UNVERIFIED].
- **YouTube.** The monetisation policy page shows an update dated 15/07/2025 that renamed "repetitious content" to "inauthentic content". It lists AI personas giving medical, financial or legal advice as not monetisable [VERIFIED https://support.google.com/youtube/answer/1311392 fetched 22/10/2026]. The brief's date of 16/07/2026 does not appear on that page. Secondary reports describe a clarification around 20/07/2026 [UNVERIFIED]. Monetisation matters little to Synthex, which posts marketing content rather than earning from views. The AI-persona rule is the part that matters for restoration advice videos.
- **ACCC, fake reviews and misleading claims.** Fake or arranged reviews are illegal under the Australian Consumer Law [UNVERIFIED: accc.gov.au returned 403 on 22/10/2026]. Insurance-adjacent wording ("insurance-approved") is misleading unless an insurer actually approved it [UNVERIFIED, INFERENCE from the general misleading-conduct rule].
- **Ad Standards / AANA.** The codes are media-neutral, so AI-made ads fall under the same rules [UNVERIFIED: adstandards.com.au returned 403; wiki §3.1 only].
- **Privacy Act tranche 2.** The exposure draft came out 31/08/2026 and submissions closed 18/09/2026. It would require consent to disclose or trade personal information for direct marketing, and unsubscribe information on every message [UNVERIFIED: wiki §3.1 and law-firm commentary only; the Attorney-General's page was not fetched]. It is a draft. Track it, do not enforce it.

### Slices (thinnest first)

1. **Email send-time gate and a working unsubscribe** (live exposure, no protected path).
   - Add `assertEmailCompliant(message, recipient)` in `lib/email/`. The one send function calls it before any commercial send. A message marked transactional that contains marketing content counts as commercial (the Lululemon rule). The check blocks unless all of these hold: the body has a visible unsubscribe link to a route that exists; the `List-Unsubscribe` and `List-Unsubscribe-Post` headers are set; the sender name and a contact address are present; and the recipient's suppression status was read and is not suppressed. If the read fails, the send is blocked, never allowed.
   - Replace `canSendTo`'s rule that unknown addresses are allowed with a read of both stores. Write every unsubscribe to both.
   - Fix the route. Accept the form body `List-Unsubscribe=One-Click` on POST and return 200 with no redirect. Use an opaque signed token in place of the raw email in the URL, which RFC 8058 recommends. Remove the false success when `RESEND_AUDIENCE_ID` is unset: return 503 `FEATURE_NOT_PROVISIONED`, as the repo's honest-status rule requires.
   - Point the `/unsubscribe` links at the real route.
   - If the founder retires the drip crons under proposal 5, this slice still applies to every future CARSI or RestoreAssist send.
2. **Compliance section on the campaign manifest** (social, alongside P7). Add an optional `compliance` object to `CampaignEvidenceManifest`. It is JSON inside the slot, so no schema change is needed. It holds the rule-set version, each rule's result, the AI-disclosure flags for each platform, and the claim classes found. `evaluateCampaignEvidenceManifest` pushes `campaign_compliance_missing` when the object is absent, and `campaign_compliance_<rule>` for each failed rule. These blockers flow through Gate 4's existing held handling, so no new `failedGate` is needed. If a later change adds a new gate name, it must be added to the held list at `publishQueue.ts:600-614` in the same commit.
3. **Brand claims rules** (feeds proposal 6, the brand rules layer). Add a rule file for each brand in the shape `errata-ai/vale` uses: a pattern, a claim class (`insurance_adjacent`, `certification`, `training_recognition`, `testimonial`, `guarantee`, `price`), and the evidence it needs. A match turns the claim into a manifest claim with `requiresEvidence: true` and `humanApprovalRequired: true`, which the evaluator already enforces. AI-actor testimonials for restoration and insurance-adjacent brands are always blocked until a lawyer has reviewed the rule (synthex-intel-07). The three seeded phrases above become the first test fixtures.
4. **SMS** (only once an autonomous SMS sender exists). Require the sender ID, a STOP instruction, and a tested inbound STOP handler that writes to the same suppression store. Block every send until the handler's test passes.
5. **AI disclosure metadata** (deferred). Add C2PA manifests on generated images and video only when a target platform is confirmed, on its own policy page, to read them. Until then the manifest's disclosure flag drives each platform's own disclosure control.

## Open-source candidates

| Project | Licence | Stars | pushed_at | What it gives us | Decision | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| [errata-ai/vale](https://github.com/errata-ai/vale) | MIT | 6272 | 2026-10-16 | A prose linter with YAML rule files (existence, substitution, conditional). The best-maintained pattern for one claims rule file per brand. It is a Go binary, so running it inside Next.js would be awkward | study-pattern | [VERIFIED gh api repos/errata-ai/vale] |
| [contentauth/c2pa-js](https://github.com/contentauth/c2pa-js) | MIT | 40 | 2026-10-19 | A monorepo that holds the live Node binding (`packages/c2pa-node`), plus wasm, web and types. It can sign and read C2PA manifests for generated media. 40 stars is a thin community | depend (deferred to slice 5, after supply-chain review) | [VERIFIED gh api repos/contentauth/c2pa-js] |
| [contentauth/c2pa-rs](https://github.com/contentauth/c2pa-rs) | NOASSERTION | 435 | 2026-10-19 | The reference Rust SDK under the bindings. The repo holds `LICENSE-MIT` and `LICENSE-APACHE` files (contents API), but GitHub reports no single SPDX ID | study-pattern | [VERIFIED gh api repos/contentauth/c2pa-rs] |
| [contentauth/c2patool](https://github.com/contentauth/c2patool) | Apache-2.0 | 151 | 2026-10-21 | A CLI to read and add C2PA manifests. Useful in a verification script to prove that a disclosure survived export | call-as-service (as a CLI in checks, slice 5) | [VERIFIED gh api repos/contentauth/c2patool] |
| [textlint/textlint](https://github.com/textlint/textlint) | MIT | 3202 | 2026-10-18 | A pluggable prose linter in JavaScript. It could host the claims rules in-process if a hand-written matcher proves too weak | study-pattern | [VERIFIED gh api repos/textlint/textlint] |
| [Lickgrass/one-click-unsub](https://github.com/Lickgrass/one-click-unsub) | MIT | 2 | 2026-10-17 | RFC 8058 HMAC tokens, header builder and Fetch handlers. Exactly slice 1's shape, but 2 stars | study-pattern | [VERIFIED gh api repos/Lickgrass/one-click-unsub] |
| [get-alex/alex](https://github.com/get-alex/alex) | MIT | 5105 | 2024-11-27 | An inclusive-language linter. Stale, and not about claims | reject | [VERIFIED gh api repos/get-alex/alex] |
| [contentauth/c2pa-node-v2](https://github.com/contentauth/c2pa-node-v2) | MIT | 11 | 2026-06-19 | An older Node binding, archived (as is `contentauth/c2pa-node`) | reject | [VERIFIED gh api repos/contentauth/c2pa-node-v2] |

- **vale.** The rule format (a pattern, a message and a level per YAML file) maps cleanly onto one claims file per brand. Copy the idea into TypeScript. Do not ship the binary.
- **c2pa-js.** This is the only maintained Node path to C2PA. The archived `c2pa-node` repos point to it. Revisit it when slice 5 is triggered.
- **one-click-unsub.** It is small enough to read in full. Write our own roughly 60 lines rather than depend on a 2-star package.
- **Already in the tree.** `resend/resend-node` (MIT, 966 stars, pushed 2026-10-20) [VERIFIED gh api repos/resend/resend-node] and `sendgrid/sendgrid-nodejs` (MIT, 3055 stars) [VERIFIED gh api repos/sendgrid/sendgrid-nodejs] are existing dependencies. The headers are set through them, so no new package is needed.
- **Also checked and not listed.** `aws-samples/email-one-click-unsubscribe` (MIT-0, stale, pushed 2025-04-10) and `planetaryescape/list-unsubscribe` (Apache-2.0, 0 stars, and it parses headers rather than sending them).
- **Negative finding.** Searches for "compliance linter marketing claims" and "alex linter insensitive writing" returned no repositories. "email deliverability checker" returned only near-zero-star DNS checkers. No maintained open-source marketing-claims or Australian Spam Act linter was found within those `gh search repos` queries. That is not proof that none exists.
- The C2PA search also surfaced several popular tools that strip C2PA and AI watermarks (for example `guillaumemeyer/watermarks-remover`, 24,613 stars). So metadata alone cannot be the disclosure. The platform's own disclosure control and visible labels still matter.
- Nothing is installed by this spec. A supply-chain review runs before any dependency lands.

## Data model

None for slices 1-3.
- The compliance result lives in the existing slot or calendar JSON manifest, which is org-scoped through `ContentCalendar.organizationId` as `runSafetyChecks` already queries it.
- Suppression for Synthex users stays in `user.preferences.emailStatus`.
- Rule files are code, versioned in the repo.

**Asked, not built (founder decision, DECISIONS A-24 / D3).** A durable org-scoped consent ledger would hold who consented, when, how, to which brand, and the evidence. The Spam Act puts the burden of proof on the sender, and `Contact` has no such fields today. An org-scoped suppression table for non-user recipients (CARSI and RestoreAssist audiences) would sit beside it. Both need `prisma/migrations/**`, a protected path, so they need a declared fleet commit or the founder's `human-required` label. Until they exist, any send to a non-user recipient is blocked, because its consent cannot be proven.

## Security & cost guardrails

- **Fail-closed everywhere.** A missing manifest section, an unreadable suppression store, an unknown recipient, a missing rule file or an unknown rule-set version all block. No "graceful degradation" success.
- **Unsubscribe is public and unauthenticated by design** (RFC 8058 forbids cookies and auth on the POST). Use a signed opaque token so nobody can unsubscribe someone else by guessing an email. Keep the existing rate limit.
- **No secrets in rule files or test fixtures.** Fixture addresses use `example.com`.
- **Protected paths.** `scripts/gate/**`, `tests/eval/jev/**`, `prisma/migrations/**`, `vercel.json` and `.github/**` are untouched by slices 1-3. A JEV case for this gate would need a declared fleet commit or `human-required`. `check-held.mjs` is unchanged.
- **Cost.** Deterministic rules only, with no model call on the gate path. The cost is zero beyond existing email sends. A later model-judged claim check would sit under P8's existing budget cap, not here.
- **Logging.** Log the blocker codes and the rule-set version. Never log the message body or the recipient address in clear.

## Risk & assumption register

| ID | Risk or assumption | Likelihood | Impact | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- |
| R1 | The rule set is legally wrong or incomplete, and the gate passes non-compliant items | M | H | Every rule carries a source and a `lawyerReviewed:false` flag. Q1 requires a lawyer before activation | Founder |
| R2 | Drip or welcome emails are commercial, and a recipient who unsubscribed is still mailed today | M | H | Slice 1 first, or retire the drips under proposal 5. Q2 | Founder |
| R3 | Fail-closed blocks legitimate sends when the suppression read errors | M | M | A visible blocker code and an ops alert. A blocked send is recoverable; a sent breach is not | Builder |
| R4 | Platform AI-label rules change faster than the rule set | H | M | Each rule has a verified-on date. A refresh agent (synthex-intel-07 proposal 11) re-fetches the source pages | Builder |
| R5 | CARSI's RTO status is unknown, so the ASQA rules may be misapplied | M | M | Q3. Until it is answered, block any "nationally recognised" or "accredited" wording | Founder |
| R6 | A pattern matcher misses a claim reworded by a model | H | M | Claims rules are a tripwire, not a fact-checker (the same stance as the public-claims test). Human approval stays required for flagged classes | Builder |
| R7 | A new `failedGate` is added outside the held list and retries forever | L | M | Put blockers inside Gate 4. A unit test asserts that every `SafetyGate` value is classified held or retry | Builder |
| A1 | The social queue is not yet scheduled on main (proposal 1), so slice 2 has no live exposure until then | — | — | Build slice 2 with P7, not before | — |
| A2 | Gmail's 5,000-a-day threshold does not apply at today's volume, but RFC 8058 headers cost nothing and also help other providers | — | — | Set the headers on every commercial send | — |

## Open questions

- **Q1 (founder):** Will you engage an Australian lawyer to review the rule set (Spam Act, ACL and ACCC, ASQA, AANA, and the platform AI-disclosure rules) before any rule is treated as cover and before P7 is activated? This spec assumes yes. Every legal statement above is a lead, not advice.
- **Q2 (founder):** Are the welcome and drip emails commercial messages under the Spam Act? If they are kept rather than retired under proposal 5, slice 1 must cover them first.
- **Q3 (founder):** Is CARSI a registered training organisation, a third party delivering for one, or neither? And is IICRC CEC training "nationally recognised"?
- **Q4 (founder):** Do you approve an org-scoped consent ledger and suppression table, two migrations on a protected path? Without them, Synthex cannot autonomously email any CARSI or RestoreAssist audience.
- **Q5 (founder):** Is "Insurance-approved restoration" backed by a named insurer's approval? If not, should it be removed from the Disaster Recovery sample phrases now?
- **Q6:** Which ad platforms will P7 publish to first? That decides whether the Google and Meta disclosure rules, or C2PA, are needed in v1.
- **Q7:** Should the gate track the Privacy Act tranche 2 draft as warnings only, until it passes?

## Verification plan

Each command runs from the repo root. Each test is first planted to fail, then fixed.

```bash
# 1. Manifest without a compliance section is blocked (red today: no such blocker exists)
npx vitest run tests/unit/marketing-agency/compliance-gate.test.ts -t "missing compliance section blocks"
#    expect: blockers contains 'campaign_compliance_missing'; allowed === false

# 2. Compliant twin passes
npx vitest run tests/unit/marketing-agency/compliance-gate.test.ts -t "compliant manifest allowed"
#    expect: no 'campaign_compliance_*' blockers

# 3. Seeded insurance claim needs evidence and human approval
npx vitest run tests/unit/marketing-agency/compliance-gate.test.ts -t "insurance-approved flagged"
#    expect: claim class insurance_adjacent; '<id>_evidence_missing' and '<id>_human_approval_required'

# 4. Queue holds, never retries, a compliance-blocked item
npx vitest run __tests__/publish/publishQueue.test.ts -t "compliance blocked is held"
#    expect: item.status === 'held'; attempts not incremented

# 5. Every SafetyGate value is classified held or retry (guards R7)
npx vitest run tests/unit/publish/safety-gate-classification.test.ts
#    expect: exits 0; planting a new unclassified gate name makes it exit 1

# 6. Email: no unsubscribe link, no headers, or no sender ID -> send refused
npx vitest run tests/unit/email/compliance.test.ts -t "refuses non-compliant commercial email"
#    expect: rejects with code EMAIL_COMPLIANCE_BLOCKED naming the rule

# 7. Email: transactional-labelled message with sales content is treated as commercial
npx vitest run tests/unit/email/compliance.test.ts -t "service message with promo is commercial"

# 8. Email: suppressed recipient refused; suppression read throws -> refused (fail-closed positive control)
npx vitest run tests/unit/email/compliance.test.ts -t "suppressed or unreadable refused"

# 9. RFC 8058 one-click POST (red today: route parses JSON and 400s)
npx vitest run __tests__/api/newsletter-unsubscribe.test.ts -t "one-click form POST"
#    expect: body 'List-Unsubscribe=One-Click' -> 200, no Location header, both stores updated

# 10. Unconfigured audience no longer reports success (red today: returns 200)
npx vitest run __tests__/api/newsletter-unsubscribe.test.ts -t "unconfigured is 503"

# 11. No dead unsubscribe links remain
grep -rn "/unsubscribe?email" lib app          # expect: exit 1 (no matches) after slice 1

# 12. Hold untouched
node scripts/gate/check-held.mjs                # expect: exit 0, unchanged by this work
npm run type-check && npm run lint              # expect: exit 0
```

**Not checked in this spec.**
- No test above has been written or run.
- The ACCC, Ad Standards, Google Ads help and Attorney-General pages were not fetched (403, or not reached), so those rules are [UNVERIFIED].
- `twilio-provider.ts` was not read.
- Whether the drip crons are scheduled in production was not re-queried.
