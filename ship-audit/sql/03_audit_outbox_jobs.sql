-- =================================================================
-- 03_audit_outbox_jobs.sql - Audit Trail, Idempotency & Jobs
-- Generated: 2025-08-13
-- Purpose: Advanced reliability and observability features
-- =================================================================

BEGIN;

-- =================================================================
-- PART 1: Enhanced Audit Trail System
-- =================================================================

-- Create audit schema
CREATE SCHEMA IF NOT EXISTS audit;

-- Comprehensive audit log table
CREATE TABLE IF NOT EXISTS audit.log (
    id BIGSERIAL PRIMARY KEY,
    at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')),
    pk JSONB NOT NULL,
    old_row JSONB,
    new_row JSONB,
    changed_fields JSONB, -- Only the fields that changed
    actor_id TEXT,
    actor_type TEXT DEFAULT 'user', -- 'user', 'system', 'api', 'admin'
    actor_ip INET,
    actor_user_agent TEXT,
    session_id TEXT,
    request_id TEXT, -- For tracing through distributed systems
    app_context JSONB, -- Application-specific context
    CONSTRAINT chk_audit_row_data CHECK (
        (operation = 'INSERT' AND new_row IS NOT NULL) OR
        (operation = 'UPDATE' AND old_row IS NOT NULL AND new_row IS NOT NULL) OR
        (operation = 'DELETE' AND old_row IS NOT NULL) OR
        (operation = 'TRUNCATE')
    )
);

-- Indexes for audit queries
CREATE INDEX idx_audit_log_at ON audit.log(at DESC);
CREATE INDEX idx_audit_log_table ON audit.log(table_name, at DESC);
CREATE INDEX idx_audit_log_actor ON audit.log(actor_id, at DESC) WHERE actor_id IS NOT NULL;
CREATE INDEX idx_audit_log_operation ON audit.log(operation, at DESC);
CREATE INDEX idx_audit_log_request ON audit.log(request_id) WHERE request_id IS NOT NULL;

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION audit.log_row() RETURNS TRIGGER AS $$
DECLARE
    pk_value JSONB;
    changed_fields JSONB;
    actor_id TEXT;
    request_id TEXT;
BEGIN
    -- Get actor from session variables (set by application)
    actor_id := current_setting('app.user_id', true);
    request_id := current_setting('app.request_id', true);
    
    -- Build primary key JSON
    IF TG_OP != 'DELETE' THEN
        pk_value := to_jsonb(NEW.id);
    ELSE
        pk_value := to_jsonb(OLD.id);
    END IF;
    
    -- Calculate changed fields for UPDATE
    IF TG_OP = 'UPDATE' THEN
        SELECT jsonb_object_agg(key, value) INTO changed_fields
        FROM (
            SELECT key, value
            FROM jsonb_each(to_jsonb(NEW))
            WHERE (to_jsonb(OLD) ->> key) IS DISTINCT FROM (value::text)
        ) changes;
    END IF;
    
    -- Insert audit record
    INSERT INTO audit.log(
        table_name, 
        operation, 
        pk, 
        old_row, 
        new_row, 
        changed_fields,
        actor_id,
        request_id
    )
    VALUES (
        TG_TABLE_NAME,
        TG_OP,
        pk_value,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END,
        changed_fields,
        actor_id,
        request_id
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to critical tables
CREATE TRIGGER trg_users_audit
AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH ROW EXECUTE FUNCTION audit.log_row();

CREATE TRIGGER trg_campaigns_audit
AFTER INSERT OR UPDATE OR DELETE ON campaigns
FOR EACH ROW EXECUTE FUNCTION audit.log_row();

CREATE TRIGGER trg_organizations_audit
AFTER INSERT OR UPDATE OR DELETE ON organizations
FOR EACH ROW EXECUTE FUNCTION audit.log_row();

CREATE TRIGGER trg_platform_connections_audit
AFTER INSERT OR UPDATE OR DELETE ON platform_connections
FOR EACH ROW EXECUTE FUNCTION audit.log_row();

CREATE TRIGGER trg_api_usage_audit
AFTER INSERT ON api_usage
FOR EACH ROW EXECUTE FUNCTION audit.log_row();

-- =================================================================
-- PART 2: Idempotency Keys System
-- =================================================================

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
    id BIGSERIAL PRIMARY KEY,
    key TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    user_id TEXT NOT NULL,
    request_fingerprint TEXT NOT NULL, -- Hash of request params
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    response_status INTEGER,
    response_body JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
    CONSTRAINT uk_idempotency_key UNIQUE (key, endpoint, user_id)
);

