---
name: long-running-agents
version: "1.0"
triggers:
  - long running
  - multi session
  - context window
  - incremental progress
  - feature tracking
priority: 9
---

# Long-Running Agent Harness

Work across multiple context windows via InitializerAgent (first run) + CodingAgent (subsequent runs).

## Shared Artifacts

| File | Purpose |
|------|---------|
| `claude-progress.txt` | Session history, current focus, next steps |
| `feature_list.json` | All features with `passes: false/true` status |
| `init.sh` | Environment setup script |

## Session Workflow

**InitializerAgent (First Run):** Analyze spec → Generate feature_list.json → Create init.sh → Create progress file → Git commit

**CodingAgent (Every Run):**
1. Get bearings: `git log`, read progress/features
2. Health check: run init.sh, fix issues first
3. Select ONE highest-priority failing feature
4. Implement & test end-to-end
5. Commit & update progress with next_steps

## Rules

- Work on ONE feature per session
- Test end-to-end before marking `passes: true`
- Never edit feature definitions, only status fields
- Leave environment clean with documentation
- Read progress files at session start

## Usage

```python
from src.agents.long_running import LongRunningAgentHarness, SessionRunner

# Full harness
harness = LongRunningAgentHarness(project_path, project_name, specification)
result = await harness.run_session()  # Auto-detects init vs coding

# Simple runner
runner = SessionRunner(project_path)
result = await runner.run(specification)
```

## API Quick Reference

| Class | Key Methods |
|-------|-------------|
| `LongRunningAgentHarness` | `run_session()`, `run_until_complete()`, `is_complete()` |
| `SessionRunner` | `run()`, `is_initialized()`, `get_progress()` |
| `ProgressTracker` | `start_session()`, `end_session()`, `record_commit()` |
| `FeatureManager` | `get_next_feature()`, `mark_passing()`, `get_stats()` |

## Failure Modes

| Problem | Solution |
|---------|----------|
| Declares victory early | Feature list with requirements marked failing |
| Environment broken | Health check first, fix before continuing |
| Too much at once | ONE feature per session limit |

See: `agents/long_running/`, `core/VERIFICATION.md`
