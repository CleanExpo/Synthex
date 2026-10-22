# "Get your own card": the self-serve purchase flow

Built 22/10/2026 at Phill's request: every card sells the next one. Tags: `[VERIFIED]`, `[INFERENCE]`,
`[UNCONFIRMED]`. Nothing here takes money yet.

## What is built (in `business-card/site/`)

- **Button on every card.** "Get your own card" sits on every card the template makes, not only
  Phill's. It links to `get-your-card.html?ref=<that card's id>`, so each sale can be traced to the
  card that made it, ready for a referral reward later. In a claude.ai preview the button says it only
  works on the hosted card. `[VERIFIED: clicking it on the locally hosted card opened ?ref=phill-mcgurk]`
- **Setup page** (`get-your-card.html`), in Unite Group's brand:
  1. Their website (kept for us to confirm fonts and services; nothing copied without their OK).
  2. Their logo upload. Colours are measured from the logo itself and offered as swatches, or they
     type their exact brand colour. A found/missing list shows what is still needed. `[VERIFIED: the
     Unite logo measured as #00DCE3 and #508C93, its true colours]`
  3. Their details. 4. Businesses to link.
  5. Package choice: $99 / $179 / $249 AUD, marked indicative.
  6. Pay: **switched off.** It says "Coming soon" and offers "Register your interest", which prepares
     their details and the referrer as a message they send themselves. It never claims anything was
     sent or bought. `[VERIFIED: browser test]`
  7. What happens next: we build, send a private proof, they approve, it goes live.
- **Live preview.** As they type, a phone-shaped preview renders their card from the same template as
  Phill's, in their colours with their logo, listing what is still missing. `[VERIFIED: preview showed
  "Sam Example", the uploaded logo and the measured lead colour]`
- **Payment switch.** One line, `const PAYMENT_LINKS = null`, keeps payment off. When approved it takes
  three Stripe Payment Links (one per package). The button then passes `client_reference_id =
  <referrer>__<package>` and the buyer's email to Stripe, so every payment carries its referrer.
  `[INFERENCE: Stripe Payment Links accept client_reference_id and prefilled_email; not yet exercised]`

## What was proven in Stripe test mode

**Nothing yet.** Only live keys exist in `~/.hermes/.env` (STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY
are `sk_live`/`pk_live`; there is also a webhook secret). `[VERIFIED: key names and mode prefixes only;
no values read]` Live keys are off limits for testing, so no Stripe object was created. To prove the flow
in test mode, Phill adds the account's **test key** (Stripe dashboard, Developers, API keys, test mode)
to `~/.hermes/.env` as `STRIPE_TEST_SECRET_KEY`. Then a session can create three test Payment Links,
pay one with Stripe's published test card, and confirm the referrer arrives on the test payment.

## Founder-only decisions (Phill)

1. **Which business sells the cards.** Recommendation: Unite Group (the Unite-Group Stripe account
   `acct_1SK3Z3…` is already registered). `[VERIFIED: connections.md]`
2. **The live Stripe account** to take payments, and the test key above for the test-mode proof.
3. **Final prices in AUD including GST**, up to $249. Indicative: $99 / $179 / $249. Whether GST is
   charged depends on the selling entity's GST registration. `[UNCONFIRMED]`
4. **Refund policy and terms text**, including the likeness consent for motion intros made from
   buyers' photos and the review-policy term for card buyers.
5. **Switching to live mode**: approving the three live Payment Links and setting `PAYMENT_LINKS`.
6. **Referral reward**: whether, and how much, a card earns when it sells another. Any reward must be
   disclosed, and never tied to reviews.

## What still won't work until those are done

- Payment (switched off, says Coming soon).
- Registered interest goes by the buyer's own email to Phill's address, because no assistant inbox is
  connected yet.
- Brand pulled automatically from the buyer's website: today the buyer uploads their logo, and we
  confirm fonts from their site when building. Synthex's brand-DNA extractor could do this automatically
  later. `[VERIFIED: app/api/brand-dna/extract/route.ts exists]`
