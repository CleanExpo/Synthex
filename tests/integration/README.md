# Integration tests — Docker verification sandbox (SYN-MCP-000)

Integration tests (`*.integration.test.ts`) run against an **ephemeral** Docker sandbox — never prod, never staging.

## Run locally

```powershell
# On this Windows box use PowerShell for docker (the Bash tool lacks network egress)
npm run sandbox:up          # Postgres (pgvector:pg16) on :5499 + Redis (7-alpine) on :6399
npm run test:integration    # jest --config jest.integration.cjs --runInBand
npm run sandbox:down        # tear down containers + volumes (data is tmpfs — gone anyway)
```

## The 5499/6399 guard

`tests/integration/setup/global-setup.ts` **hard-fails** unless `DATABASE_URL` contains `:5499/` and `REDIS_URL` contains `:6399` (defaults: `postgres://postgres:test@localhost:5499/synthex_test`, `redis://localhost:6399`). Non-standard ports = impossible to point at a real DB. Schema is materialised via `prisma db push` of a **sandbox-patched copy** (migrations are non-authoritative here, and the pristine schema has a pre-existing uuid/text FK mismatch on the testimonial models that blocks a fresh push — see global-setup.ts), then seeded.

## Seed fixtures (fixed IDs)

`itest-org` (Organization) · `itest-user` (User, member) · `itest-bos` (BrandOperatingSystem) · `itest-client-profile` (ClientProfile) · `itest-brand-dna` (BrandDNA) · `itest-campaign` (MarketingAgencyCampaign) · `itest-source-ref` (MarketingAgencySourceRef) · `itest-claim` (MarketingAgencyClaim, evidenceStatus `blocked`)

Legacy `*.test.ts` files in this directory predate the sandbox and still run in the unit profile; new container-backed tests must use the `*.integration.test.ts` suffix.
