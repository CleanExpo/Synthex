# Phase 61 Plan 02: Auto-title + Search + Archive Summary

**Auto-title renames "New Chat" after first response; sidebar gains search and archive.**

## Accomplishments

- Created `POST /api/ai/chat/conversations/[id]/auto-title`: reads first user message,
  generates title (60 char trim, newlines stripped), skips if already renamed; returns
  `{ success, title }` or `{ success, skipped: true }`
- `useAIChatConversation` updated: fires auto-title after first streaming response via
  `isFirstMessageRef`; accepts `onTitleUpdated` callback; exposes `titleUpdated: boolean`;
  resets on `conversationId` change
- `useAIChat` updated: added `archiveConversation(id)` — PATCHes `status:'archived'`,
  removes from active list
- `ChatAssistant` updated: accepts optional `onTitleUpdated` prop, passes to hook
- `[conversationId]/page.tsx` updated: search input filters conversation list client-side;
  Archive button (amber) + Delete button (red) shown on hover per conversation item;
  `onTitleUpdated` calls `refreshConversations()` to update sidebar title
- TypeScript: 0 errors

## Files Created/Modified

| File | Action |
|------|--------|
| `app/api/ai/chat/conversations/[id]/auto-title/route.ts` | Created |
| `hooks/use-ai-chat.ts` | Modified (archiveConversation, onTitleUpdated, isFirstMessageRef) |
| `components/ai/chat-assistant.tsx` | Modified (onTitleUpdated prop) |
| `app/dashboard/ai-chat/[conversationId]/page.tsx` | Modified (search, archive, onTitleUpdated) |

## Decisions Made

- Auto-title is fire-and-forget (non-blocking); failure silently ignored via try/catch
- `isFirstMessageRef` resets on every `conversationId` change — correct for new conversations
- Archive uses existing PATCH endpoint (status:'archived') — no schema change needed
- Search is client-side filter — no API call, instant feedback

## Issues Encountered

None.

## Next Step

Phase 61 complete. Ready for Phase 62: Multi-step Workflow Engine.
Update Linear UNI-TBD to Done.

Commits: `17350142`, `78eb4bff`, `655c7fdd`
