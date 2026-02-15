---
template: deployment-report
version: 1.0
---

# Deployment Report: {{title}}

**Date**: {{date}}
**Environment**: {{environment}}
**Version**: {{version}}
**Deployed by**: {{agent}}

---

## Phase Results

| Phase | Status | Duration | Notes |
|-------|--------|----------|-------|
| Preflight | {{preflight_status}} | {{preflight_duration}} | {{preflight_notes}} |
| Build | {{build_status}} | {{build_duration}} | {{build_notes}} |
| Deploy | {{deploy_status}} | {{deploy_duration}} | {{deploy_notes}} |
| Verify | {{verify_status}} | {{verify_duration}} | {{verify_notes}} |
| Monitor | {{monitor_status}} | {{monitor_duration}} | {{monitor_notes}} |

## Build Details

- **Commit**: {{commit_hash}}
- **Branch**: {{branch}}
- **Build output**: {{build_size}}
- **TypeScript errors**: {{ts_errors}}
- **Warnings**: {{warnings}}

## Verification

- **Health check**: {{health_status}}
- **API response**: {{api_response_time}}
- **Error rate**: {{error_rate}}

## Issues Encountered
{{issues}}

## Rollback Plan
{{rollback_plan}}
