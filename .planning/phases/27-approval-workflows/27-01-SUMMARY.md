# Phase 27 Plan 01 Summary: Approval Workflow API Foundation

**Started:** 2026-02-18T04:26:50Z
**Completed:** 2026-02-18T04:35:00Z
**Duration:** ~8 minutes

## Objective

Add Prisma models for approval workflows and create CRUD API routes with Prisma persistence.

## Completed Tasks

### Task 1: Add ApprovalRequest and WorkflowTemplate Prisma models
**Commit:** `02bfac1`
- Added ApprovalRequest model with contentId, contentType, steps (JSON), status, priority
- Added WorkflowTemplate model with organization scope, steps (JSON), contentTypes
- Added User.submittedApprovals relation
- Added Organization.approvalRequests and workflowTemplates relations
- All indexes created for query performance
- Prisma validate and generate passed

### Task 2: Create approval requests API route
**Commit:** `975e0b4`
- GET /api/approvals with filters: status, assignedToMe, submittedByMe, contentType, priority
- POST /api/approvals creates request with default 2-step workflow or from WorkflowTemplate
- Zod validation for request body
- Audit logging for creation
- Proper authorization with getUserIdFromCookies

### Task 3: Create approval request detail API route
**Commit:** `f4aa715`
- GET /api/approvals/[id] with access control (submitter, assignee, or same org)
- PATCH with 5 workflow actions: approve, reject, request_revision, resubmit, add_comment
- DELETE (submitter only)
- TeamNotification integration for all approval actions
- Workflow state machine: pending → in_review → approved/rejected/revision_requested
- Audit logging for all actions

## Key Decisions

1. **Prisma over existing Supabase service**: Created new Prisma-based API routes rather than using lib/services/approval-workflow.ts which uses Supabase raw queries
2. **Steps as JSON**: Stored ApprovalStep as JSON array in ApprovalRequest (not separate model) for simpler structure
3. **JSON type casting**: Used `as unknown as Prisma.InputJsonValue` pattern for TypeScript compatibility

## Files Created/Modified

- `prisma/schema.prisma` - Added ApprovalRequest, WorkflowTemplate models + relations
- `app/api/approvals/route.ts` - GET list + POST create endpoints
- `app/api/approvals/[id]/route.ts` - GET single + PATCH actions + DELETE endpoints

## Verification

- [x] `npx prisma validate` passes
- [x] `npx prisma generate` succeeds
- [x] `npm run type-check` passes (only pre-existing errors remain)
- [x] API routes created with proper auth
- [x] TeamNotification integration implemented

## Next Steps

Execute **27-02-PLAN.md** to create:
- useApprovals React hook
- Dashboard page at /dashboard/approvals
- Sidebar and command palette navigation entries
