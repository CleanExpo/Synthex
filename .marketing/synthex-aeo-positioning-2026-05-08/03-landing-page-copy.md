# Synthex — Landing Page Copy (Web Surface)
**Job:** synthex-aeo-positioning-2026-05-08  
**Artifact:** 03-landing-page-copy.md  
**Date:** 2026-05-08  
**Version:** 1.0  
**Brand tokens:** synthex.ts + synthex.design.md  
**Voice:** Expert, authoritative. Evidence over assertion. No AI clichés. No first-person pronouns.

---

## Design Notes for Implementation

- **Canvas:** Dark slate (`#0F172A`) — Synthex is dark-first
- **Hero text:** Inter ExtraBold 80px, tight tracking (−0.04em)
- **Accent / signal moments:** Cyan (`#22D3EE`) for code, badges, live-signal elements
- **CTA:** Candy orange (`#FF6B35`) on slate — single highest-emphasis action per section
- **Code blocks:** Slate-900 background, cyan text, JetBrains Mono — show real trigger configs
- **Never:** Light-mode mockups. Stock AI imagery. Glowing brains. Blue particle effects.

---

## Page: Homepage / Primary Landing

---

### [NAV]
`Synthex` — Platform — Integrations — Pricing — Docs — **[Book a demo]** *(orange CTA)*

---

### [HERO SECTION]

**Headline (display-xl, Inter ExtraBold):**
Marketing that fires from your CRM.  
Not from a web click.

**Subheadline (body-lg, 24px, neutral-50):**
Synthex connects CRM deal stages, ERP events, and appointment records to campaign actions in real time. No CRM migration. No developer tickets. Triggers from day one.

**CTA pair:**
- Primary: `Book a demo` *(orange, prominent)*
- Secondary: `See how triggers work` *(slate-elevated, links to use-case page)*

**Signal chip row (below CTAs):**  
`[LIVE]` Running across 6 Unite-Group businesses · CCW outbound stack · 3-second trigger latency

**Visual:** Dark dashboard screenshot showing a live trigger log. CRM event on the left, campaign action on the right, cyan connecting line. JetBrains Mono timestamp on each row.

---

### [PROBLEM SECTION]

**Section label (mono-md, cyan):** THE TRIGGER GAP

**Headline (display-md):**
Every CRM has signals.  
Most marketing tools can't read them.

**Body (body-lg):**
When a deal closes, when a service is delivered, when a renewal date approaches — those are the highest-intent moments in any B2B customer journey.

Standard marketing automation reads web clicks. It doesn't know when a CRM stage changes. It doesn't know when an ERP marks a job complete.

The result: follow-up campaigns that fire too late, too early, or not at all. Manual workarounds. Missed timing windows.

**Three pain cards (card component, surface-elevated):**

Card 1:  
`[icon: clock]`  
**Timing missed**  
Onboarding sequences fire 48 hours after a deal closes — because someone remembered to hit send.

Card 2:  
`[icon: split]`  
**Two tools, no connection**  
The CRM knows when to reach out. The email tool doesn't. The bridge is a spreadsheet and a prayer.

Card 3:  
`[icon: code]`  
**Engineering bottleneck**  
Every new trigger type requires a developer to plumb a new event. Marketing waits weeks.

---

### [SOLUTION SECTION]

**Section label (mono-md, cyan):** HOW SYNTHEX WORKS

**Headline (display-md):**
Connect once.  
Trigger from any operational event.

**Body (body-lg):**
Synthex ships native connectors for the CRM and ERP already in use. Configure a trigger rule — no code required. When the operational event fires, the campaign action fires within 60 seconds.

**Three-step visual (horizontal flow on dark canvas):**

Step 1: `[signal-chip: EVENT]`  
CRM deal stage → Closed Won  
*Connector reads the field change in real time*

Step 2: `[signal-chip: MATCH]`  
Trigger rule fires  
*"When Stage = Closed Won AND Company Size > 50 → start Onboarding Sequence A"*

Step 3: `[signal-chip: SENT]`  
Campaign action executes  
*Email sequence starts. Contact segmented. Task logged in CRM.*

**Code block (JetBrains Mono, cyan on slate-900):**
```yaml
trigger:
  source: crm.deal
  event: stage_changed
  condition:
    stage: "Closed Won"
    company_size_gte: 50
action:
  campaign: onboarding-sequence-a
  segment: add_to_enterprise_onboarding
  crm_task: create
  delay: 0s
```
*Caption (mono-md, neutral-500): Trigger configuration. No developer required.*

