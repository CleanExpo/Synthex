-- =============================================================================
-- Migration: Agent Runs and Workflow RLS
-- Source: NodeJS-Starter-V1 supabase/migrations/
--   - 00000000000006_agent_runs_realtime.sql (agent_runs table + realtime)
--   - 20251230050841_agent_task_queue.sql     (agent_task_queue table)
-- Purpose: Supabase-native tables for Phase 118 (Headless Task-Runner).
--          These tables track autonomous task execution and live alongside
--          Prisma-managed models. Prisma does not own these tables.
-- Date: 2026-03-17
-- =============================================================================

BEGIN;

-- =============================================================================
-- SECTION 1: agent_runs
-- Real-time agent execution tracking for the autonomous task runner.
-- Supports status history tracking, verification state, and Supabase Realtime.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.agent_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link to tasks (references Prisma-managed Task table via UUID string)
    task_id UUID,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Agent identification
    agent_name TEXT NOT NULL,
    agent_id TEXT NOT NULL,

    -- Execution details
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',
        'in_progress',
        'awaiting_verification',
        'verification_in_progress',
        'verification_passed',
        'verification_failed',
        'completed',
        'failed',
        'blocked',
        'escalated_to_human'
    )),

    -- Progress tracking
    current_step TEXT,
    progress_percent FLOAT DEFAULT 0.0 CHECK (progress_percent >= 0 AND progress_percent <= 100),

    -- Results and metadata
    result JSONB DEFAULT '{}',
    error TEXT,
    -- metadata also stores status_history via notify_agent_run_status_change() trigger
    metadata JSONB DEFAULT '{}',

    -- Verification tracking
    verification_attempts INT DEFAULT 0,
    verification_evidence JSONB DEFAULT '[]',

    -- Timestamps
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_runs_task_id ON public.agent_runs(task_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_user_id ON public.agent_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON public.agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_started_at ON public.agent_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_name ON public.agent_runs(agent_name);

-- RLS
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agent runs"
    ON public.agent_runs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own agent runs"
    ON public.agent_runs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own agent runs"
    ON public.agent_runs FOR UPDATE
    USING (auth.uid() = user_id);

-- Service role full access (for headless task worker)
CREATE POLICY "Service role has full access to agent_runs"
    ON public.agent_runs FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Trigger: updated_at
CREATE TRIGGER agent_runs_updated_at
    BEFORE UPDATE ON public.agent_runs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- SECTION 2: agent_runs status history trigger
-- Appends status transitions to metadata.status_history automatically.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_agent_run_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        NEW.metadata = jsonb_set(
            COALESCE(NEW.metadata, '{}'::jsonb),
            '{status_history}',
            COALESCE(NEW.metadata -> 'status_history', '[]'::jsonb) ||
            jsonb_build_object(
                'from', OLD.status,
                'to', NEW.status,
                'timestamp', NOW()
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_run_status_change
    BEFORE UPDATE ON public.agent_runs
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.notify_agent_run_status_change();

-- =============================================================================
-- SECTION 3: agent_run_summaries view
-- Aggregates agent_runs for dashboard display.
-- =============================================================================

CREATE OR REPLACE VIEW public.agent_run_summaries AS
SELECT
    ar.id,
    ar.task_id,
    ar.user_id,
    ar.agent_name,
    ar.status,
    ar.current_step,
    ar.progress_percent,
    ar.verification_attempts,
    ar.started_at,
    ar.completed_at,
    ar.updated_at,
    EXTRACT(EPOCH FROM (COALESCE(ar.completed_at, NOW()) - ar.started_at)) AS duration_seconds
FROM public.agent_runs ar;

GRANT SELECT ON public.agent_run_summaries TO authenticated;
GRANT SELECT ON public.agent_run_summaries TO service_role;

-- =============================================================================
-- SECTION 4: get_active_agent_runs helper
-- Returns in-progress runs for a given user. Useful for polling/dashboard.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_active_agent_runs(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    agent_name TEXT,
    status TEXT,
    current_step TEXT,
    progress_percent FLOAT,
    started_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ar.id,
        ar.agent_name,
        ar.status,
        ar.current_step,
        ar.progress_percent,
        ar.started_at
    FROM public.agent_runs ar
    WHERE ar.user_id = p_user_id
        AND ar.status IN (
            'pending',
            'in_progress',
            'awaiting_verification',
            'verification_in_progress'
        )
    ORDER BY ar.started_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_active_agent_runs(UUID) TO authenticated;

-- =============================================================================
-- SECTION 5: Enable Realtime for agent_runs
-- Frontend can subscribe to execution state changes in real time.
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_runs;

-- =============================================================================
-- SECTION 6: agent_task_queue
-- Priority queue for autonomous tasks submitted to the headless task runner.
-- Corresponds to the AUTONOMOUS_TASKS Bull queue added in Phase 118-01.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.agent_task_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Task details
    title TEXT NOT NULL CHECK (length(title) >= 3),
    description TEXT NOT NULL,
    task_type TEXT NOT NULL CHECK (task_type IN ('feature', 'bug', 'refactor', 'docs', 'test')),
    priority INT NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')
    ),

    -- Agent assignment
    assigned_agent_id TEXT,
    assigned_agent_type TEXT CHECK (
        assigned_agent_type IS NULL OR
        assigned_agent_type IN ('frontend', 'backend', 'database', 'devops', 'general')
    ),

    -- Execution metadata
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    iterations INT DEFAULT 0,
    verification_status TEXT,
    pr_url TEXT,

    -- Results
    result JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,

    -- Audit
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_completion_time CHECK (
        completed_at IS NULL OR completed_at >= started_at
    ),
    CONSTRAINT valid_started_time CHECK (
        started_at IS NULL OR started_at >= created_at
    )
);

-- Indexes for queue operations
CREATE INDEX IF NOT EXISTS idx_agent_task_queue_status ON public.agent_task_queue(status);
CREATE INDEX IF NOT EXISTS idx_agent_task_queue_created_at ON public.agent_task_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_task_queue_priority ON public.agent_task_queue(priority DESC);
CREATE INDEX IF NOT EXISTS idx_agent_task_queue_created_by ON public.agent_task_queue(created_by)
    WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_task_queue_assigned_agent ON public.agent_task_queue(assigned_agent_id)
    WHERE assigned_agent_id IS NOT NULL;

-- RLS
ALTER TABLE public.agent_task_queue ENABLE ROW LEVEL SECURITY;

-- Public can view all tasks (useful for admin dashboards and transparency)
CREATE POLICY "Public can view agent tasks"
    ON public.agent_task_queue
    FOR SELECT
    USING (true);

-- Authenticated users can create tasks (must own the task)
CREATE POLICY "Authenticated users can create tasks"
    ON public.agent_task_queue
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

-- Users can update their own tasks (e.g., cancel)
CREATE POLICY "Users can update own tasks"
    ON public.agent_task_queue
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = created_by);

-- Service role can update any task (for agent execution engine)
CREATE POLICY "Service role can update any task"
    ON public.agent_task_queue
    FOR UPDATE
    TO service_role
    WITH CHECK (true);

-- Trigger: updated_at
CREATE TRIGGER agent_task_queue_updated_at
    BEFORE UPDATE ON public.agent_task_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Explicit grants (belt-and-suspenders alongside RLS)
GRANT SELECT, INSERT, UPDATE ON public.agent_task_queue TO authenticated;
GRANT SELECT ON public.agent_task_queue TO anon;
GRANT ALL ON public.agent_task_queue TO service_role;

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE public.agent_runs IS 'Real-time agent execution tracking for the headless autonomous task runner (Phase 118)';
COMMENT ON TABLE public.agent_task_queue IS 'Priority queue for autonomous tasks submitted to the headless task runner';
COMMENT ON VIEW public.agent_run_summaries IS 'Aggregated agent run data for dashboard display — includes duration_seconds';
COMMENT ON FUNCTION public.notify_agent_run_status_change IS 'Appends status transitions to metadata.status_history for audit trail';
COMMENT ON FUNCTION public.get_active_agent_runs IS 'Returns in-progress agent runs for a given user';

COMMIT;
