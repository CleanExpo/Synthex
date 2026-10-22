# Living business cards: product sketch

Status: idea only, 22/10/2026. No pricing page, payments or billing exist or are proposed here. Tags:
`[VERIFIED]`, `[INFERENCE]`, `[UNCONFIRMED]` as in README.md.

## The offer in one line

A business card people open from a link or a tap: a few seconds of motion made from your own photos,
your details saved in one tap, and a contact form that an assistant answers for you.

## Who buys it `[INFERENCE: from Phill's audience at trade shows and his businesses]`

- Tradespeople and restoration owners who meet clients on site and at expos.
- Trainers, speakers and consultants who want a talk to end in a saved contact.
- Small-business owners who want to look ahead of their competitors.

First test market: people Phill meets at the Brisbane and Melbourne shows who ask "where do I get one?"

## Price point

Phill's ceiling: **up to AUD $249 per card**. `[VERIFIED: the brief]` Suggested shape, to test rather
than publish `[INFERENCE]`:

| Tier | What's included | Indicative price (AUD, inc. GST) |
| --- | --- | --- |
| Card | Hosted card page, details, save to contacts, QR code, 3 brand links | $99 |
| Living card | Card plus one motion loop made from the buyer's own photos | $179 |
| Living card + inbox | Living card plus contact form, spam filtering and auto-acknowledgement, 12 months | $249 |

Optional add-on later: an NFC card that opens the link. Hosting beyond 12 months would need a small
yearly renewal; that decision is open. `[UNCONFIRMED]`

## What it costs us to make one `[UNCONFIRMED: estimates, not quotes]`

- Motion loop: one or two 5-second generations. At the published Kling 3.0 API rate of US$0.112 per
  second `[VERIFIED: Higgsfield API blog, 16/09/2026]`, two attempts at 5 seconds is about US$1.12, under
  AUD $2. Plan prices for the web app were not visible. `[UNCONFIRMED]`
- Hosting a static page and a small video: low on a static host. `[INFERENCE]`
- Inbox: AgentMail pricing not checked. `[UNCONFIRMED]`
- The real cost is people time: intake, approval and fixes. Target under 45 minutes of staff time per
  card once templated. `[INFERENCE]`

## How each card gets made

1. **Intake form**: name, title, phone(s), emails, website links, brand colours, logo, and 3 to 5
   photos the buyer owns. The buyer signs a likeness and rights release for AI-generated motion from
   their photos. `[INFERENCE: Higgsfield's terms put upload rights on the uploader, README §2]`
2. **Check**: photos are real, sharp and theirs; contact details are spelled right. Reject stock or
   other people's photos.
3. **Motion**: generate 2 or 3 camera-move variants from the best portrait, pick one, re-encode to a
   small muted loop with a still poster. Never invent a face or a scene the buyer did not supply.
4. **Assemble**: fill the card template (this prototype is the base), generate the vCard and QR code.
5. **Proof**: send the buyer a private preview link; they approve or ask for one round of changes.
6. **Go live**: publish at a permanent address, e.g. `cards.<domain>/<name>`. Set up the inbox tier if
   bought.
7. **Hand over**: link, QR code as PNG and SVG, a 20-second "how to share it" note.

Turnaround target: 3 business days. `[INFERENCE]`

## Why people ask for one `[INFERENCE]`

- The moment someone saves the contact, the card has done what a paper card rarely does.
- The motion makes people show it to the person next to them, which is free promotion.
- The hidden rabbit, or a buyer's own small surprise, gives them a reason to talk about it.
- "Made by Unite Group" in the footer turns every card into a lead.

## Risks and limits

- AI likeness: buyers must own the photos and consent in writing. No celebrity or third-party faces.
- Deliverability: an assistant inbox that replies needs a verified sending domain, or replies land in spam.
- Phone quirks: one-tap contact saving works differently on iPhone and Android and must be tested on
  both before selling. `[UNCONFIRMED: not tested on devices in this session]`
- Scope: Synthex is internal and is not the vehicle for selling this. If the group sells cards, it is a
  separate Unite Group offer. `[VERIFIED: Synthex CLAUDE.md, FD-8]`

## Decisions for Phill

1. Whether to test the offer at the Brisbane show (a sign-up list only, no payment taken).
2. Which tier to lead with.
3. Whether the card footer carries "Made by Unite Group".
