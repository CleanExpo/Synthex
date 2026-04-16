# Ask Synthex Anything — Product Positioning & Sprint 9 Roadmap

**Sprint 8 | April 2026**
**Decision ref:** SYN-680 (Board Innovation Session 32) | **Execution ref:** SYN-683

---

## Premium Tier Unlock Language

### Tier Structure

| Tier                 | Price           | What You Get                                                                                                                      |
| -------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Synthex Standard** | $79/month       | AI Advisor weekly brief · All dashboards · Content calendar · Health Score · Monthly Story                                        |
| **Synthex Premium**  | $149–$199/month | Everything in Standard · **Ask Synthex Anything** · Full multi-signal synthesis · Opus-tier strategy responses · Priority support |

### Positioning Copy

> "Your AI marketing partner that actually knows your business — ask it anything about your performance, anytime."

**Short form (SMS/notification):** "Ask Synthex Anything — Premium is live. Ask your first question today."

**Long form (email/in-app):** "Most marketing tools tell you what happened. Synthex tells you _why_ it happened — and what to do next. Upgrade to Premium and ask anything: why did my posts drop last week? What should I change before summer? Is my Health Score improving? Synthex answers from _your_ data, not industry averages."

### Objection Handling

**Objection 1: "I don't know what to ask it."**
Synthex answer: "You don't have to. Every Ask Synthex session starts with three suggested questions based on your last 30 days of data — written in plain English, not marketing jargon. Tap one, or type your own."

**Objection 2: "I already get the weekly brief — isn't that enough?"**
Synthex answer: "The weekly brief is Synthex pushing the right information to you on schedule. Ask Synthex is you getting the answer you need _right now_, whenever something changes. Your weekly brief tells you what to do this week. Ask Synthex answers 'why did this happen yesterday?'"

**Objection 3: "How is this different from ChatGPT?"**
Synthex answer: "ChatGPT answers from the internet. Ask Synthex answers from your 192 posts, your Health Score, your brand voice, your algorithm alignment scores, and your 90-day content history. It can't tell you about Dave's Plumbing in Parramatta — only Synthex can, because only Synthex has Dave's data."

**Objection 4: "I'm not a tech person — will I understand the answers?"**
Synthex answer: "Every answer is written at the same level as a text from a smart mate who happens to know marketing. No jargon. If Synthex recommends something specific, it tells you exactly why in one sentence. If it doesn't know, it says so."

---

## Three-Phase Product Narrative Arc

### Phase 1 — Proactive Advisor (Sprints 1–7): _Synthex pushes the right information to you at the right time_

**Value proposition:** You don't have to check anything. Synthex monitors your marketing and tells you what matters, every Monday morning.

**Concrete example (tradie client):** Dave is a plumber in Parramatta. Every Monday he gets a brief that says his Facebook posts are getting 40% more engagement than last month, his Health Score went from 62 to 71, and his single action for the week is to post a before-and-after job photo by Thursday. Dave doesn't have to log in to find this out — it arrives in his inbox.

---

### Phase 2 — Conversational Intelligence (Sprint 8): _Synthex answers any question about your business, grounded in your data_

**Value proposition:** When something changes — good or bad — you can ask why and get a real answer in under 3 seconds, cited from your own data.

**Concrete example (tradie client):** Dave's engagement dropped last Tuesday. Instead of waiting for Monday's brief, Dave opens Synthex and types: "Why did my posts get so little engagement last week?" Synthex responds: "Your last 4 posts were published between 7–9am Tuesday–Friday. Your audience is most active 6–8pm on weekdays. Your caption length was also 23% shorter than your best-performing posts this month. Recommended: shift your next 3 posts to 7pm weekday slots and add a 1–2 sentence call to action." Sources: 192 posts · engagement data · Algorithm KB entry #4.

---

### Phase 3 — Autonomous Client Concierge (Sprint 9+): _Synthex detects, decides, and acts without being asked_

**Value proposition:** You don't have to ask. Synthex monitors everything and reaches out _to you_ the moment something needs attention — with a specific recommendation already prepared.

**Concrete example (tradie client):** Dave hasn't needed to ask anything this week. On Wednesday morning, Synthex sends Dave a push notification: "I noticed your engagement dropped 22% vs your baseline last Tuesday. I've reviewed your last 8 posts — here's what I found and what I've already adjusted in your calendar for next week." Dave taps the notification, reads a 3-line summary, and approves the calendar change in one tap. He never had to log in.

