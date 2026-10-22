# Card pipeline: from a website to a published card, automatically

Design only, 22/10/2026. Nothing here is built unless marked **Live**. Tags: `[VERIFIED]` read from the
named source, `[INFERENCE]` reasoned from named material, `[UNCONFIRMED]` assumption or second-hand.

Ambition (Phill, 22/10/2026): about 1,000 cards a day across AU, NZ, Canada, the US and Asia. At A$249
that is A$249,000 a day, about A$22.4M inc GST over 90 days. `[INFERENCE: arithmetic]` Demand at that
level is unproven. `[UNCONFIRMED]` Hand-made cards cannot reach it, so every step below runs on its own
and a person sees only flagged cases.

## 1. Where it lives: the Nexus portal, with a new customer area

- Today Nexus (Unite-Group `apps/web`) is a private, single-founder CRM. Sign-in is Supabase Auth, every
  page is behind a founder allow-list, and data is scoped by `founder_id`. There is no customer or
  organisation table. `[VERIFIED: apps/web/CLAUDE.md:44,85; src/proxy.ts:145; src/lib/auth/private-access.ts:19-64]`
- So card customers need a **new route group** with its own guard and a **customers/organisations**
  table, with every row scoped to the customer's organisation. Phill's own admin view (orders, flagged
  queue) fits the existing founder nav. `[INFERENCE from the above; nav at src/lib/navigation/founder-nav.ts:23-103]`
- **Secrets never reach the card.** OAuth tokens are stored encrypted server-side. Reuse Nexus's vault
  pattern (AES-256-GCM, `VAULT_ENCRYPTION_KEY`), keyed per customer, not per founder.
  `[VERIFIED: src/lib/vault.ts:37-66]` The public card only ever receives public values: Place ID, review
  URL, public links. No passwords are ever collected.

### Connections the owner makes in Nexus (each via the platform's own consent screen)

| Connection | Scope | Reuse | Status |
| --- | --- | --- | --- |
| Google Business Profile | `business.manage` | Synthex already has the OAuth route and a full client: list locations, get reviews, reply, posts `[VERIFIED: Synthex app/api/auth/oauth/[platform]/route.ts:118-122; lib/google/business-profile.ts:157,304,355]` | Designed. Needs Phill's Google Cloud OAuth app and Google verification: `business.manage` is a sensitive scope `[VERIFIED: Synthex docs/marketing-agency/google-scope-justification-register.md:11]` |
| LinkedIn | posting scopes | Nexus has LinkedIn OAuth `[VERIFIED: src/lib/integrations/social.ts:41-49]` | Designed. Needs LinkedIn app review for customer use `[UNCONFIRMED]` |
| Facebook / Instagram | pages_manage_posts, instagram_content_publish | Nexus has Meta OAuth, but it stores the user token against each Page; check before reuse `[VERIFIED: api/auth/meta/callback/route.ts:87]` | Designed. Needs Meta app review `[UNCONFIRMED]` |

## 2. "Review my business": the card's centrepiece

- **Live on the card:** a prominent "Review my business" section. It opens Google's own review form,
  `https://search.google.com/local/writereview?placeid=<PLACE_ID>`, and shows "Not connected yet"
  until the owner connects their Business Profile. `[VERIFIED: card.html, review section]`
- The customer writes and posts the review themselves, signed in to their own Google account. Google
  offers no way to post a review on someone else's behalf, and must not be asked to. Every visitor sees
  the same button: no pre-screening, no prize, no hiding it from unhappy customers.
  `[VERIFIED: Google policy lines in research-notes.md §3]`
- Optional quick-tap AI draft: the customer taps a few answers, AI words them, the customer edits.
  Designed only.
- Owner side (designed): the Business Profile connection reads new reviews and lets the owner reply from
  Nexus. "Reviews this card earned" is attributed by time window after a review-button tap where
  possible; otherwise Nexus shows the before-and-after count. `[INFERENCE: Google does not tell us who
  tapped what, so attribution is approximate]`

