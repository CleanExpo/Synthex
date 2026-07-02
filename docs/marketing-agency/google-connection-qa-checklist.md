# Google Connection QA Checklist

Run this checklist after each authority action and after every apply run.

## Baseline

- `npm run type-check`
- `npm run validate:google`
- `npm run connections:google:audit`
- `npm run shipit:status:live -- --run-rls`

## Dry-Run Rules

Dry-run passes only when:

- no external Google mutation is called,
- no local DB mapping is changed,
- no token, cookie, OAuth client secret, API key, or service-account JSON is printed,
- each missing connection returns an explicit action.

## Per-Business Read-Only Checks

- Switch to target business.
- Confirm `/api/businesses` shows correct active business.
- Confirm connection exists only for that business.
- List Search Console properties.
- List GA4 properties.
- List GBP locations.
- Confirm Synthex-selected mappings match the business website/name.

## Mutation Gates

Do not run these without explicit approval and rollback/evidence notes:

- Search Console indexing submit.
- GBP post create.
- GBP review reply.
- GBP service-area/category/profile patch.
- YouTube upload/publish.
- Drive folder write/delete.

## Isolation Checks

- Switch away from the business.
- Confirm mapped properties do not appear under a different business.
- Switch back.
- Confirm mappings persist.

## Pass Criteria

A business is green only when required Google surfaces are mapped and read-only sync works without cross-business leakage.
