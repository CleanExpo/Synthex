---
phase: nexus-viral-productionise
workstream: WS4c
plan: WS4c
type: execute
baseline: origin/main @ f3fd9cf3
model: sonnet
title: Release surface - studio tab grouped by hero (video preview, per-cut release)
---

<objective>
A purpose-built release surface: a studio tab grouping queued_human_gated cuts
by hero, with per-cut video preview, caption, read-only YouTube search package,
and per-cut Release/Hold/Reject calling the WS4b route. Spec section 9 WS4
(release surface), section 10 (UX).
</objective>

<context>
@app/dashboard/marketing-agency/[client]/studio/page.tsx  # existing studio page - the release tab is added HERE (grouped-by-hero). Confirm the tab pattern in this file before editing.
@app/api/publish-queue/release/route.ts   # (WS4b) POST { itemIds } - the action this UI calls
@lib/calendar/types.ts                     # CalendarSlot.video{url,thumbnail} + youtube{title,description,tags} (WS4a) - the preview + YT search-package fields
@hooks/use-api.ts                          # useApi()/useMutation() for the release action; useApiSWR for listing - keys MUST be org-scoped (SYN-908)
@lib/video/social-derivation.ts            # queued_human_gated rows anchor to a hero via metadata - grouping key

Constraint: AU English copy. Read-only YT metadata at release (no editing UI - out of scope section 5). NO live publish from the UI - Release only flips to pending via the human route; the priced YouTube publish proof is Phill's. Org-scoped SWR keys.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Release list API + org-scoped hook</name>
  <files>app/api/publish-queue/release/list/route.ts, hooks/use-release-queue.ts</files>
  <action>
GET route returning queued_human_gated publish_queue items for the effective org, grouped by hero (hero thumbnail, topic, 8-cut progress), each cut carrying video.url/thumbnail, caption, platform badge, youtube search package, and lastError. Owner/admin RBAC + org-scope. Hook use-release-queue wraps useApiSWR with an ORG-SCOPED key (SYN-908) so a brand switch never serves another brand's cuts. Real DB data only (no mock).
  </action>
  <verify>npx jest --config jest.worktree.cjs publish-queue/release/list: returns only this org's queued_human_gated rows grouped by hero; cross-org excluded; empty org -> empty groups.</verify>
  <done>Release list is org-scoped, grouped by hero, real data; hook key is org-scoped.</done>
</task>

<task type="auto">
  <name>Task 2: Release tab UI - hero groups + per-cut cards + actions</name>
  <files>app/dashboard/marketing-agency/[client]/studio/page.tsx, components/video/ReleaseQueueTab.tsx, components/video/ReleaseCutCard.tsx</files>
  <action>
Add a Release tab to the studio page. ReleaseQueueTab: batch header per hero (thumbnail, topic, 8-cut progress); empty state 'No cuts awaiting release'. ReleaseCutCard: <video> preview from storage video.url, platform badge, caption, YT card shows the read-only search package, per-cut Release/Hold/Reject with per-cut state, error state showing lastError on failed dispatch. Release/Hold/Reject call the WS4b route via useMutation (per-cut itemIds); partial release is explicit (release some, hold others). AU English copy. Disable Release while a mutation is in-flight.
  </action>
  <verify>npx jest --config jest.worktree.cjs ReleaseQueueTab ReleaseCutCard (React Testing Library, mocked hook): renders hero groups + cut cards; empty state; Release click posts the cut's itemId; error state shows lastError; partial release leaves held cuts untouched.</verify>
  <done>Release surface renders grouped cuts with previews and per-cut gated actions; partial release supported.</done>
</task>

</tasks>

<verification>
- [ ] npm run type-check && npm run lint
- [ ] npx jest --config jest.worktree.cjs publish-queue/release/list ReleaseQueueTab ReleaseCutCard - paste Tests: line
- [ ] SWR/list key is org-scoped (SYN-908) - no cross-brand leak
- [ ] AU English copy; YT metadata read-only
</verification>

<success_criteria>

- Founder releases cuts from a purpose-built surface grouped by hero (section 10).
- Per-cut Release/Hold/Reject + partial release; empty + error states present.
- Org-scoped throughout; no mock data; Release only flips to pending via the human route.
- section 15(7): gauntlet green.
  </success_criteria>

<output>
Write WS4c-SUMMARY.md. Note the live YouTube publish proof remains Phill's (morning).
</output>
