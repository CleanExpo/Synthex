-- Reconcile approval_comments RLS to the parent approval_requests idiom.
--
-- #483 shipped the approval_comments org-member policy gating via
-- public.business_ownerships (owner_id). That is secure (gates to the caller's
-- own orgs — no cross-tenant leak), but it uses a DIFFERENT membership source
-- than the rest of the approval subsystem:
--   * approval_requests' own RLS (supabase/migrations/20260319000001…:
--     "users_select_own_org_approval_requests") gates via users.organization_id;
--   * the route's withAuth sets clientId = user.organizationId (lib/auth/with-auth.ts).
-- Aligning the child to the parent prevents a multi-org user seeing an approval
-- but not its comments (or vice versa). CodeRabbit flagged and confirmed this.
--
-- Additive + idempotent: swaps only the policy body; RLS is already enabled by
-- 20260616_add_approval_comment. No table/column change.

DROP POLICY IF EXISTS approval_comments_org_member ON public.approval_comments;

CREATE POLICY approval_comments_org_member ON public.approval_comments
  USING (
    approval_request_id IN (
      SELECT id FROM public.approval_requests
       WHERE organization_id IN (
         SELECT organization_id FROM public.users WHERE id = auth.uid()::text
       )
    )
  )
  WITH CHECK (
    approval_request_id IN (
      SELECT id FROM public.approval_requests
       WHERE organization_id IN (
         SELECT organization_id FROM public.users WHERE id = auth.uid()::text
       )
    )
  );
