# Launch Runbook — {brand} {launchTitle}

> Template consumed by `marketing-launch-runbook`. T-0 = launch day.

## Header
- Brand: {slug}
- Launch date: {ISO}
- Tier: {soft | standard | headline}
- Owner: {founder name}
- War-room channel: {Telegram chat ID / link}
- Linear project: {team / project from .harness/projects.json}

## Phase windows
| Phase | Window | Owner | Definition of done |
| --- | --- | --- | --- |
| Build      | T-30 → T-15 | … | Positioning frozen, all assets in flight |
| Polish     | T-15 → T-7  | … | All drafts QA'd, lists segmented, tracking live |
| Pre-launch | T-7 → T-1   | … | Soft sneak-peek to inner circle, bug bash done |
| Launch day | T-0         | … | Sequenced drops shipped, war-room live |
| Amplify    | T+1 → T+7   | … | Re-share + customer-quote roundups |
| Measure    | T+7 → T+30  | … | Attribution complete, retro published |

## T-7 Gate Checks (HARD-STOP if any fail)
- [ ] Every channel UTM-tagged
- [ ] GA4 + PostHog snippets on landing pages
- [ ] Email sequence dry-run done
- [ ] Paid ads approved + budgeted
- [ ] Video assets rendered + delivered to Supabase
- [ ] Press embargo / partners briefed
- [ ] War-room Telegram pinned
- [ ] Linear tickets created per drop

## Per-day cells

### T-0 ({date})
| Time | Channel | Asset | Owner | Dependency | Gate | Contingency |
| --- | --- | --- | --- | --- | --- | --- |
| 09:00 | blog | launch-pillar-post | founder | T-1 approval | embargo lift | skip blog → lead with LinkedIn |
| 09:30 | linkedin | linkedin-post-launch | marketing | blog live | post live by 09:35 | …
| 10:00 | email | email-1-launch | marketing | list segmented | open rate >25% by 11:00 | resend with new subject T+1 |
| 11:00 | linkedin | explainer-video-60s | marketing | render complete T-1 | upload by 11:05 | post still + caption "video coming"|
| 14:00 | x | thread-launch | marketing | linkedin perf data | thread live by 14:05 | shorter 3-tweet version |

### T+1 ({date+1})
…

## Kill criteria (war-room calls)
- Critical bug discovered in trial flow → pause paid ads, hold organic.
- PR crisis → switch comms to holding statement, pull launch posts.
- Partner backs out T-1 → drop partner-shoutout, ship without.

## Post-launch retro (T+30)
- KR vs target
- Channel ROI ranking
- Attribution-credited revenue / pipeline
- 3 surprises (positive + negative)
- 3 things to do differently next campaign