## 3. The automated pipeline

Each order moves through these states. Each step is idempotent (keyed by order and step), so a retry
never double-charges or double-renders.

```
new → brand_pulled → preview_ready → paid → opener_queued → rendering → proof_sent
    → (revision → rendering → proof_sent)* → approved → published
any step → failed → retry (backoff, max 2) → flagged (a person looks)
```

1. **Website in.** The buyer enters their site on `get-your-card.html` (Live: upload and logo colours
   work today `[VERIFIED: browser test]`).
2. **Brand kit pulled automatically.** Synthex's brand-DNA extractor reads the site (Firecrawl when keyed,
   otherwise plain fetch; colours from the model are inferred, not measured)
   `[VERIFIED: Synthex lib/brand-dna/extractor.ts, lib/ai/website-analyzer.ts]`. The kit then passes
   `brand-kits/validate.py`: every value sourced or marked missing `[VERIFIED: validator rejects unsourced
   colours]`. Missing items are shown to the buyer, never invented.
3. **Opener generated.** The buyer picks an edition. The edition's motion is rendered in Higgsfield with
   their logo as the end frame (start/end-frame image-to-video). `[UNCONFIRMED: end-frame control on the
   chosen model]` Live today on Phill's card: the signature reveal plus Portal and Restoration editions,
   switched with `?edition=`.
4. **Live preview** from the same template as every card. Live.
5. **Pay.** Stripe Payment Link, carrying the referrer (`client_reference_id`). Switched off until Phill
   approves live payments (see purchase-flow.md).
6. **Proof room** (section 4).
7. **Published** at the card's own address with the share kit.

### Cost per card (Signature, A$249)

| Item | Estimate (AUD) | Basis |
| --- | --- | --- |
| Brand pull (crawl + model) | ~0.10 | `[INFERENCE]` |
| Opener render, ~2 takes of 4 s | ~1.40 | Kling 3.0 at US$0.112 per second `[VERIFIED: Higgsfield API blog, 16/09/2026]`; ×1.52 FX `[UNCONFIRMED]` |
| Re-renders in revisions | ~0.70 | `[INFERENCE: text edits never re-render]` |
| Hosting and delivery | <0.10 a month | `[INFERENCE from the team's current billing]` |
| Card payment fee | ~4.70 | `[UNCONFIRMED: Stripe AU domestic rate]` |
| **Direct cost** | **~A$7 per card** | `[INFERENCE]`; excludes support and flagged review time |

Per-order cost ledger: every paid call writes its cost against the order. If an order passes **A$15** in
generation cost, it stops and alerts Phill instead of spending more. `[INFERENCE: cap is a proposal]`

### Queue and throughput

- 1,000 cards a day is about 2,000 renders a day, roughly 1.4 a minute, spread across time zones.
  `[INFERENCE]` Higgsfield's concurrency and rate limits are unknown `[UNCONFIRMED]`. The queue
  holds a daily credit budget and a concurrency limit, and degrades to "your opener is in the queue"
  rather than failing.
- Jobs are polled or webhooked (Higgsfield jobs are asynchronous) `[VERIFIED: docs.higgsfield.ai
  requests]`; outputs are copied to our storage straight away because Higgsfield keeps them about 7 days
  `[VERIFIED: Higgsfield billing-and-retention docs]`.

### Failure handling and human review (only for flagged cases)

Flag to a person when any of these is true:
- the brand pull finds no logo or no colour, or the site cannot be read;
- a render fails twice, or Higgsfield returns an NSFW status;
- the order passes the A$15 cost cap;
- the buyer asks for an AI avatar of a person (consent check);
- the content names a trademark or a well-known person who is not the buyer;
- a proof-room message reads as a complaint or a refund request.
Everything else goes from website to proof without anyone touching it.

## 4. Proof room (recommended)

