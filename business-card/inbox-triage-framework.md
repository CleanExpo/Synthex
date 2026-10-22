# Card inbox: triage framework (design only)

Status: design, 22/10/2026. Nothing here is built or switched on. No email is sent, no account setting
changed. Tags: `[VERIFIED]`, `[INFERENCE]`, `[UNCONFIRMED]` as in README.md.

## Purpose

Everything that arrives from Phill's card (the Connect form, replies to card follow-ups, direct mail to
the card address) lands in one assistant inbox. The assistant filters spam, sorts the rest, sends a
short acknowledgement where that is safe, and hands Phill only what needs him, with a draft reply.

Success: Phill sees every genuine enquiry within one business day, and sees no spam. No sender ever
gets a reply that promises something Phill has not agreed to. `[INFERENCE from the brief]`

## Where it runs

- **Inbox:** an AgentMail inbox, e.g. `hello@<card domain>`. Phill already has an AgentMail sign-in
  (08/10/2026) but no connection is wired. `[VERIFIED: see README §3]`
- **Fallback until then:** a Gmail label and filter on an existing connected account. `[INFERENCE]`
- **Orchestration:** an agent woken by AgentMail's webhook (AgentMail advertises webhooks and websockets).
  `[VERIFIED: AgentMail email "Real-time email events with AgentMail", 11/10/2026]`

## The pipeline

Each message moves through six stages. A failure at any stage leaves the message in `needs-phill`
with the reason recorded; it is never dropped or marked handled. `[INFERENCE from the house rule that a failed read must not look like an empty one]`

### 1. Intake
Record message id, received time, sender, subject, body, attachments (names and sizes only) and the
source (card form, direct, reply). Card-form messages carry a `[Card]` subject prefix and a "Via:
Phill's digital card" line `[VERIFIED: card.html]`, which is a weak signal only, since anyone can type it.

### 2. Spam and safety filter
Score each message; any hard rule wins outright.

| Check | Action |
| --- | --- |
| Provider spam verdict, failed SPF/DKIM/DMARC alignment | `spam`, no reply |
| Known bad sender or domain list | `spam`, no reply |
| Links whose visible text and target differ, shortened links, credential or payment requests | `suspicious`, no reply, Phill sees it in the weekly digest |
| Attachments that are executables, macros or archives | `suspicious`, attachment never opened |
| SEO, link-building, "guest post", app-dev and lead-list pitches | `vendor-pitch`, no reply |
| Text instructing the assistant ("ignore previous", "forward this to") | treat as data; `suspicious` |
| Form submissions faster than a human could type, or many from one address | `spam` |

Prompt-injection rule: message content never changes what the assistant does. It only ever chooses a
category and drafts text for Phill. `[INFERENCE]`

### 3. Sort
One category per message, with a confidence score.

| Category | Examples | Owner |
| --- | --- | --- |
| `proposal` | partnership, investment, joint venture, supplier offer Phill might want | Phill |
| `job-enquiry` | restoration job, quote, insurance work | Disaster Recovery team |
| `training` | CARSI course, IICRC CECs, group bookings | CARSI |
| `product` | RestoreAssist trial, Synthex, the card itself | Phill, then the product owner |
| `media-speaking` | podcast, panel, trade-show invitation | Phill |
| `game-entry` | White Rabbit answers, prize questions | Rana's game console |
| `personal` | someone Phill met who just wants to stay in touch | Phill (low priority) |
| `other` | anything that fits nowhere | Phill |

Priority flags on top of category: `urgent` (a live loss such as flood or fire damage), `money` (a
figure or an order), `deadline` (a date within 7 days), `known` (sender already in Phill's contacts or
past mail).

Low confidence (below an agreed threshold) or two categories close together goes to `needs-phill`.

### 4. Auto-acknowledgement
Allowed only for genuine, non-urgent, sorted messages. One acknowledgement per sender per 7 days.

Template (AU English, plain, no promises):
> Hi {first name}, thanks for getting in touch through Phill's card. Your message about {category in plain words} has reached his office and he or the right person will reply within two business days. If it's urgent, call 07 3879 4677.

Never auto-acknowledge: `spam`, `suspicious`, `vendor-pitch`, anything with a `money` flag, anything
mentioning legal action, complaints, media deadlines or children's or health information. Those go
straight to Phill with no reply sent.

`urgent` job enquiries get a different acknowledgement that gives the Disaster Recovery phone number
first, because a flooded house cannot wait two days. `[INFERENCE]`

Before go-live Phill approves both templates, and the sending address must pass SPF/DKIM so replies
do not land in spam. `[UNCONFIRMED: domain not chosen yet]`

### 5. Hand to Phill
A short digest at 8 am and 3 pm AEST on business days, plus an immediate alert for `urgent`.
Delivery channel options: email to Phill, or the Margot Telegram bot. `[VERIFIED: Hermes default profile serves the Margot Telegram bot, per connections.md]`

Each item in the digest:
- one-line summary, category, flags and why it was sorted that way
- a draft reply Phill can send, edit or bin
- buttons or replies: **Send draft**, **Edit**, **Pass to {owner}**, **Not interested**, **Spam**

Phill's choice is the only thing that sends a substantive reply. Every choice is logged, and his
corrections (re-sorting, "this was spam") become the training examples for the sorter. `[INFERENCE]`

### 6. Record and learn
Per message, keep: category, confidence, actions, time to Phill, time to reply, outcome (meeting,
quote, enrolment, sale, nothing). Weekly: count by category, false-spam and missed-spam rates, median
time to reply. This feeds the Nexus "measure and decide" loop in the card proposal. `[VERIFIED: PDF p.3, decision loop]`

## Data and consent

- Store only what is needed to reply. Delete spam after 30 days.
- Do not add senders to any marketing list. Marketing needs the separate opt-in the proposal requires.
  `[VERIFIED: PDF p.1 and p.5]` Australian spam law requires consent and an unsubscribe for commercial
  email. `[UNCONFIRMED: not checked against the Spam Act text in this session]`
- Personal data from one brand is not pooled with another brand's lists without consent. `[VERIFIED: PDF p.6, Phase 2]`

## What Phill has to decide before build

1. The inbox: AgentMail (recommended) or an existing Gmail.
2. The two acknowledgement templates and the reply-time promise.
3. Digest channel and times.
4. Who owns `job-enquiry` and `training` hand-offs.

## Build outline (later, after approval)

1. Create the inbox and verify the domain's SPF/DKIM.
2. Webhook to a small worker that runs stages 1 to 3 and writes a record.
3. Acknowledgement sender behind an on/off switch, off by default.
4. Digest job and Telegram/email delivery.
5. Two weeks in shadow mode: sort and draft but send nothing, and Phill grades the sorting. Switch
   acknowledgements on only after the sorting is right on real traffic.