-- Indexes for idempotency
CREATE INDEX idx_idempotency_keys_expires ON idempotency_keys(expires_at) WHERE status = 'completed';
CREATE INDEX idx_idempotency_keys_user ON idempotency_keys(user_id, created_at DESC);
CREATE INDEX idx_idempotency_keys_lookup ON idempotency_keys(key, endpoint, user_id) WHERE status != 'failed';

-- Cleanup function for expired keys
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys() RETURNS void AS $$
BEGIN
    DELETE FROM idempotency_keys 
    WHERE expires_at < CURRENT_TIMESTAMP 
    AND status IN ('completed', 'failed');
END;
$$ LANGUAGE plpgsql;

-- =================================================================
-- PART 3: Transactional Outbox Pattern
-- =================================================================

CREATE TABLE IF NOT EXISTS public.outbox_events (
    id BIGSERIAL PRIMARY KEY,
    aggregate_type TEXT NOT NULL, -- 'user', 'campaign', 'post', etc.
    aggregate_id TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'created', 'updated', 'deleted', 'published'
    event_version INTEGER NOT NULL DEFAULT 1,
    payload JSONB NOT NULL,
    metadata JSONB, -- Headers, correlation IDs, etc.
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    CONSTRAINT chk_outbox_status CHECK (
        (processed_at IS NULL AND failed_at IS NULL) OR
        (processed_at IS NOT NULL AND failed_at IS NULL) OR
        (processed_at IS NULL AND failed_at IS NOT NULL)
    )
);

-- Indexes for outbox processing
CREATE INDEX idx_outbox_unprocessed ON outbox_events(created_at) 
WHERE processed_at IS NULL AND failed_at IS NULL AND retry_count < max_retries;

CREATE INDEX idx_outbox_aggregate ON outbox_events(aggregate_type, aggregate_id, created_at DESC);