- A private, mobile-first page per order inside Nexus, opened by a magic link. It shows the live card
  exactly as it will look: opener, brand kit, links and review button.
- **Approve** with one tap. **Small edits** (text, links, contact details, edition choice) apply
  instantly and are free. **Send back**: tap any element, write the change; that is one revision round.
- **Revisions:** rounds 1–3 included in A$249; from round 4, A$29 per round via a Stripe link (test
  mode until live is approved). The counter reads "Round 2 of 3 included". Only what was flagged is
  regenerated, so a text change never re-renders the video. A fix for our own error never counts.
- **Notifications:** email when a new version is ready (Nexus has SendGrid `[VERIFIED:
  src/lib/integrations/sendgrid.ts]`); SMS needs a provider (none found in Nexus `[VERIFIED]`); Telegram
  and WhatsApp as later opt-ins. The proof room stays the single source of truth.
- **Approve = publish**, then the share kit: link, QR code, wallet pass and their reveal clip for
  socials, plus "Get your own card" with their referral code.
- **Audit:** every version kept; going back to an earlier round is free.

## 5. Your intro video

**Option A, included (default): Record yourself.** A teleprompter in the proof room shows an AI-written
script; the buyer records on their phone or webcam; we trim, caption and brand it. It is real footage,
so it needs nothing beyond the terms. `[INFERENCE]`

**Option B, add-on: an AI avatar of yourself in your own voice.**
- Our direct cost is about US$3.76–4.55 per client (Digital Twin creation US$2.13; 20 s of Avatar IV
  video ~US$1.61; ~300 characters of ElevenLabs speech ~US$0.02), about **A$5.70–6.90**, or ~A$14 with
  two retries. `[VERIFIED: HeyGen API pricing help article; elevenlabs.io/pricing/api]`
  `[INFERENCE: totals and 1.52 FX]`
- **Recommendation: price it at A$49, not A$29.** A$29 covers the vendors but not consent handling,
  retries and checking each video. `[INFERENCE]`
- Whether Digital Twin creation by API is Enterprise-only must be confirmed with HeyGen before building.
  `[UNCONFIRMED]`
- Consent only from the person themselves, through the vendors' own flows: HeyGen's webcam consent is
  open to all customers; uploading a consent video is Enterprise-only `[VERIFIED: developers.heygen.com/docs/avatar-consent]`.
  ElevenLabs professional clones cannot be made of someone else even with consent, so the voice comes
  from the client's own account or HeyGen's voice `[VERIFIED: ElevenLabs PVC docs]`.
- Every such video carries an "AI-generated avatar" label; deletion on request or when a staff member
  leaves. `[INFERENCE]`

**Phill's own bio video:** uses his existing HeyGen avatar and ElevenLabs voice only, with his consent
recorded 22/10/2026 (brand-kits/phill-mcgurk.json). The script is in `phill-bio-script.md` for his
approval. The HeyGen connection is not authorised in this session, so generating it is blocked.
`[VERIFIED: session MCP status lists heygen as needing authentication]`

## 6. Social sharing and analytics (designed)

- From Nexus the owner posts their card or reveal clip to LinkedIn and their socials through their own
  connected accounts. Every post is a draft they approve. Reuse Nexus's draft → approval → publish flow,
  which publishes only an approved, unchanged version. `[VERIFIED: api/cron/social-publisher/route.ts:59-104]`
- Card analytics per card: opens, review-button taps, saves, Pass it on shows. Needs a small
  event endpoint on the card's host. Designed only.

## 7. Founder-only steps (Phill)

1. Google Cloud OAuth app and Google verification for `business.manage`.
2. LinkedIn and Meta app review for customer accounts.
3. Authorise HeyGen (`/mcp`) and approve the bio script.
4. Stripe test key, then live payments, final prices and terms.
5. An SMS provider for proof-room texts.
6. Trademark search and designer rework for the AI-generated logo before selling under it.
