# Research notes: steering board, Higgsfield, review engine, businesses

Prepared 22/10/2026 for the Card Steering Board (https://claude.ai/artifact/XuXp2GMawpsNjLJV3wNp37).
Tags: `[VERIFIED]` read from the named source, `[INFERENCE]` reasoned from named material, `[UNCONFIRMED]`
assumption or second-hand. Research was read-only: nothing was signed up for, generated, spent or sent.

## 1. "Lavish"

No tool, skill, plugin or connector called "lavish" exists in any place searched: the local skills,
commands and plugins folders, the claude.ai plugin catalog, the MCP connector registry and Composio.
`[VERIFIED: searches on 22/10/2026 returned no match]` The closest match is **Lovable** (lovable.dev),
an AI app builder with an official connector ("Build, iterate, inspect, and deploy Lovable apps"). It
is not connected. `[VERIFIED: MCP registry]` Whether Phill meant Lovable is `[UNCONFIRMED]`. The
steering board does the "pick, approve, drag" job without it.

## 2. Higgsfield

**Access.** Phill connected Higgsfield in another session. In this session the `higgsfield` tools did
not load (ToolSearch "+higgsfield" found nothing). `[VERIFIED]` So the credit balance, plan and preset
lists are unread, and everything below comes from public pages. `[VERIFIED]`

| Capability | What it does | Source |
| --- | --- | --- |
| Image-to-video (DoP) | One photo to a 3 or 5 s clip with camera presets (Effects, Basic, Epic, Mix) | help centre "how do I use DoP" `[VERIFIED]` |
| Other video models | Kling 3.0, Veo 3.1, Seedance, Wan, MiniMax, LTX, PixVerse | API blog 16/09/2026 `[VERIFIED]` |
| Lipsync Studio | Photo plus audio or script to a talking clip; under 30 s; Veo 3 is 58 credits per 1080p clip | Higgsfield lipsync blog `[VERIFIED]` |
| Voice cloning | MiniMax Speech 2.8 HD, 40 credits (US$2) per clone, sample up to 2 min | Higgsfield voice blog `[VERIFIED]` |
| 3D | `image_to_3d`, `multi_image_to_3d`, `tripo_3d`, rigging job types | github.com/higgsfield-ai/cli `[VERIFIED]`; formats `[UNCONFIRMED]` |
| Websites | `website create`, `deploy`, `rename --subdomain`; `publish` lists on a community feed | Higgsfield CLI `[VERIFIED]`; custom domains `[UNCONFIRMED]` |
| Virality predictor | Scores hook, attention and retention for a video; no published validation | CLI and Product Hunt write-up `[VERIFIED]` |
| Marketing / Ads studio | Product ads and UGC from a URL or image, variants, brand kits | help centre `[VERIFIED]` |
| Soul ID / AI Influencer | Consistent face across clips; virtual characters | help centre `[VERIFIED]` |
| MCP | `https://mcp.higgsfield.ai/mcp`, no API key, needs an active subscription | higgsfield.ai/mcp and help centre `[VERIFIED]` |
| API billing | Async jobs; failed and NSFW jobs not charged; outputs kept at least 7 days; API credits expire after 1 year | docs.higgsfield.ai billing page `[VERIFIED]` |

**Terms that matter.** Outputs are the user's and usable commercially but not guaranteed unique (ToS
§4.4, §13.2). Uploads may be used for model training unless deleted; Enterprise can opt out (§4.4).
Visibility may default to the most permissive setting (§3.2), so set it to private. `[VERIFIED by the research agent from higgsfield.ai/terms-of-use-agreement, updated 26/07/2026]`

**Plan prices** conflict across sources and the official pricing page did not render. `[UNCONFIRMED]`
A credit works out at roughly US$0.05 to US$0.06. `[INFERENCE from 40 credits = US$2.00]`

**What this means for the card.**
- A 5 s push-in intro from one real portrait: about US$10 to 15 for 3 to 5 takes. `[INFERENCE]`
- A greeting in Phill's *real* recorded voice, lip-synced: a few dollars, and no voice handed over for
  training. Recommended over cloning. `[INFERENCE]`
- 3D suits the physical card or a logo, not Phill's face. `[INFERENCE]`
- Host on the group's own domain and use Higgsfield only to make media, because outputs expire and its
  sites sit outside our hosting. `[INFERENCE]`
- Synthex's real-images-only rule applies if any of this runs inside Synthex. `[VERIFIED: .claude/rules/real-images-only.md]`

**Spend gate.** No generation has been run. Each paid step needs Phill's OK with a quoted cost.

## 3. Review engine: what the rules allow

**Google** `[VERIFIED: support.google.com/contributionpolicy/answer/7400114]`
- "Fake engagement is not allowed and will be removed."
- Content must be "based on a real experience".
- Businesses must not offer "payment, discounts, free goods and/or services" for reviews.
- Businesses must not "selectively solicit positive reviews from customers" (review gating).
- Businesses must not "request that specific content be included".
- Asking is fine "without offering incentives ... or attempting to influence the rating or the contents".