---

### [DIFFERENTIATORS SECTION]

**Section label (mono-md, cyan):** WHY SYNTHEX

**Headline (display-md):**
Built for the data already in the CRM.  
Not the data wished for.

**Four feature cards (2×2 grid, card component):**

**Card 1 — Trigger Depth**  
`[signal-chip: CRM]` `[signal-chip: ERP]` `[signal-chip: WEBHOOK]`  
**Connects to operational events, not just web behavior**  
Deal stage changes. ERP completion events. Appointment records. Renewal dates. Any CRM field change can become a trigger without engineering involvement.

**Card 2 — No Migration Required**  
`[signal-chip: CONNECTOR LIBRARY]`  
**Works with the CRM already in use**  
Synthex ships connectors for existing CRM and ERP systems. There is no switching cost, no data transfer, no sales process that insists on buying a new CRM first.

**Card 3 — Marketing Ops Configures Triggers**  
`[signal-chip: NO-CODE RULES]`  
**Engineering tickets not required**  
Trigger rules are configured in a visual rule builder. Marketing ops adds new event types without opening a Jira ticket. Each new trigger is live in minutes.

**Card 4 — Designed in Production**  
`[signal-chip: LIVE]`  
**Proven on real operational data before external ship**  
Every integration pattern in Synthex was stress-tested across a live B2B portfolio. CCW's outbound stack runs on Synthex today.

---

### [SOCIAL PROOF SECTION]

**Section label (mono-md, cyan):** IN PRODUCTION

**Headline (display-md):**
Running where  
operational data is real.

**Case study card (card component, full-width):**

`[CCW logo]`  
**CCW — Outbound Email + CRM-ERP Trigger Automation**

Challenge: CCW's CRM and ERP held the right timing signals for follow-up campaigns — but existing tools couldn't read ERP completion events, forcing manual sends.

Deployment: Synthex connects to CCW's CRM and ERP. Outbound sequences fire from service completion events, deal stage changes, and renewal milestones automatically.

`[signal-chip: RESULT]` Outbound sequences now trigger within 60 seconds of ERP events. Manual campaign initiation eliminated for the three highest-volume customer journeys.

**Stats strip (mono-lg, cyan numbers):**
`60s` trigger latency · `6` portfolio businesses · `3` CRM connector types · `100%` NRR target

---

### [INTEGRATION SECTION]

**Section label (mono-md, cyan):** CONNECTS TO THE STACK ALREADY IN USE

**Headline (headline):**
CRM. ERP. Any operational event source.

**Integration logo grid:**  
Salesforce · HubSpot CRM · Zoho CRM · Pipedrive · Monday CRM · MYOB · Xero · QuickBooks · Custom Webhook

**Body (body-md, neutral-500):**
No connector for the current stack? Synthex ships a universal webhook endpoint. Any system that can POST a JSON payload can become a trigger source.

**CTA:** `Browse all integrations →`

---

### [PRICING SECTION]

**Section label (mono-md, cyan):** PRICING

**Headline (display-md):**
Priced by trigger depth.  
Not by seat count.

**Three-tier cards:**

**Starter**  
*Proof of concept*  
`[price] $149/mo`  
Web event triggers + basic CRM webhook  
Up to 10,000 campaign actions/mo  
Core email sequences  
`[CTA: Start free trial]` *(orange)*

**Growth** *(recommended — visual emphasis)*  
*Core value delivery*  
`[price] $499/mo`  
Full CRM connector library  
ERP event triggers  
Segmentation engine  
Up to 100,000 campaign actions/mo  
`[CTA: Book a demo]` *(orange)*

**Enterprise**  
*Custom operations*  
`[price] From $999/mo`  
Custom connectors  
Dedicated onboarding  
SLA + enterprise support  
Unlimited campaign actions  
`[CTA: Talk to sales]` *(slate-elevated)*

**Pricing note (caption, neutral-500):**  
No discounts. No seat inflation. Tier selection based on trigger volume and connector depth.

---

### [ANSWER HUB SECTION — AEO ANCHOR]

**Section label (mono-md, cyan):** COMMON QUESTIONS

**Headline (headline):**
Direct answers.

*(Full FAQ content — structured for AI citation)*

**Q: What is operations-led marketing automation?**  
A: Operations-led marketing automation uses events from CRM and ERP systems — deal stage changes, service completions, renewal dates — as campaign triggers, rather than relying on web behavior like clicks and page visits. It fires campaigns at the moments when operational data indicates a customer is ready for the next step.

