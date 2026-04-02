# Review Board — Specialist Output Schema

Every specialist MUST produce findings in this exact JSON structure.
The Chief Reviewer parses this format; deviations will be discarded.

## Schema

```json
{
  "specialist": "<skill-id>",
  "tier": "<trivial|standard|high-risk|critical>",
  "duration_ms": 0,
  "findings": [
    {
      "severity": "CRITICAL|HIGH|MEDIUM|LOW",
      "confidence": 85,
      "file": "relative/path/to/file.ts",
      "line": 42,
      "issue": "One-line description of the problem",
      "fix": "One-line description of the fix",
      "reference": "optional: path to canonical pattern"
    }
  ],
  "summary": {
    "critical": 0,
    "high": 0,
    "medium": 0,
    "low": 0
  },
  "verdict": "BLOCK|PASS"
}
```

## Rules

1. `specialist` must match the skill's `name` frontmatter field exactly
2. `confidence` must be 0-100; the Chief Reviewer discards findings below 80
3. `verdict` is BLOCK if any CRITICAL finding exists, otherwise PASS
4. `file` paths are relative to repo root (e.g., `app/api/auth/route.ts`)
5. `line` is the primary line where the issue occurs (best effort)
6. `reference` is optional — include when a canonical pattern exists in the codebase
7. If the specialist finds nothing, return an empty `findings` array with `verdict: "PASS"`
8. `duration_ms` is self-reported execution time (for metrics tracking)
9. Do NOT include findings with confidence below 80 — filter them yourself before output
10. Do NOT fabricate findings — if uncertain, lower the confidence score rather than guessing
