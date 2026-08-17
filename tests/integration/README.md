# Integration tests — CI sandbox (SYN-MCP-000)

Integration tests (`*.integration.test.ts`) run against ephemeral Postgres + Redis
service containers in GitHub Actions — never prod, never staging.

## Run

```bash
npm run test:integration    # jest --config config/jest/jest.integration.cjs --runInBand
```

Locally this only passes when `DATABASE_URL` contains `:5499/` and `REDIS_URL`
contains `:6399` (same ports the CI workflow publishes). Schema is materialised
via a sandbox-patched `prisma db push` in global-setup.ts.

## The 5499/6399 guard

`tests/integration/setup/global-setup.ts` **hard-fails** unless `DATABASE_URL` contains `:5499/` and `REDIS_URL` contains `:6399` (defaults: `postgres://postgres:test@localhost:5499/synthex_test`, `redis://localhost:6399`). Non-standard ports = impossible to point at a real DB. Schema is materialised via `prisma db push` of a **sandbox-patched copy** (migrations are non-authoritative here, and the pristine schema has a pre-existing uuid/text FK mismatch on the testimonial models that blocks a fresh push — see global-setup.ts), then seeded.

## Seed fixtures (fixed IDs)

`itest-org` (Organization) · `itest-user` (User, member) · `itest-bos` (BrandOperatingSystem) · `itest-client-profile` (ClientProfile) · `itest-brand-dna` (BrandDNA) · `itest-campaign` (MarketingAgencyCampaign) · `itest-source-ref` (MarketingAgencySourceRef) · `itest-claim` (MarketingAgencyClaim, evidenceStatus `blocked`)

Legacy `*.test.ts` files in this directory predate the sandbox and still run in the unit profile; new container-backed tests must use the `*.integration.test.ts` suffix.