-- Function to publish events to outbox
CREATE OR REPLACE FUNCTION publish_event(
    p_aggregate_type TEXT,
    p_aggregate_id TEXT,
    p_event_type TEXT,
    p_payload JSONB,
    p_metadata JSONB DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
    event_id BIGINT;
BEGIN
    INSERT INTO outbox_events (
        aggregate_type,
        aggregate_id,
        event_type,
        payload,
        metadata
    ) VALUES (
        p_aggregate_type,
        p_aggregate_id,
        p_event_type,
        p_payload,
        p_metadata
    ) RETURNING id INTO event_id;
    
    RETURN event_id;
END;
$$ LANGUAGE plpgsql;

-- =================================================================
-- PART 4: Job Queue System
-- =================================================================

CREATE TABLE IF NOT EXISTS public.jobs (
    id BIGSERIAL PRIMARY KEY,
    job_type TEXT NOT NULL,
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    payload JSONB NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    run_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_error TEXT,
    result JSONB,
    created_by TEXT,
    worker_id TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for job processing
CREATE INDEX idx_jobs_ready ON jobs(priority DESC, run_at) 
WHERE status = 'pending' AND run_at <= CURRENT_TIMESTAMP;

CREATE INDEX idx_jobs_type_status ON jobs(job_type, status);
CREATE INDEX idx_jobs_created_by ON jobs(created_by, created_at DESC) WHERE created_by IS NOT NULL;

-- Function to claim a job (with advisory lock)
CREATE OR REPLACE FUNCTION claim_job(p_worker_id TEXT, p_job_types TEXT[] DEFAULT NULL) 
RETURNS TABLE(
    job_id BIGINT,
    job_type TEXT,
    payload JSONB
) AS $$
DECLARE
    v_job_id BIGINT;
BEGIN
    -- Find and lock the next available job
    SELECT id INTO v_job_id
    FROM jobs
    WHERE status = 'pending'
    AND run_at <= CURRENT_TIMESTAMP
    AND attempts < max_attempts
    AND (p_job_types IS NULL OR job_type = ANY(p_job_types))
    ORDER BY priority DESC, run_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1;
    
    IF v_job_id IS NOT NULL THEN
        -- Update job status
        UPDATE jobs 
        SET status = 'running',
            started_at = CURRENT_TIMESTAMP,
            worker_id = p_worker_id,
            attempts = attempts + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = v_job_id;
        
        -- Return job details
        RETURN QUERY
        SELECT j.id, j.job_type, j.payload
        FROM jobs j
        WHERE j.id = v_job_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to complete a job
CREATE OR REPLACE FUNCTION complete_job(p_job_id BIGINT, p_result JSONB DEFAULT NULL) 
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE jobs
    SET status = 'completed',
        completed_at = CURRENT_TIMESTAMP,
        result = p_result,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_job_id
    AND status = 'running';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to fail a job
CREATE OR REPLACE FUNCTION fail_job(p_job_id BIGINT, p_error TEXT) 
RETURNS BOOLEAN AS $$
DECLARE
    v_attempts INTEGER;
    v_max_attempts INTEGER;
BEGIN
    SELECT attempts, max_attempts INTO v_attempts, v_max_attempts
    FROM jobs
    WHERE id = p_job_id;
    
    IF v_attempts >= v_max_attempts THEN
        -- Final failure
        UPDATE jobs
        SET status = 'failed',
            failed_at = CURRENT_TIMESTAMP,
            last_error = p_error,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = p_job_id;
    ELSE
        -- Retry later
        UPDATE jobs
        SET status = 'pending',
            run_at = CURRENT_TIMESTAMP + (v_attempts * INTERVAL '1 minute'),
            last_error = p_error,
            worker_id = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = p_job_id;
    END IF;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- =================================================================
-- PART 5: Dead Letter Queue
-- =================================================================

CREATE TABLE IF NOT EXISTS public.dead_letter_queue (
    id BIGSERIAL PRIMARY KEY,
    source_table TEXT NOT NULL,
    source_id TEXT,
    operation TEXT NOT NULL,
    payload JSONB NOT NULL,
    error_message TEXT NOT NULL,
    error_count INTEGER DEFAULT 1,
    first_error_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_error_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT
);

CREATE INDEX idx_dlq_unresolved ON dead_letter_queue(last_error_at DESC) 
WHERE resolved_at IS NULL;

-- =================================================================
-- PART 6: Event Sourcing Support (Optional)
-- =================================================================

CREATE TABLE IF NOT EXISTS public.event_store (
    id BIGSERIAL PRIMARY KEY,
    stream_id TEXT NOT NULL,
    stream_type TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_version INTEGER NOT NULL,
    event_data JSONB NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    CONSTRAINT uk_event_store_stream UNIQUE (stream_id, event_version)
);

CREATE INDEX idx_event_store_stream ON event_store(stream_id, event_version);
CREATE INDEX idx_event_store_type ON event_store(stream_type, created_at DESC);

-- =================================================================
-- PART 7: Scheduled Tasks
-- =================================================================

-- Schedule periodic cleanup jobs
INSERT INTO jobs (job_type, payload, run_at, priority, max_attempts)
VALUES 
    ('cleanup_expired_idempotency_keys', '{}', CURRENT_TIMESTAMP, 3, 1),
    ('cleanup_old_audit_logs', '{"days_to_keep": 90}', CURRENT_TIMESTAMP, 3, 1),
    ('process_outbox_events', '{}', CURRENT_TIMESTAMP, 8, 5)
ON CONFLICT DO NOTHING;

COMMIT;

-- =================================================================
-- ROLLBACK SCRIPT
-- =================================================================
-- BEGIN;
-- DROP TABLE IF EXISTS audit.log CASCADE;
-- DROP TABLE IF EXISTS public.idempotency_keys CASCADE;
-- DROP TABLE IF EXISTS public.outbox_events CASCADE;
-- DROP TABLE IF EXISTS public.jobs CASCADE;
-- DROP TABLE IF EXISTS public.dead_letter_queue CASCADE;
-- DROP TABLE IF EXISTS public.event_store CASCADE;
-- DROP SCHEMA IF EXISTS audit CASCADE;
-- DROP FUNCTION IF EXISTS audit.log_row() CASCADE;
-- DROP FUNCTION IF EXISTS cleanup_expired_idempotency_keys() CASCADE;
-- DROP FUNCTION IF EXISTS publish_event() CASCADE;
-- DROP FUNCTION IF EXISTS claim_job() CASCADE;
-- DROP FUNCTION IF EXISTS complete_job() CASCADE;
-- DROP FUNCTION IF EXISTS fail_job() CASCADE;
-- COMMIT;