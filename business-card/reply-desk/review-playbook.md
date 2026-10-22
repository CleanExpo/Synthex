# Review playbook: asking for and replying to Google reviews

Prepared 23/10/2026 from Phill McGurk's own knowledge base (2nd Brain wiki, Sources library, Synthex skills). Read-only research; nothing here has been tested on a live profile.

Tags: `[VERIFIED: path]` = stated in that file (which may itself cite Google/ACCC). `[UNCONFIRMED]` = proposal or claim not backed by a source read here. `CONFLICT` = advice found in the knowledge base that breaks Google or ACCC rules, recorded so nobody reuses it.

Short paths used below:

- `B/` = `~/2nd Brain/2nd Brain/`
- `S/` = `/Volumes/Mini Mini 2T Storage/code/Synthex/.claude/worktrees/showpiece-business-card-4a0e4b/.claude/skills/`

## Sources read

| #   | Path                                                                                                                                   | What it is                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Date in note                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | `B/Sources/Completed/2026-10-16-synthex-ree/wave1-L2-local-eeat.md`                                                                    | Research report on local search and E-E-A-T. Cites Google's Maps contribution policy, the restriction policy, ACCC and FTC guidance, and the GBP API changelog                                                                                                                                                                                                                                                                                                               | Research cut-off 16/10/2026                     |
| 2   | `B/Sources/Completed/2026-10-16-synthex-ree/wave1-L6-zanet.md`                                                                         | Analysis of 146 Zanet Design YouTube transcripts on GBP, with each tip checked against Google policy. Videos it cites: "How to Get Your First 10 Google Reviews This Week" (youtu.be/nv-hLfuWWao), "How to Absolutely Crush Google Business Reviews in 2025" (youtu.be/0EZBRuVMmsw), "7 Breakthroughs That Finally Got My Business Seen on Google Maps" (youtu.be/twvwotqOJOE), "Small Business Owners: Are You Losing Customer Trust Because of AI?" (youtu.be/B2xXyTTwI7o) | 16/10/2026. Video publication dates not exposed |
| 3   | `B/Wiki/search-intelligence/zanet-design-doctrine.md`                                                                                  | Wiki summary of source 2                                                                                                                                                                                                                                                                                                                                                                                                                                                     | updated 2026-10-16                              |
| 4   | `B/Wiki/search-intelligence/ree-contradictions-and-open-decisions-2026-10.md`                                                          | Contradiction register (row 10 covers the review-keyword tip)                                                                                                                                                                                                                                                                                                                                                                                                                | updated 2026-10-16                              |
| 5   | `B/Sources/Completed/How I’d Start a 1-Person Local SEO Business With Claude AI in 30 Days.md`                                         | YouTube transcript, Nico (AI Ranking), youtube.com/watch?v=OgPrkwqPsko. Covers the review-request email and automated reply drafting (29:33–36:17)                                                                                                                                                                                                                                                                                                                           | published 2026-06-20, clipped 2026-08-03        |
| 6   | `B/Wiki/local-seo-one-person-claude-nico-2026-08-03-ingest.md`                                                                         | Wiki ingest of source 5                                                                                                                                                                                                                                                                                                                                                                                                                                                      | updated 2026-08-08                              |
| 7   | `B/Sources/Completed/How To Rank Fast In Your City.md`                                                                                 | YouTube transcript, Caleb Ulku, youtube.com/watch?v=AbuVsBx8cFY. Live teardown of "plumber Phoenix" GBPs, including reviews and owner replies                                                                                                                                                                                                                                                                                                                                | published 2026-07-25, clipped 2026-08-03        |
| 8   | `B/Sources/Completed/The Only 2 AI Agents I Sell to Make $48,583Month.md`                                                              | YouTube transcript, Angelo Turri. Review-request automation sold as a product                                                                                                                                                                                                                                                                                                                                                                                                | published 2026-07-06                            |
| 9   | `B/Wiki/search-intelligence/living-website-engine-2026-10.md`                                                                          | Wiki plan. Reviews engine row and "living proof" rule                                                                                                                                                                                                                                                                                                                                                                                                                        | updated 2026-10-16                              |
| 10  | `B/Wiki/search-intelligence/ree-top-50-initiatives-2026-10.md` and `B/Sources/Completed/2026-10-16-synthex-ree/REE-COMMERCIAL-PLAN.md` | Item H3 "Reputation & return-customer programme"; ACCC line                                                                                                                                                                                                                                                                                                                                                                                                                  | 16/10/2026                                      |
| 11  | `B/Sources/Completed/2026-10-16-synthex-ree/wave1-L7-seojesus.md`                                                                      | Stewart Vickers (SEO Jesus) analysis, local SEO item 9                                                                                                                                                                                                                                                                                                                                                                                                                       | 16/10/2026                                      |
| 12  | `~/2nd Brain/Wiki/knowledge/marketing/google-search-quality-rater-guidelines.md`                                                       | Wiki page on the rater guidelines (reputation research, E-E-A-T)                                                                                                                                                                                                                                                                                                                                                                                                             | Guidelines dated 11/09/2025                     |
| 13  | `S/google-business-profile/SKILL.md` (v1.1)                                                                                            | Synthex skill: reply timing, tone matrix, reply rules, AI-draft workflow                                                                                                                                                                                                                                                                                                                                                                                                     | no date                                         |
| 14  | `S/local-seo-agent/SKILL.md`                                                                                                           | Synthex skill: review generation strategy and rules                                                                                                                                                                                                                                                                                                                                                                                                                          | no date                                         |
| 15  | `S/local-seo-geo-veteran/SKILL.md`                                                                                                     | Synthex skill: verified review-policy line                                                                                                                                                                                                                                                                                                                                                                                                                                   | v0.4, 2026-10-16                                |

