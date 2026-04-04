# SWARM BUILD SYSTEM - Multi-Agent Autonomous Development

## System Overview

This project uses a multi-agent autonomous build system based on Anthropic's orchestrator-worker pattern.

## Agent Architecture

```
Lead Agent (Senior PM)
    ├── Discovery Agents (parallel)
    │   ├── File Structure Discovery
    │   ├── Dependency Analysis
    │   ├── Tech Stack Identification
    │   ├── Code Health Scan
    │   └── Connection Audit
    ├── Architect Agent
    ├── Frontend Agent
    ├── Backend Agent
    ├── Integration Agent
    ├── Validator Agents (after each builder)
    └── Documentation Agent
```

## Quick Commands

```powershell
# Load the swarm build system
. .\scripts\swarm-build.ps1

# Individual phases
discover         # Phase 1: Map the project
plan             # Phase 2: Create execution plan
build            # Phase 3: Execute with validation
validate         # Phase 4: Comprehensive checks
finalize         # Phase 5: Documentation & handover

# Full autonomous build
fullbuild        # All phases sequentially

# Custom task with specific phase
swarm_build -Phase "build" -Task "Complete all API endpoint connections"
```

## Output Locations

| Type | Location |
|------|----------|
| Discovery Reports | specs/ |
| Execution Plans | specs/ |
| Build Logs | specs/ |
| API Documentation | docs/ |
| Deployment Scripts | scripts/ |
| Handover Documents | docs/ |

## Quality Gates

| Gate | Requirement | Status |
|------|-------------|--------|
| G1 | Discovery complete | ⬜ |
| G2 | Plan approved | ⬜ |
| G3 | All builders validated | ⬜ |
| G4 | All tests passing (≥80% coverage) | ⬜ |
| G5 | Zero lint/type errors | ⬜ |
| G6 | Documentation complete | ⬜ |
| G7 | Deployment verified | ⬜ |

## Phase Outputs

### Phase 1: Discovery
- `specs/FILE_STRUCTURE.md`
- `specs/DEPENDENCIES.md`
- `specs/TECH_STACK.md`
- `specs/CODE_HEALTH.md`
- `specs/CONNECTION_AUDIT.md`
- `specs/PROJECT_DISCOVERY_SUMMARY.md`
- `specs/RISK_REGISTER.md`
- `specs/PRIORITY_MATRIX.md`

### Phase 2: Planning
- `specs/EXECUTION_PLAN.md`
- `specs/TASK_ASSIGNMENTS.md`
- `specs/DEPENDENCY_ORDER.md`

### Phase 3: Build
- `specs/BUILD_LOG.md`
- `specs/VALIDATION_LOG.md`
- Source code changes

### Phase 4: Validation
- `specs/VALIDATION_REPORT.md`
- `specs/API_VERIFICATION.md`
- `specs/DATA_FLOW_VERIFICATION.md`

### Phase 5: Finalization
- `CLAUDE.md` (updated)
- `README.md` (updated)
- `docs/API_DOCS.md`
- `docs/HANDOVER.md`
- `scripts/deploy.sh`
- `.env.example`
- `specs/FINALIZATION_COMPLETE.md`

## Standards

- **Commits**: Checkpoint before, commit after validation
- **Testing**: Every builder has a validator
- **Documentation**: All changes logged to filesystem
- **Quality**: Senior Engineer 5-year maintainability standard

## Current Project State

**Project**: SYNTHEX - AI-Powered Marketing Platform
**Latest Completed Work**:
- OAuth2 Authentication Refactor with PKCE (UNI-446)
- Account model for multi-provider authentication
- Planner agent system for task coordination

**Git Commits**:
- `1b23897` - feat(agents): add planner agent system
- `4fb2864` - feat(auth): implement OAuth2 with PKCE and Account model

---
Generated: 2026-02-05