**Google consequences** `[VERIFIED: support.google.com/business/answer/14114287]`: violating reviews are
removed, and a profile can be blocked from new reviews for a period, have existing reviews unpublished,
and show customers a warning that fake reviews were removed.

**ACCC (Australian Consumer Law)** `[VERIFIED: accc.gov.au online product and service reviews page, read via Exa]`
- It is illegal to "create fake or misleading reviews" or to "arrange for others to create" them.
- A review edited by someone else after it was written can be misleading.
- Any incentive must apply whatever the review says, and be clearly disclosed.
- Penalties: Service Seeking let businesses draft their customers' reviews ($600,000); HealthEngine
  suppressed negative reviews ($2.9m). `[VERIFIED: same page]`
- The ACCC's December 2023 sweep says review services may be "knowingly concerned" in a client's
  breach, which is the risk if Unite Group sells a non-compliant engine. `[VERIFIED: accc.gov.au/system/files/online-review-and-testimonials.pdf]`

**Spam Act** `[VERIFIED: acma.gov.au/avoid-sending-spam]`: review-request emails and texts need consent,
sender identification and an unsubscribe.

**So, as first described**, three parts break the rules: a prize spin tied to reviewing, a pre-written
"perfect" review the customer only approves, and posting through the customer's account. Asking only
happy customers would add review gating. `[INFERENCE from the lines above]`

**Recommended, rule-safe design** (on the board as r1, r2, r3, r5) `[INFERENCE]`
1. The spin is the fun way in. It reveals a tip or a thank-you. No prize is tied to reviewing.
2. Three or four neutral taps about the real job. No star imagery, no "tell us what you loved".
3. Optional "help me word it": AI drafts only from the customer's own answers and keeps any criticism.
   It adds no keywords, staff names or claims. The customer edits or deletes any of it.
4. One tap copies the text and opens Google's own review page for the right business. The customer picks
   the stars and posts from their own Google account.
5. Everyone sees the Google button. "Tell us privately" sits beside it, never instead of it.
6. A log of who was asked and when proves there is no gating. Card buyers get the same locked flow.

Whether AI wording from the customer's own answers is acceptable is not addressed directly by Google's
Maps policy. `[UNCONFIRMED]` Keeping the customer as author and editor is the safest reading.

## 4. Phill's businesses (for the card's links)

From the Unite-Group portfolio registry (`.portfolio/PORTFOLIO.yaml`, parent company Unite-Group Nexus Pty Ltd). `[VERIFIED]`

| Business | Address | Registry purpose |
| --- | --- | --- |
| Unite Group | unite-group.in | Parent group site |
| Disaster Recovery | disasterrecovery.com.au | DR consumer product |
| CARSI | carsi.com.au | Online training LMS |
| RestoreAssist | restoreassist.app (not .com.au) | Restoration product |
| NRPG | nrpg.business | Contractor platform |
| Synthex | synthex.social | Marketing platform (internal agency, FD-8) |
| ATO app | ato-ai.app | Tax/accountant app |

**CCW** (Carpet Cleaners Warehouse, ccwonline.com.au) is listed as "CCW client CRM product": a client
the group builds for, not Phill's own business. `[VERIFIED]` Showing it as a partner needs Toby's OK.
`[INFERENCE]` CleanExpo247 / TradeHall have repos but no live domain in the registry. `[VERIFIED]`

## 5. Market sweep (competitors)

| Product | What stands out | Price shown | Source |
| --- | --- | --- | --- |
| Blinq | Free tier with wallet card; lead capture; CRM sync | Premium $9.99/mo | blinq.me/pricing `[VERIFIED]` |
| HiHello | Wallet card; Salesforce/HubSpot; consent-based lead forms | Pro $6/mo | hihello.com/pricing `[VERIFIED]` |
| Popl | Wallet and Watch; AI badge scanner | Pro $7.99 | App Store `[VERIFIED]` |
| Linq | NFC plus app | $29/mo or $249/yr | linqapp.com/pricing `[VERIFIED]` |
| Tapt (Australian) | Custom NFC card; sold via Officeworks | $99 card; team fee $99-199/yr | tapt.io `[VERIFIED]` |
| V1CE, Dot, Mobilo | One-off NFC devices, free software | £59.99, $30-100, $19.99-139 | their pricing pages `[VERIFIED]` |

Prices are USD unless stated; Tapt's currency was not stated on the page. `[UNCONFIRMED]`

**The gap:** every competitor sells to corporate networkers and event teams. None offers trades job
proof, verified credentials or a rule-safe review flow. `[INFERENCE from the pages above]` Phill's AUD
$249 ceiling sits at Linq's yearly price and above most others, so the review engine and done-for-you
motion intro have to justify it. `[INFERENCE]`

Standout ideas from the sweep are on the board as g1 to g9.