Searched with nothing relevant found: `B/Wiki/_archive-may-2026/google-business-profile-portfolio-search-ops-2026-05-20.md` (one line only: "AI reply drafts reviewed before publishing"); `~/.claude/skills/seo-gbp-audit/SKILL.md` and `~/.claude/skills/eeat/SKILL.md` (only passing mentions); second-brain MCP `unite_group_search` and `foo_search` (top hits were index and catalogue pages, nothing on reviews). The raw Zanet transcripts themselves were **not found on disk**. Sources 2 and 3 are summaries of them.

---

## Asking for a review

### Who and when

- Ask **every** genuine customer after a real, completed job. Don't pick only the happy ones. `[VERIFIED: B/Sources/Completed/2026-10-16-synthex-ree/wave1-L2-local-eeat.md F21, row "Reputation"]` `[VERIFIED: B/Sources/Completed/2026-10-16-synthex-ree/wave1-L6-zanet.md step 10]`
- Make the invitation neutral. Give Google's review link or QR code through a receipt, email or message. `[VERIFIED: wave1-L6-zanet.md step 10, citing support.google.com/business/answer/3474122]`
- Timing: a follow-up 24–48 hours after the job is finished. `[VERIFIED: S/local-seo-agent/SKILL.md "Ethical Tactics" 4]` Nico sends his email "after they receive the service". `[VERIFIED: B/Sources/Completed/How I’d Start a 1-Person Local SEO Business With Claude AI in 30 Days.md 30:13]` The knowledge base has no evidence that one delay works better than another. `[UNCONFIRMED]`
- Ways to send it: SMS or email with the direct review link (`metadata.newReviewUri`), or a QR code in store or on business cards. `[VERIFIED: S/local-seo-agent/SKILL.md]` A QR code on the living business card fits this approach.
- Recency matters to customers. A BrightLocal survey of US adults found most respondents care about recent reviews. That is self-reported US data, not a ranking rule. `[VERIFIED: wave1-L2-local-eeat.md F14]` So keep asking steadily rather than in one burst. `[UNCONFIRMED]`

