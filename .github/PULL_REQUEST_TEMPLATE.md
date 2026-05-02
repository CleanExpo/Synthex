# Pull Request

## Summary

<!-- One-paragraph description of what this PR changes and why. -->

## Linear issue

<!-- Required per CLAUDE.md: every code change must trace to a Linear issue. -->

SYN-XXXX

## Type of change

- [ ] Bug fix (non-breaking)
- [ ] New feature (non-breaking)
- [ ] Breaking change (existing behaviour modified)
- [ ] Refactor (no behaviour change)
- [ ] Documentation
- [ ] Build / CI / tooling
- [ ] Database schema change

## Test plan

<!-- How was this verified? Be specific — paste curl output, test counts, screenshots. Banned phrases per CLAUDE.md: "should work", "probably passes", "seems correct", "likely fixed". -->

- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes (paste the `Tests: X passed, Y total` line)
- [ ] Verified manually in [environment]

## Database / migration impact

<!-- Skip if no schema change. Otherwise: -->

- [ ] Schema changes are backward-compatible OR a rollback plan is documented
- [ ] `npx prisma validate` passes
- [ ] No `prisma db push` was used; migration was generated via `migrate diff` + `db execute`

## Security review

- [ ] No secrets, credentials, or tokens are committed
- [ ] No new external HTTP calls without `validateExternalUrl()` (SSRF guard)
- [ ] All new mutations require Zod validation
- [ ] All new queries are scoped by `organizationId` where applicable

## Verification checklist (per `.claude/rules/verification-gate.md`)

- [ ] If UI changed: where to check, navigation steps, expected state described in this PR
- [ ] If API changed: curl command + actual output pasted

## Breaking changes

<!-- List anything callers of this code (other services, external consumers, internal docs) need to update. Otherwise: "None." -->

None.

## Related

<!-- Optional: link related PRs, design docs, decisions. -->
