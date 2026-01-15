---
name: verification-protocol
version: 2.0.0
priority: 1
triggers:
  - verify
  - verification
  - attestation
  - evidence
---

# Independent Verification Protocol

**CRITICAL**: Agents CANNOT verify their own work. All verification MUST use IndependentVerifier.

## Architecture

```
Agent → Does Work → Reports Outputs → IndependentVerifier → Evidence → Pass/Fail → Orchestrator
```

## Core Rules

| Old (Broken) | New (Correct) |
|--------------|---------------|
| Agent verifies itself | IndependentVerifier verifies |
| `success: True` default | Evidence required for `verified: True` |
| Silent failures | Explicit failure with reasons |
| No retry | 3 attempts then escalate to human |

## Anti-Patterns (Self-Attestation)

```python
# WRONG: These raise SelfAttestationError
agent.verify_build()     # BLOCKED
agent.verify_tests()     # BLOCKED
return {"success": True} # No actual verification
```

## Correct Pattern

```python
class MyAgent(BaseAgent):
    async def execute(self, task, context):
        self.start_task(task_id)
        file_path = await self.create_component(task)

        # REPORT (don't verify)
        self.report_output("file", file_path, "Created component")

        # Add criteria for independent verification
        self.add_completion_criterion("file_exists", file_path)
        self.add_completion_criterion("no_placeholders", file_path)
        self.add_completion_criterion("code_compiles", "pnpm type-check")

        return {"status": "pending_verification", "task_output": self.get_task_output()}
```

## Verification Types

`FILE_EXISTS`, `FILE_NOT_EMPTY`, `NO_PLACEHOLDERS`, `CODE_COMPILES`, `LINT_PASSES`, `TESTS_PASS`, `ENDPOINT_RESPONDS`, `CONTENT_CONTAINS`

## Task Status Flow

```
PENDING → IN_PROGRESS → AWAITING_VERIFICATION →
  → VERIFICATION_PASSED → COMPLETED
  → VERIFICATION_FAILED → [3 attempts] → ESCALATED_TO_HUMAN
```

## Placeholder Patterns (Auto-Fail)

`TODO`, `FIXME`, `XXX`, `IMPLEMENT`, `PLACEHOLDER`, `...`, `raise NotImplementedError`, `throw new Error('Not implemented')`

## Evidence Collection

```python
class VerificationEvidence:
    criterion: str       # What was checked
    verified: bool       # Pass/fail
    evidence_data: str   # Actual proof
    verifier_id: str     # NOT the agent
```

## Migration

- Replace `agent.verify_*()` → `IndependentVerifier.verify()`
- Add `report_output()` in agent execution
- Add `add_completion_criterion()` for each output
- Handle escalation after 3 failures

See: `verification/`, `agents/base_agent.py`, `agents/orchestrator.py`
