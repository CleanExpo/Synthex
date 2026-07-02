# Synthex Connection Status Manifest

Synthex exposes a metadata-only project manifest for Unite-Group Mission Control:

```text
GET /api/v1/connections/status
```

The endpoint is intentionally safe for portfolio polling:

- It does not require authentication because it exposes readiness categories only.
- It does not perform outbound network calls or database reads.
- It only reports whether required references are present; it never returns secret names or values.
- Every connection row is marked `safeForMissionControl: true` so Unite-Group can filter remote manifests confidently.

## Current Coverage

The manifest reports:

- Database
- Auth and tenancy
- Linear intake
- Obsidian / second brain
- Unite-Group CRM
- Hermes escalation
- AI provider mesh
- Google Business / search
- Social publishing
- Stripe billing
- Content pipeline
- Monitoring and alerts

## RANA Handoff

Register the deployed Synthex endpoint in Unite-Group Command Centre as the `integration_status_url` for the Synthex project.

Expected production URL:

```text
https://synthex.social/api/v1/connections/status
```

After registration, Mission Control can show Synthex readiness alongside Dimitri, RestoreAssist, and other project manifests.