### Letting the customer write it in their own words

- The customer chooses the star rating and the wording. `[VERIFIED: wave1-L6-zanet.md step 10]`
- Google's policy forbids merchants from requesting "specific content", including suggested keywords. `[VERIFIED: B/Wiki/search-intelligence/zanet-design-doctrine.md row 10; wave1-L2-local-eeat.md F21]`
- **Prompt questions.** No source in the knowledge base gives a sanctioned list of questions for customers. The questions below are a proposal. They are open-ended, optional and contain no keywords. Get them checked against Google's policy before use. `[UNCONFIRMED]`
  - "In your own words, how did it go?"
  - "Was there anything we could have done better?"
  - "If it helps, you're welcome to add a photo."
  - Leave out anything that names the service, suburb or a keyword, and anything that hints at a rating ("tell us what you loved"). Naming the service or suburb in a prompt is exactly what the policy forbids. `[VERIFIED: B/Wiki/search-intelligence/ree-contradictions-and-open-decisions-2026-10.md row 10]`

### Photos and video

- Zanet says photo and video reviews are worth several ordinary reviews ("10/50-star" language). That weighting is **unsubstantiated**: Google's media guidance covers how media is presented, not any ranking multiplier. `[VERIFIED: wave1-L6-zanet.md claims table row 6]`
- In March–April 2026 the GBP API added "review media", so photos attached to reviews can be read through the API. `[VERIFIED: wave1-L2-local-eeat.md F7]`
- So it is fine to say photos are welcome. Don't promise that they boost rankings, and don't make them a condition. `[UNCONFIRMED]`

### Targets

- 2–5 new genuine reviews a month per location. `[VERIFIED: S/local-seo-agent/SKILL.md]` This is an internal target, not a Google threshold.
- "Ten reviews is a breakthrough" and "4.2–4.6 stars beats 5.0" are practical rules of thumb, not Google thresholds. `[VERIFIED: B/Wiki/search-intelligence/zanet-design-doctrine.md]` Caleb Ulku also says his clients convert better below a perfect five stars. That is his anecdote only. `[VERIFIED: B/Sources/Completed/How To Rank Fast In Your City.md 1:26–1:44]`

---

## Replying to reviews

### General rules (all ratings)

- **Reply to every review**, positive and negative. Target a 100% response rate. `[VERIFIED: S/local-seo-agent/SKILL.md; B/Sources/Completed/How I’d Start a 1-Person Local SEO Business With Claude AI in 30 Days.md 35:11]`
- Reply because it builds customer trust, not as a ranking lever. Google says replies show you value feedback. Replies as a direct ranking factor are `[UNCONFIRMED]`. `[VERIFIED: S/google-business-profile/SKILL.md line 166; wave1-L2-local-eeat.md F11]`
- Personalise each reply: read what the customer actually experienced and mention specific details from the review. Never post the same reply twice. `[VERIFIED: S/google-business-profile/SKILL.md "Reply Rules"; wave1-L6-zanet.md step 11]`
- **Service and location keywords in replies: be careful.** Nico suggests naming the service and, where relevant, the location in replies to help with "Ask Maps". `[VERIFIED: B/Sources/Completed/How I’d Start a 1-Person Local SEO Business With Claude AI in 30 Days.md 35:11–35:42]` However, Zanet has **retracted** his claim that keyword-loaded replies help rankings, and the knowledge base says: "Do not turn replies into repetitive SEO text." `[VERIFIED: wave1-L6-zanet.md lines 10, 47, step 11; B/Wiki/search-intelligence/zanet-design-doctrine.md row 11]` Rule: name the service only when that is what the customer wrote about, never as a keyword insert. `[UNCONFIRMED]`
- Australian English, no emojis, no staff signatures or job titles, never defensive. `[VERIFIED: S/google-business-profile/SKILL.md "Reply Rules"]`
- Protect privacy. Settle complaints privately and don't reveal customer details in a public reply. `[VERIFIED: wave1-L6-zanet.md step 11]`
- AI may draft replies, but a person approves each one before it is published. In Synthex, the `gbp-monitor` cron stores suggestions and never sends them automatically. `[VERIFIED: S/google-business-profile/SKILL.md "AI Reply Workflow"; wave1-L6-zanet.md step 11]` Nico also sends the business owner the proposed replies to approve. `[VERIFIED: How I’d Start…md 34:19]`
- A reply counts as published only once it is approved and public, not when the API accepts the write. The API now reports reply state and policy violations. `[VERIFIED: wave1-L2-local-eeat.md F7]`