---

## Sprint 9 Client Concierge Brief

### What It Is

Synthex proactively monitors each client's data for anomalies — without the client having to ask — and initiates a conversation through push notification + in-app message with a specific recommendation already formed.

The query engine built in Sprint 8 (SYN-681) powers this system: the same `client-context-query` Edge Function used for pull-mode (client asks → Synthex answers) is inverted for push-mode (Synthex detects → Synthex initiates).

### Trigger Signals

| Signal                      | Threshold                   | Source                                     |
| --------------------------- | --------------------------- | ------------------------------------------ |
| Engagement drop             | >20% below 30-day baseline  | `client_journey_events.engagement_outcome` |
| Health Score decline        | ≥5 points in 7 days         | `health_score_events`                      |
| Missed posting window       | 3+ days past scheduled slot | `calendar_posts`                           |
| GEO Score change            | ±10 points                  | `geo_score_events`                         |
| Pulse survey low confidence | Score ≤2 on 1–5 scale       | `client_journey_events` metadata           |

### Example Concierge Trigger

> "I noticed your engagement dropped 22% vs. your baseline last Tuesday. I've reviewed your last 8 posts — here's what I found and what I've already adjusted in your calendar for next week."

### Required Data Sources

- `conversation_events` — anomaly patterns surfaced during Sprint 8 internal review period
- Health Score intervention signals (SYN-615)
- `journey_analytics` materialized view (SYN-678)
- Content Performance Profiles (Algorithm KB entries)

### Engineering Estimate

**4–5 days.** Foundation: `client-context-query` Edge Function (SYN-681), inverted from pull to push. New components:

- Anomaly detection cron (daily, per-client)
- Push notification trigger (Supabase Realtime → push provider)
- In-app concierge message component (extends `AskSynthexPanel`)

### Sprint 9 Gate Conditions

All three must be true before Sprint 9 scope is locked:

1. Sprint 8 out-of-scope question rate <30% (measured from `conversation_events.failure_reason`)
2. AI accuracy gate >55% across 3+ core systems (measured from `score_accuracy_events`)
3. At least 1 client question from the internal review period qualifies as a Concierge trigger template (pattern documented in `board-cron/decisions/sprint9-concierge-triggers.md`)

---

## White-Label Partner API — Sprint 10 Gate Conditions

The white-label partner API is a distribution play: agencies resell Synthex under their own brand to their SMB clients. It requires a product so well-proven that agencies stake their client relationships on it.

**All five conditions must be true before Sprint 10 scope is confirmed:**

1. **Conversational out-of-scope rate <30%** — measured from `conversation_events` over minimum 30-day period with ≥5 active clients
2. **AI accuracy gate >55%** — across 3+ core systems (AI Advisor, Health Score, Content Intelligence Engine) as measured by `score_accuracy_events` 48h outcome matching
3. **At least 3 published case studies** — showing measurable, named client ROI (e.g. "Dave's Plumbing: 40% engagement increase, 3 new enquiries attributed to Synthex in 90 days")
4. **Platform WCAG AA ≥95%** — measured by automated axe-core audit across all client-facing pages
5. **Stripe E2E production checkout resolved** — SYN-536 fully shipped and tested in production

**If any condition is unmet at Sprint 10 planning:** scope shifts to the condition furthest from passing, not to a new feature area.

---

## Monitoring & Review Schedule

| Checkpoint                   | Date                   | Trigger                                                       |
| ---------------------------- | ---------------------- | ------------------------------------------------------------- |
| Internal review period opens | Sprint 8 Week 1 launch | `ENABLE_ASK_SYNTHEX_CLIENT_ROLLOUT=false` — owner access only |
| 14-day review complete       | Sprint 8 Week 3        | Phill reviews all `conversation_events` in Supabase           |
| Client rollout decision      | Sprint 8 Week 3        | Toggle flag if out-of-scope rate <60%                         |
| Accuracy checkpoint          | Sprint 8 Week 3        | Check `score_accuracy_events` aggregate                       |
| Sprint 9 gate review         | Sprint 9 planning      | Check all 3 gate conditions above                             |
| Sprint 10 gate review        | Sprint 10 planning     | Check all 5 white-label conditions above                      |
