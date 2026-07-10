---
phase: nexus-viral-productionise
workstream: WS4a
plan: WS4a
type: execute
baseline: origin/main @ f3fd9cf3
model: opus
model_rationale: SAFETY-CRITICAL - the ungated-seed invariant lives here
title: CalendarSlot JSON extension + YouTube/TikTok adapters + seed invariant
---

<objective>
Give slots optional video + youtube metadata, add YouTube/TikTok publish adapters
over the existing services, wire them into dispatchToPlatform's switch ONLY, and
lock the invariant that AUTO_PUBLISH_PLATFORMS never gains youtube/tiktok (so
seedPublishQueue can never create an ungated pending row). Spec section 9 WS4
(adapters + metadata), section 15(9).
</objective>

<context>
@lib/calendar/types.ts (line 57)      # CalendarSlot interface; already has mediaType?'REELS' (line 92) + mediaUrl? (line 97) as additive JSON fields - EXTEND additively, no migration (JSONB column)
@lib/publish/publishQueue.ts          # AUTO_PUBLISH_PLATFORMS Set (line ~55: instagram/facebook/linkedin/twitter/threads - youtube/tiktok DELIBERATELY absent); dispatchToPlatform switch (line ~150, default -> 'not yet supported' error); seedPublishQueue (line ~525) filters approvedSlots by AUTO_PUBLISH_PLATFORMS.has(slot.platform) then creates status:'pending' rows
@lib/social/youtube-service.ts        # class YouTubeService extends BasePlatformService; createPost (line 734); makeRequest; YOUTUBE_UPLOAD_BASE - adapter wraps this (video upload + title/description/tags)
@lib/social/tiktok-service.ts         # class TikTokService; createPost (line 522, PULL_FROM_URL); tiktokService singleton (line 641)
@lib/publish/platformAdapters/instagram.ts  # publishToInstagram({accessToken,igUserId,caption,...}) -> {success,platformPostId?,error?} - the adapter contract to mirror
@__tests__/publish/publishQueue.test.ts     # existing seedPublishQueue / claim test patterns to extend

Constraint: AUTO_PUBLISH_PLATFORMS MUST NOT gain youtube/tiktok (adversarial finding auto-publish-set-arms-ungated-seed). NO migration. jest.worktree mocked services.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Additive CalendarSlot JSON fields (video + youtube)</name>
  <files>lib/calendar/types.ts</files>
  <action>
Add optional fields to CalendarSlot alongside mediaType/mediaUrl: `video?: { url: string; thumbnail?: string }` and `youtube?: { title: string; description: string; tags: string[] }`. Document (mirroring existing comments) that these are additive JSONB fields safe on existing records; absent on legacy slots. NO schema/migration change - this is the JSONB shape only.
  </action>
  <verify>npm run type-check passes; CalendarSlot consumers still compile; no prisma change.</verify>
  <done>CalendarSlot carries optional video + youtube metadata additively.</done>
</task>

<task type="auto">
  <name>Task 2: YouTube + TikTok publish adapters</name>
  <files>lib/publish/platformAdapters/youtube.ts, lib/publish/platformAdapters/tiktok.ts</files>
  <action>
Create publishToYouTube(args) and publishToTikTok(args) matching the instagram adapter contract ({success, platformPostId?, error?}). YouTube: build the create-request payload from the slot's youtube{title,description,tags} + video.url and call YouTubeService (upload). TikTok: PULL_FROM_URL from video.url via TikTokService.createPost. Fail with a clear error (no placeholder) when video.url/youtube metadata is missing - never post caption-only for these.
  </action>
  <verify>npx jest --config jest.worktree.cjs platformAdapters/youtube platformAdapters/tiktok with mocked services: youtube adapter emits correct create-request payload (title/description/tags) - section 15(4) mocked half; tiktok dispatch path returns success on mocked createPost - section 15(5); missing video.url -> error, no post.</verify>
  <done>Both adapters wrap existing services with the standard contract; YT payload correctness unit-proven.</done>
</task>

<task type="auto">
  <name>Task 3: Wire adapters into dispatchToPlatform switch ONLY + lock seed invariant</name>
  <files>lib/publish/publishQueue.ts, __tests__/publish/publishQueue.test.ts</files>
  <action>
Add `case 'youtube'` and `case 'tiktok'` to dispatchToPlatform's switch (reading slot video/youtube metadata via the media param or an extended arg). DO NOT add youtube/tiktok to AUTO_PUBLISH_PLATFORMS. Add a unit test asserting seedPublishQueue SKIPS approved youtube/tiktok slots (no publish_queue row created) - section 15(9) first half. Keep the existing default-case error for truly-unknown platforms.
  </action>
  <verify>npx jest --config jest.worktree.cjs publish/publishQueue: an approved youtube slot AND an approved tiktok slot produce ZERO seeded rows; existing instagram seeding unchanged; dispatchToPlatform routes youtube/tiktok to the new adapters.</verify>
  <done>Adapters reachable via dispatch; AUTO_PUBLISH_PLATFORMS unchanged; seed-skip proven (section 15(9) half 1).</done>
</task>

</tasks>

<verification>
- [ ] npm run type-check && npm run lint
- [ ] npx jest --config jest.worktree.cjs lib/publish platformAdapters - paste Tests: line
- [ ] grep AUTO_PUBLISH_PLATFORMS: youtube/tiktok ABSENT
- [ ] seedPublishQueue skips youtube/tiktok - test green
</verification>

<success_criteria>

- section 15(4) mocked half: YouTube adapter emits correct create-request payload.
- section 15(5): TikTok adapter dispatch path unit-proven.
- section 15(9) half 1: seedPublishQueue skips youtube/tiktok (no ungated pending row).
- NO migration; additive slot JSON only.
  </success_criteria>

<output>
Write WS4a-SUMMARY.md. Flag WS4 as SAFETY-CRITICAL for human review.
</output>
