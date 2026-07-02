---
name: project-comments-idor
description: Broken-access-control (IDOR) in GET /api/comments — authenticated but no content-ownership check, found 2026-05-29
metadata:
  type: project
---

`app/api/comments/route.ts` GET handler authenticates the caller via `getUserIdFromRequestOrCookies` (gets `userId`) but the Prisma `contentComment.findMany` `whereClause` only filters on `contentType` + `contentId` + `parentId` — `userId` is never used to verify the caller can access that content. Any authenticated user can read comments on any campaign/post/calendar_post/project by enumerating `contentId`.

**Why:** Classic IDOR — auth present, authorization absent. The `userId` is fetched then discarded for the read path.
**How to apply:** Fix requires an ownership pre-check (load the parent content, confirm `userId` owns it / shares org) before returning comments. When auditing, "has auth" is not "has access control" — check that the authenticated id actually constrains the query. See [[project-api-architecture-baseline]].
