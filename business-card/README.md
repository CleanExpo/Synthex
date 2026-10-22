# Phill's living business card: findings and prototype

Prepared 22/10/2026. Every claim carries one tag: `[VERIFIED]` (read from a source named here),
`[INFERENCE]` (reasoned from named verified material) or `[UNCONFIRMED]` (assumption or unsourced).

Client metric this moves: none directly; it is promotion for Phill and a possible Unite Group product.
This folder sits outside Synthex product code on purpose: Synthex is the group's internal marketing
agency, and the card is a separate showpiece.

## What is here

| File | What it is |
| --- | --- |
| `card.html` | The prototype card. Published privately at https://claude.ai/artifact/RPL8XEM3jmUAKXmACms55x |
| `phill-mcgurk.vcf` | The contact file a hosted version serves for one-tap "Save to contacts" |
| `inbox-triage-framework.md` | Design for the assistant inbox behind the Connect form |
| `product-sketch.md` | Sketch for selling these cards (up to AUD $249 each) |
| `steering-board.html` | Phill's decision board. Published privately at https://claude.ai/artifact/XuXp2GMawpsNjLJV3wNp37 |
| `board-seed.json` | The options written to the board's store (choices live in the store, not this file) |
| `restoreassist-staff-cards.md` | Track 2: staff cards inside RestoreAssist, what data already exists, ecosystem ideas |
| `brand-kits/` | One brand kit per card (`phill-mcgurk.json`) and `validate.py`, which rejects any unsourced value |
| `site/` | `build.py` turns `card.html` plus a brand kit into the hosted card; `hosting-plan.md` explains going live |
| `wow/` | Six Higgsfield concept briefs (`concepts.json`) with their real input images and a 10% credit cap; four ready to generate, two waiting on real photos |
| `research-notes.md` | Higgsfield in depth, review-engine rules, business list, competitor sweep, "lavish" search |

## 1. Rana's concept, and who wrote what

**Correction to the brief.** The brief said Rana wrote the email sent from Phill's address. The thread shows otherwise:

