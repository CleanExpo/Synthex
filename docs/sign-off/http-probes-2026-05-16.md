# HTTP Probes — synthex.social — 2026-05-16

Verified via `curl` from local machine at 2026-05-16T11:16 UTC.

## Probe Results

| Endpoint | Expected | Observed | Status |
|---|---|---|---|
| `GET /api/health` | 200 + JSON `status:"healthy"` | 200 `status:"healthy"`, version `2.0.1`, buildId `f2ac8d8`, env `production`, region `sfo1` | PASS |
| `GET /api/health/live` | 200 + uptime | 200 `{"status":"alive","timestamp":"2026-05-16T11:16:14.519Z","uptime":0}` | PASS |
| `GET /api/health/redis` | healthy | 200 `{"status":"healthy","implementation":"redis-cloud-vercel","connection":"redis-cloud"}` | PASS |
| `GET /login` | 200 HTML | 200 (Next.js HTML page) | PASS |
| `GET /dashboard` (unauth) | 307 → /login | 307 → `https://synthex.social/login?redirect=%2Fdashboard` | PASS |
| `GET /` (homepage) | 200 HTML | 200 (Next.js HTML page) | PASS |

## /api/health full payload

```json
{
  "status": "healthy",
  "timestamp": "2026-05-16T11:16:12.347Z",
  "version": "2.0.1",
  "buildId": "f2ac8d8",
  "environment": "production",
  "region": "sfo1",
  "uptime": 1,
  "responseTime": 1834,
  "env": {"required": "ok", "warnings": []},
  "checks": {
    "database": {"status": "healthy", "latency": 1832, "message": "Connected"},
    "cache": {"status": "healthy", "latency": 150, "message": "Mode: memory"},
    "environment": {"status": "healthy", "message": "16 optional var(s) not configured (acceptable)"},
    "resources": {"status": "healthy", "message": "RSS: 146MB (no limit reported)"}
  }
}
```

## Key observation

`buildId: f2ac8d8` confirms production is serving the Phase 2 commit `f2ac8d8c` (immutable audit log + RLS Batch 1 + 5 SOC 2 policy docs). The CI deploy workflow shows "failure" but Vercel git-integration appears to have deployed independently.

## Verdict: PASS (5/5 endpoints healthy)
