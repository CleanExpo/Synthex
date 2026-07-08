# CARSI H5 Bird Flu Course-Launch Campaign Pack

Campaign ID: `carsi-h5-launch-2026-07-08`
Generated: 2026-07-08 (Australia/Brisbane, +10:00)
Agency of record: Synthex (Unite-Group internal marketing platform)
Client: CARSI

## What is launching

CARSI's new course is going live:

- Course page: https://carsi.com.au/courses/avian-influenza-awareness-restoration-iaq-facilities
- Campaign hub (already live, source-checked 5 July 2026): https://carsi.com.au/avian-influenza-readiness

The course — "Australian H5 bird flu awareness for restoration, cleaning, IAQ and
facility teams" — is the first module of CARSI's 7-module H5 readiness pathway. It
teaches reporting-first behaviour, worker safety, clean-before-disinfect discipline,
field documentation and professional boundaries, using official Australian
Government wording throughout.

## Objective

1. **Course enrolments** — drive restoration, cleaning, IAQ and facility
   professionals to the course page and hub.
2. **Authority** — establish CARSI as the calm, official-source-led voice for
   Australian H5 readiness training, not a fear-based one.

This pack does not promise rankings, enrolment numbers or reach. It documents
publish-ready, truth-gated content and the exact steps to schedule it once the
social channels are connected.

## What is in this pack

| File | Purpose |
| --- | --- |
| `README.md` | This overview + guardrail summary. |
| `platform-drafts.md` | 30 days of content — 12 LinkedIn posts, 10 Facebook/Instagram captions, 2 email newsletters, 1 blog-length launch article. Every post carries a claim-source footnote. |
| `scheduler-payloads.json` | Machine-ready array of social posts mapped to the Synthex scheduler shape (`platform`, `content`, `mediaUrls`, `suggestedScheduleAt`, UTM-tagged links). |
| `evidence-manifest.json` | Cite-or-cut ledger: every claim -> its source. |
| `source-register.md` | Human-readable source list + verified-asset register. |
| `publishing-handoff.md` | Honest channel status + the exact founder steps to connect LinkedIn / Meta and load the scheduler payloads. |

## Verified assets featured (all Cloudinary)

- **Reporting-pathway infographic** (hero visual):
  `https://res.cloudinary.com/dmaulkthb/image/upload/v1783511574/carsi/infographics/avian-influenza-reporting-pathway.svg`
- **Course hero image**:
  `https://res.cloudinary.com/dmaulkthb/image/upload/v1783511591/carsi/admin-courses/6642e5e7-cf59-4e4c-9cff-a83c2fe5393a.png`
- **Course audio overview** (2-voice, ~6 min):
  `https://res.cloudinary.com/dmaulkthb/video/upload/v1783511771/carsi/course-audio-overview/4edda90b-4276-4ffc-b49f-3000b33cf95a.mp3`
- **Narrated video overview** — rendering at time of writing. A clearly-marked
  placeholder slot is reserved (LinkedIn post LI-12); `mediaPending` is set in
  `scheduler-payloads.json`. Do not schedule that post until the video URL is
  confirmed HTTP 200.

## Binding guardrails (absolute)

This pack was written against three binding guardrails. Every draft complies.

1. **Calm, official-source tone.** Reflects the Australian Government position, not
   speculation and not fear-based marketing. Source: CARSI campaign brief
   `docs/campaigns/2026-07-04-avian-influenza-readiness-30-day-ecosystem.md`.
   - **Do say:** report sick or dead birds or animals to **1800 675 888**; do not
     touch them; professional restoration/IAQ members assist under authority
     direction; cleaning before disinfection is a core control principle; dry-fog /
     Halo / Halosil / NeoSan training is label-led, SDS-led and legally compliant.
   - **Do not say:** Australia has a mass outbreak; poultry / food supply /
     agriculture is infected unless DAFF states it; a product kills H5N1 unless the
     claim is on-label, legally valid in Australia and evidence-backed; dry fogging
     is required by Australian Government control measures; CARSI / RestoreAssist /
     DisasterRecovery / NRPG replaces government, veterinary, wildlife or
     public-health authorities.
   - Official status is always attributed to DAFF and dated (the 5 July 2026 DAFF
     update). Readers are pointed to current DAFF advice.

2. **IICRC terminology (licence-critical).** Only ever "IICRC CEC Accredited"
   phrasing — the word "Accredited" appears only alongside "CEC". Never "IICRC
   accredited course(s)", never any implication that CARSI delivers IICRC
   certification. Where risk was uncertain, IICRC is omitted entirely.

3. **Australian English throughout.** No US spellings. No phone numbers in
   marketing **except** the government hotline **1800 675 888** (CARSI enquiries
   route to the Margot chat on carsi.com.au — GP-454).

## Self-check performed before commit

Grepped the whole pack for: banned IICRC phrasings ("IICRC accredited",
"IICRC-accredited", "IICRC certification course", bare "IICRC Accredited" without
CEC), US spellings (color, mold, organize, sanitize as a verb), fear words used as
descriptors (outbreak / crisis / emergency — the proper noun "Emergency Animal
Disease Hotline" is retained as the official name), and any product-kills-H5N1
claim. Result: 0 hits. See `publishing-handoff.md` for the audit summary.

## Channel status (honest)

- **CARSI LinkedIn:** blocked — `oauth_connection_missing`. Not connected.
- **Meta (Facebook/Instagram):** blocked — pending Meta-console owner tasks.
- **Owned media (blog + email):** ready to publish after final human review.

No post in this pack is "live". Nothing may be marked live without a platform
receipt. Founder connection steps are in `publishing-handoff.md`.