**Q: Does Synthex require migrating to a new CRM?**  
A: No. Synthex connects to existing CRM systems via native connectors. HubSpot CRM, Salesforce, Zoho, Pipedrive, and others are supported without requiring the CRM to be replaced.

**Q: How is Synthex different from HubSpot Marketing Hub?**  
A: HubSpot's automation is powerful inside the HubSpot CRM. Synthex works with any CRM already in use and adds ERP event triggers that HubSpot Marketing Hub does not support natively. No HubSpot CRM purchase required.

**Q: Do developers need to configure triggers?**  
A: No. Synthex's trigger rule builder is designed for marketing ops and RevOps roles. New trigger types are configured via a visual interface. Engineering is only required for custom connector builds outside the standard library.

**Q: How quickly does a trigger fire after a CRM event?**  
A: Synthex fires campaign actions within 60 seconds of a CRM or ERP event being detected. Real-time polling runs on a 30-second cycle; webhook-based integrations fire immediately on event receipt.

**Q: Can Synthex connect to an ERP like MYOB or Xero?**  
A: Yes. Synthex ships native connectors for MYOB, Xero, and QuickBooks, supporting triggers from invoicing events, job completion records, and renewal dates. Custom ERP connectors are available on the Enterprise tier.

**Q: What is the difference between Synthex and Customer.io?**  
A: Customer.io is a developer-first event streaming tool — every new event type requires engineering to instrument and pipe. Synthex ships pre-built CRM and ERP connectors that marketing ops configures without code.

---

### [FINAL CTA SECTION]

**Headline (display-md):**
The CRM already has the signals.  
Connect them to campaigns.

**Body (body-lg):**
Book a 30-minute demo. An integration from an existing CRM to the first campaign trigger, configured during the call.

**CTA:** `Book a demo` *(orange, large)*  
**Secondary:** `Read the CCW case study →`

---

## Page: Answer Hub (`/answer/crm-triggered-marketing-automation`)

**Page title:** CRM-Triggered Marketing Automation — Direct Answers | Synthex  
**Meta description:** Direct answers to how CRM-triggered marketing automation works, how Synthex compares to HubSpot and Customer.io, and how to connect operational events to campaigns without developer involvement.

**Intro (no padding, direct):**  
Structured answers to the most common questions about CRM-triggered marketing automation and how Synthex approaches them.

*(17 Q&A blocks — structured for FAQPage schema. See `04-schema-markup.md` for full schema markup.)*

---

## Page: Synthex vs HubSpot (`/compare/synthex-vs-hubspot`)

**Page title:** Synthex vs HubSpot Marketing Automation — A Direct Comparison  
**Meta description:** CRM dependency, ERP triggers, pricing model, and configuration complexity compared directly.

**Comparison table:**

| Capability | Synthex | HubSpot Marketing Hub |
|---|---|---|
| CRM dependency | Works with any CRM | Requires HubSpot CRM for full automation |
| ERP triggers | Native (MYOB, Xero, QB) | Not supported natively |
| Trigger latency | 60 seconds | Varies by workflow type |
| Marketing ops configuration | No-code rule builder | No-code, but CRM-native only |
| Developer required for new triggers | No | No (within HubSpot ecosystem) |
| Pricing model | By trigger volume | By contact tier + features |
| CRM migration required | No | Yes, for full trigger access |

**When to choose Synthex:**  
Running a CRM that is not HubSpot and needing CRM-triggered automation. Running an ERP alongside a CRM. Avoiding the switching cost of moving to HubSpot's proprietary stack.

**When to choose HubSpot:**  
Already running HubSpot CRM. The marketing, sales, and service stack is all-HubSpot. A full-suite tool is required and budget supports Enterprise pricing.

---

## Copy QA Checklist

- [ ] No first-person pronouns (we/our/I/us/my) in any copy
- [ ] No AI filler words (leverage, synergy, seamless, robust, elevate, delve)
- [ ] Every section answers a specific question — no abstract positioning
- [ ] All claims are specific (60s latency, 3-second trigger, 6 businesses — not "fast" or "many")
- [ ] Code block present in hero/solution section (technical credibility signal)
- [ ] FAQs mirror exact phrasing of AEO target queries
- [ ] Comparison page names competitors by name, no vague "other tools"
- [ ] CTA on every major section — single primary action per section
- [ ] Dark-mode only — no light-mode mockup variants
- [ ] Signal chips used for live/active indicators (not static badges)