- 17/10/2026, `Phill@disasterrecovery.com.au` sent "New style of business card" to Rana and to
  `phill.mcgurk@gmail.com`, attaching `Nexus_Foundation_and_Business_Card_v2.pdf` (6 pages, "Version 2
  proposal, 17 October 2026"). `[VERIFIED: Gmail thread 1a1485af1f95b555]`
- Rana's reply on 19/10 opens: "Thank you for sharing the Nexus Foundation and Business Card proposal. I
  have reviewed the full document." She reviewed it; she did not send it. `[VERIFIED: same thread]`
- Who wrote the PDF is not stated in it. `[UNCONFIRMED]`
- Phill forwarded the whole exchange to his Gmail on 22/10. `[VERIFIED]`

**The PDF proposal (Nexus foundation and digital business card)** `[VERIFIED: PDF pp. 1-6]`
- The card is the first small test of "Nexus", a learning loop across Phill's businesses: understand a
  need, generate ideas, challenge them, run an authorised test, measure, keep what works.
- Working name "Follow the White Rabbit", story "The Missing Signal". Front door asks "What would be
  useful today?" with three choices: **Discover** (one practical idea), **Solve** (the White Rabbit game),
  **Connect** (save Phill's details).
- Discover gives a useful preview before asking for an email. Solve: event photo and reflection, white
  rabbits on Phill's slides carrying the letters T / R / U / S / T, a business-need question, a
  host-verified finale. Proposed prize: a Synthex website/positioning package, valued at A$3,500 to
  A$4,000 as an unverified target.
- Brand links: Synthex, RestoreAssist, CARSI, CleanExpo / TradeHall, NRPG, Disaster Recovery. QR or NFC
  opens the card; no app needed.
- Guardrails: separate optional marketing consent, no claims that the card "activates endorphins", no
  required Google reviews, measure useful conversations rather than email captures.

**Rana's view (email, 19/10/2026)** `[VERIFIED: thread 1a1485af1f95b555]`
> "I would keep the first pilot focused on proving one complete customer journey before extending the wider Nexus foundation."
- One simple mobile journey: tap the card, pick a business need, get one useful action, then save
  Phill's details or ask for help. Contact details reachable at every step.
- Test two prototypes side by side: a plain card and the White Rabbit version with the same value.
- Success means an attendee names a need and leaves with a relevant, actionable answer.

**Phill's direction (19/10/2026)** `[VERIFIED: same thread]`: he shares the card link in his talk at a
three-day Brisbane trade show and a Melbourne show the week after, and opening it starts the White
Rabbit game.

**Rana's build so far (email, 22/10/2026 AEST)** `[VERIFIED: message 1a15f81d859b3138, and a fetch of her preview page today]`
- A working preview with card, game, consent, uploads, host console, CSV export and Brisbane/Melbourne
  separation; six automated browser tests passed.
- Her preview runs on a temporary address. She asked that it not be printed or shared yet, so this
  folder does not link it.
- Still open per Rana: real-phone testing, permanent hosting, final domain, email delivery, and
  Phill's confirmed slides, dates, contact details, prize rules, branding and music.
- Her card shows 1300 309 361 and contact@disasterrecovery.com.au. Neither appears in the email
  signatures I read. `[UNCONFIRMED source]` Phill replied that the details need updating. `[VERIFIED]`

**How this prototype relates** `[INFERENCE from the above]`: it is a motion-led front layer for the same
three doors, not a rival to Rana's game. The Solve door should link to her game once it has a
permanent address.

## 2. Higgsfield: what it offers for mobile motion

Research done 22/10/2026 from public pages. Nothing was signed up for or bought.

- **Models.** The API hosts video families including Seedance, Kling, Wan, MiniMax, LTX, PixVerse,
  Grok and Higgsfield's own DoP. Video is billed per second. `[VERIFIED: higgsfield.ai/blog/generate-ai-videos-higgsfield-api, 16/09/2026]`
- **DoP clips** are 3 or 5 seconds. `[VERIFIED: higgsfield.ai/creator-hub/help-center/ai-models/how-do-i-use-dop]`
- **9:16 vertical** is very likely but no Higgsfield page I could load confirms it. `[UNCONFIRMED]`
- **Camera moves.** DoP "motion blueprints" are grouped as Effects, Basic Camera Control, Epic Camera
  Control and Catch the Pulse, and can be mixed. `[VERIFIED: same help page]`
- **Talking photo.** LipSync Studio animates a photo from audio or a script (Kling 2.6 LipSync, Veo 3,
  Wan 2.5 Speak, Kling Avatars 2.0); the blog advises clips under 30 seconds. `[VERIFIED: higgsfield.ai/blog/make-ai-lipsync-videos, 07/07/2026]`
  Whether the API exposes lip-sync is `[UNCONFIRMED]`.
- **API.** `api.higgsfield.ai`, keys from `console.higgsfield.ai`, header
  `Authorization: Key <id>:<secret>`, Python and TypeScript SDKs, async jobs (submit, then poll or
  webhook). Prepaid USD balance; failed jobs are not billed; Kling 3.0 quoted at US$0.112 per second.
  `[VERIFIED: docs.higgsfield.ai, docs.higgsfield.ai/docs/concepts/requests, API blog]`
- **MCP.** Official endpoint `https://mcp.higgsfield.ai/mcp`, "no API key required". `[VERIFIED: higgsfield.ai/mcp]`
  Sign-in by browser OAuth and a tool list of about 82 tools come from third parties only. `[UNCONFIRMED]`
  The `higgsfield` server is configured on this Mac but **needs Phill to authorise it via /mcp**. `[VERIFIED: session MCP status]`
- **Plan prices.** The pricing page did not render its plans for me. `[UNCONFIRMED]`
- **Rights.** Higgsfield's terms summary (effective 27/08/2026) says it does not claim ownership of
  inputs or outputs and does not restrict commercial use; uploaders must hold rights to what they
  upload. `[VERIFIED: higgsfield.ai/blog/terms-of-use-privacy-policy-update]` For paying customers we
  should get a signed likeness release regardless. `[INFERENCE]`
- **On a phone page.** Results come back as an mp4 URL kept for at least 7 days, so copy them to our
  own storage and serve a muted, looping, `playsinline` H.264 file with a still poster. `[VERIFIED for the URL lifetime; rest INFERENCE]`
- **Synthex rule.** If this is ever produced inside Synthex, generation must go through the
  real-images-only service layer, not a direct Higgsfield call. `[VERIFIED: .claude/rules/real-images-only.md]`

## 3. The agent mailbox: what exists

Searched 22/10/2026: `~/.claude/skills/library/connections.md`, `find-cred`, Gmail search and labels,
Composio connections, and env-file key names (names only, no values).

- **AgentMail.** Phill signed in to agentmail.to with Google on 08/10/2026 and received welcome emails.
  `[VERIFIED: Gmail, "You shared some Google Account data with agentmail.to"]` No AgentMail connection
  exists in Composio `[VERIFIED: Composio reports no active agent_mail connection]`, no AgentMail key name
  is in `~/.hermes/.env` (a positive control showed that file exists with 113 entries) `[VERIFIED]`, and
  `find-cred` does not know the service `[VERIFIED]`. Whether an inbox was ever created there is
  `[UNCONFIRMED]`. A Keychain check was refused by this session's safety classifier.
- **Gmail accounts connected through Composio** `[VERIFIED]`: phill.mcgurk@gmail.com,
  nrpg.team@gmail.com, zenithfresh25@gmail.com, contact@unite-group.in, support@synthex.social,
  spprtcarsi@gmail.com and airestoreassist@gmail.com. None is named as a Claude or Codex bot.
  `airestoreassist@gmail.com` may be an agent mailbox `[INFERENCE from the name only]`.
- **"Nexus Operator Bot".** A Gmail app password with that name was created on phill.mcgurk@gmail.com on
  09/06/2026. `[VERIFIED: Google security alert email]` What uses it is `[UNCONFIRMED]`.
- `connections.md` has no agent-mailbox entry. `[VERIFIED]` No Gmail label for an agent inbox exists. `[VERIFIED]`

**Recommendation:** use AgentMail for the card inbox. It is built for agent inboxes, and Phill already has
an account. His step: connect `agent_mail` in Composio (one OAuth click). Until then the card's Connect
form routes to `Phill@disasterrecovery.com.au` and is labelled PLACEHOLDER.

## 4. The prototype

Link (private to Phill until he shares it): https://claude.ai/artifact/RPL8XEM3jmUAKXmACms55x

- A 9:16 motion stage with slow water-light animation and a PM monogram, labelled **PLACEHOLDER**.
  No photo of Phill is used: none exists in the reference library `[VERIFIED: public/reference-library has carpet, upholstery and water-damage sets only]`.
- A white rabbit hops into the stage after 3.5 seconds; tapping it unlocks a "first rabbit" message
  that points to the talk. This is the hook that makes people show it to someone else. `[INFERENCE]`
- Save to contacts, mobile, office, email and share. In the claude.ai preview the contact file cannot
  download (the viewer blocks downloads and does not allow `.vcf`), so a copyable fallback appears.
  On a normal web host the same button downloads the vCard. `[VERIFIED: Artifact publish warning and downloads allowlist]`
- Discover with four needs and draft advice, marked "not yet approved by Phill".
- Solve, with the game link marked PLACEHOLDER until Rana's game has a permanent address.
- Connect: an enquiry form that prepares the message for review. It sends nothing itself.
- Checked at 390 px wide in a local browser: no horizontal scroll, one console error (a missing
  favicon on the test server, not the card). `[VERIFIED: Playwright screenshot 22/10/2026]`
  Not checked on a physical phone. `[UNCONFIRMED]`

**Contact details used** `[VERIFIED: Phill's email signatures]`: mobile +61 457 123 005,
phill.m@carsi.com.au (CARSI signature); office 07 3879 4677 and Phill@disasterrecovery.com.au
(Disaster Recovery signature). Showing his mobile on a card handed out to a trade-show crowd is Phill's
call; the business line can replace it in one edit.

**Photos Phill needs to supply** (his own, or ones he holds rights to):
1. A head-and-shoulders portrait, looking at camera, plain background, at least 2000 px tall.
2. A three-quarter portrait in work context (on a job site or teaching at CARSI).
3. One or two action shots: speaking on stage, or with restoration equipment.
4. Optional: a 10-second voice memo reading a one-line welcome, for a talking-card version.

With these, the stage becomes a 5 to 6 second Higgsfield loop (a slow push-in camera move on the
portrait), re-encoded to a small looping mp4 with a still poster.

## Phill's steps

1. Authorise the `higgsfield` MCP server via /mcp (then supply the photos above).
2. Connect `agent_mail` in Composio, or tell us which mailbox he meant.
3. Confirm the contact details to show publicly.
