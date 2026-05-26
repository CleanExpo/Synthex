# Immutable Audit Log Mutation Test — Synthex production

Run at 2026-05-16T11:18 UTC against `znyjoyjsvjotlzjppzal` via Supabase MCP.

## Schema confirmed

```
audit_events_immutable
  id          uuid
  event_type  text
  actor_id    uuid
  payload     jsonb
  created_at  timestamp with time zone
```

Triggers attached:

```
trg_audit_events_immutable_block_delete  BEFORE DELETE  EXECUTE FUNCTION audit_events_immutable_block_mutation()
trg_audit_events_immutable_block_update  BEFORE UPDATE  EXECUTE FUNCTION audit_events_immutable_block_mutation()
```

## Test 1 — INSERT (must succeed)

```sql
INSERT INTO audit_events_immutable (event_type, actor_id, payload)
VALUES ('test.production_signoff', '00000000-0000-0000-0000-000000000000'::uuid,
        '{"source":"phase-6-verify","ts":"2026-05-16T11:20:00Z"}'::jsonb)
RETURNING id, created_at, event_type;
```

**Result (PASS):**

```json
[{
  "id": "3bcb21c4-697c-4989-bdad-85c508a10f58",
  "created_at": "2026-05-16 11:18:18.974519+00",
  "event_type": "test.production_signoff"
}]
```

## Test 2 — UPDATE (must fail)

```sql
UPDATE audit_events_immutable SET event_type = 'tampered'
WHERE event_type = 'test.production_signoff';
```

**Result (PASS — correctly blocked):**

```
ERROR: 42501: audit_events_immutable is append-only. UPDATE is not permitted.
       (row id=3bcb21c4-697c-4989-bdad-85c508a10f58)
CONTEXT: PL/pgSQL function audit_events_immutable_block_mutation() line 3 at RAISE
```

## Test 3 — DELETE (must fail)

```sql
DELETE FROM audit_events_immutable WHERE event_type = 'test.production_signoff';
```

**Result (PASS — correctly blocked):**

```
ERROR: 42501: audit_events_immutable is append-only. DELETE is not permitted.
       (row id=3bcb21c4-697c-4989-bdad-85c508a10f58)
CONTEXT: PL/pgSQL function audit_events_immutable_block_mutation() line 3 at RAISE
```

## Verdict: PASS

The immutable audit log is correctly append-only. INSERT succeeds, UPDATE and DELETE are both blocked with explicit SQLSTATE 42501 errors. The test row (id `3bcb21c4-697c-4989-bdad-85c508a10f58`) intentionally remains in the table — this is correct behaviour for an immutable log.