### 5-star (and 4-star)

- Tone: warm and grateful. Thank them for something specific, mention what they enjoyed, invite them back. `[VERIFIED: S/google-business-profile/SKILL.md "Tone Matrix"]`
- Length: 2–4 sentences. `[VERIFIED: S/google-business-profile/SKILL.md]`
- Respond within 72 hours. `[VERIFIED: S/google-business-profile/SKILL.md "Timing Targets"]`

### Mixed (3-star)

- Tone: appreciative and constructive. Acknowledge the feedback, mention specific improvements, offer to make it right. `[VERIFIED: S/google-business-profile/SKILL.md]`
- Respond within 48 hours. `[VERIFIED: S/google-business-profile/SKILL.md]`
- Length: no specific guidance found for 3-star replies. Use 3–5 sentences, as for negative reviews. `[UNCONFIRMED]`

### Negative (1–2 star)

- Tone: empathetic and professional. Apologise sincerely, take responsibility, offer to resolve it offline. `[VERIFIED: S/google-business-profile/SKILL.md]`
- Don't argue or justify yourself: "that wins you nothing". Thank them, say sorry, give a direct contact (owner email or phone) and ask them to get in touch so it can be fixed. `[VERIFIED: How I’d Start…md 32:17]`
- Nico says a visible, sincere fix-it reply can build more trust than a perfect rating. That is his opinion, not data. `[VERIFIED: How I’d Start…md 32:42]`
- Length: 3–5 sentences. `[VERIFIED: S/google-business-profile/SKILL.md]`
- Respond within 24 hours. `[VERIFIED: S/google-business-profile/SKILL.md]` Zanet's 24–48 hour goals are service standards, not Google deadlines. `[VERIFIED: wave1-L6-zanet.md step 11]`
- Never ask the customer to change or remove a negative review. `[VERIFIED: S/local-seo-agent/SKILL.md "Rules"]`
- Fake reviews: report them with evidence. A blank avatar proves nothing, and never try to identify or expose the reviewer. `[VERIFIED: B/Wiki/search-intelligence/zanet-design-doctrine.md row 13]`

### Watching for new reviews

- Check for new reviews daily, or weekly for low-volume businesses. `[VERIFIED: How I’d Start…md 33:13–33:27; S/google-business-profile/SKILL.md cron 5 AM UTC]`
- Merging duplicate profiles can lose review replies. `[VERIFIED: B/Wiki/search-intelligence/zanet-design-doctrine.md row 16]`

### E-E-A-T link

- Quality raters are told to research a business's reputation from outside sources, including customer reviews, when judging trust. E-E-A-T is a rater framework, not a direct ranking factor. `[VERIFIED: ~/2nd Brain/Wiki/knowledge/marketing/google-search-quality-rater-guidelines.md; wave1-L2-local-eeat.md F18–F19]`
- Google's local ranking rests on relevance, distance and prominence. Prominence includes review count and positive ratings, and ranking can't be bought. `[VERIFIED: wave1-L2-local-eeat.md F11]`

---

## Compliance

### Rules

- **Google:** no incentives, no selective asking for positive reviews, no discouraging negative reviews, no conflicts of interest, no requests for specific content, no pressuring customers to review on the spot. `[VERIFIED: wave1-L2-local-eeat.md F21, citing support.google.com/contributionpolicy/answer/7400114]`
- Google's ban on incentives is stricter than the law. Even disclosed incentives that don't depend on the rating are banned on Google. `[VERIFIED: wave1-L2-local-eeat.md line 16, F23]`
- **What Google can do if rules are broken:** block new reviews, temporarily unpublish existing reviews and ratings, or show a fake-review warning on the profile. `[VERIFIED: wave1-L2-local-eeat.md F22]`
- **ACCC:** a business must not create or arrange fake or misleading reviews, and hiding genuine negative reviews can mislead. In the Service Seeking case, business-drafted reviews published when customers didn't respond led to penalties. A customer's silence is never permission to write a testimonial for them. `[VERIFIED: wave1-L2-local-eeat.md F23, citing accc.gov.au online-reviews guidance]`
- Never write customer reviews from job notes. `[VERIFIED: wave1-L2-local-eeat.md F21]` Staff must never write reviews. `[VERIFIED: S/local-seo-agent/SKILL.md]`
- GBP API actions need the business's prior, specific, express consent. `[VERIFIED: wave1-L2-local-eeat.md F10]`

### CONFLICT: knowledge-base advice that breaks these rules (do not use)

1. **CONFLICT: review gating (Nico, source 5).** His email asks "It was great or it was bad". Great sends the customer to Google, bad goes to a private form, and the aim is to keep negative reviews from being published. `[VERIFIED: How I’d Start…md 30:46–31:47]` The wiki ingest labels this a "Google policy gray area". `[VERIFIED: B/Wiki/local-seo-one-person-claude-nico-2026-08-03-ingest.md line 73]` It is not a grey area. It is selective soliciting and discourages negative reviews, both prohibited. `[VERIFIED: wave1-L2-local-eeat.md F21; S/local-seo-agent/SKILL.md "Never gate reviews"]` Under ACCC guidance, suppressing genuine negative reviews can also mislead. `[VERIFIED: wave1-L2-local-eeat.md F23]`
2. **CONFLICT: asking for keywords in reviews (Zanet).** His tip to get mentions of your services and areas in reviews breaks the "specific content" ban. `[VERIFIED: B/Wiki/search-intelligence/ree-contradictions-and-open-decisions-2026-10.md row 10]` Nico's line about guiding customers on "what keywords they want to use" (35:11) is ambiguous: it may refer to the business's reply, but if it means the customer's review it is the same breach. `[VERIFIED: How I’d Start…md 35:11]`
3. **CONFLICT: asking only the happiest customers, and staff review quotas (Zanet).** Both are prohibited rating manipulation. `[VERIFIED: wave1-L6-zanet.md step 10]`
4. **CONFLICT: "ask satisfied customers" in Synthex's own skill.** `S/local-seo-agent/SKILL.md` "Ethical Tactics" 3 says to "train front-line staff to ask satisfied customers for reviews". That is selective soliciting. The wording should become "ask every customer". `[VERIFIED: S/local-seo-agent/SKILL.md line 252]`
5. **CONFLICT: wanting a few bad reviews (Caleb Ulku).** He says he "would actually want them to get a couple of bad reviews" to lower a perfect 5.0. Engineering the rating in either direction is manipulation. Treat this as an observation about conversions, not an action. `[VERIFIED: B/Sources/Completed/How To Rank Fast In Your City.md 1:44]`
6. **Caution: unproven claims.** The claims that review automation moves a business "from page three to page one in literally under 90 days" (Angelo Turri) and that photo reviews are worth "10/50 stars" are unproven. Don't repeat them to customers. `[VERIFIED: B/Sources/Completed/The Only 2 AI Agents I Sell to Make $48,583Month.md 10:01; wave1-L6-zanet.md claims row 6]`
