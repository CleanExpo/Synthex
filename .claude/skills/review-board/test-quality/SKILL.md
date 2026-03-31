# Test Quality Review Specialist

---
name: test-quality
description: Validate test coverage for changed files, test structure (401-403-400-200), no mocked DB, assertion quality
type: review-specialist
severity_levels: [CRITICAL, HIGH, MEDIUM, LOW]
confidence_threshold: 80
---

## Context

This specialist ensures **Synthex test quality** through coverage validation, structure enforcement, and assertion correctness. Tests are the primary safety net for a system managing customer marketing campaigns and financial transactions (Stripe, subscription data).

**Synthex test standards:**
- Jest with ts-jest configuration
- All API routes (POST/PUT/PATCH/DELETE) require test files in `__tests__/api/`
- Database tests use **real Supabase** (never mock Prisma) — mock factories defined inline in test files
- API test structure: **401 (unauthenticated) → 403 (wrong org) → 400 (invalid input) → 200 (success)**
- Component tests validate rendered output, not implementation details
- Assertion-free tests are blocker-level failures
- Known pre-existing failures: 16 Stripe test failures, 1 notifications-crud failure (not flagged)

**Test runner:** `npm test` (Jest)
**Coverage target:** >80% for changed files (soft requirement)

---

## Severity Mapping

### CRITICAL
- **New API route without test file** (POST/PUT/PATCH/DELETE routes must have tests)
- **Test mocking database** (Prisma mock, database mock, etc. — must use real Supabase)
- **Assertion-free test** (test runs but has no `expect()` statements — false positive)
- **Missing 401/403 test cases for protected endpoints** (auth endpoints must test both unauthenticated and wrong-org scenarios)

**Impact:** Route is untested or auth bypass is undetected; data corruption or cross-org data leak possible.

**Confidence:** Always report if you can confirm the violation.

### HIGH
- **Test file exists but new route logic is untested** (route handler modified, no new test cases added)
- **Test names do not describe expected behaviour** (test name like `it('works')` instead of `it('should return 401 when unauthenticated')`)
- **Only happy path tested** (missing error case coverage: null input, empty string, boundary values, missing required fields)
- **Snapshot test on frequently-changing component** (snapshot on form component, modal, or campaign builder — brittle, noisy diffs)
- **Error handling not tested** (try-catch blocks in route handler, no test case for error path)

**Impact:** Hidden bugs in error conditions; false confidence in test coverage.

**Confidence:** Report at 85%+.

### MEDIUM
- **Missing edge case tests** (null values, empty arrays, boundary integers, very long strings)
- **No describe blocks or loose test organisation** (all tests at top level instead of grouped in `describe()`)
- **Duplicated setup code** (same mock data created in multiple tests — should use `beforeEach()`)
- **Missing happy-path assertion** (test calls endpoint but doesn't validate response shape or key fields)
- **Incomplete Zod validation testing** (route validates input with Zod, but test doesn't verify invalid input is rejected)

**Impact:** Tests are harder to maintain and less confidence in data shape correctness.

**Confidence:** Report at 80%+.

### LOW
- **Inconsistent test file naming** (test file named `foo.test.ts` vs `foo.spec.ts` vs `foo.unit.ts`)
- **Missing JSDoc comments on test helpers**
- **Magic numbers in tests** (hardcoded IDs, timestamps without explanation)
- **Unused test utilities** (imported mock factory not used in any test)

**Impact:** Readability and maintainability, not correctness.

**Confidence:** Report at 80%+.

---

## Checklist

Before reporting a finding:

- [ ] Is this a new route or modified route handler logic? (If modified, are new tests added?)
- [ ] Does the test file exist in the correct location (`__tests__/api/path/route.test.ts`)?
- [ ] Are all CRUD operations tested? (GET, POST, PUT, PATCH, DELETE each need coverage)
- [ ] For protected endpoints: are 401 and 403 cases tested separately?
- [ ] Does the test actually call the endpoint (not just mock it)?
- [ ] Are database interactions tested with real Supabase (not mocked)?
- [ ] Does every test have at least one `expect()` statement?
- [ ] Is the test name descriptive (what should happen, not how)?
- [ ] Are edge cases covered (null, empty, boundary values)?
- [ ] Is the error case tested (what happens if validation fails)?
- [ ] Are pre-existing test failures excluded (16 Stripe, 1 notifications-crud)?

---

## Output Format

```json
{
  "specialist": "test-quality",
  "tier": "high-risk",
  "duration_ms": 0,
  "findings": [
    {
      "severity": "CRITICAL|HIGH|MEDIUM|LOW",
      "confidence": 85,
      "file": "app/api/campaigns/route.ts",
      "line": 1,
      "issue": "New POST route added but no test file in __tests__/api/campaigns/route.test.ts",
      "fix": "Create __tests__/api/campaigns/route.test.ts with 401, 403, 400, 200 test cases",
      "reference": "__tests__/api/posts/route.test.ts"
    }
  ],
  "summary": {
    "critical": 1,
    "high": 0,
    "medium": 0,
    "low": 0
  },
  "verdict": "BLOCK"
}
```

**Rules:**
- `file` is the modified route or test file path
- `line` is best-effort (line where the gap exists)
- `confidence` must be ≥80 to include
- `verdict` = "BLOCK" if any CRITICAL, else "PASS"
- Reference a similar well-tested route if suggesting pattern

---

## Synthex-Specific Rules

### API Test Structure (Non-Negotiable)
Every protected endpoint test **MUST** follow this order:

```typescript
describe('POST /api/campaigns', () => {
  // 1. Test 401 — no auth
  it('should return 401 when unauthenticated', async () => {
    const res = await fetch('/api/campaigns', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  // 2. Test 403 — wrong org
  it('should return 403 when user not in organisation', async () => {
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenFromOtherOrg}` },
    });
    expect(res.status).toBe(403);
  });

  // 3. Test 400 — invalid input (multiple cases)
  it('should return 400 when name is missing', async () => {
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { Authorization: `Bearer ${validToken}` },
      body: JSON.stringify({ /* no name */ }),
    });
    expect(res.status).toBe(400);
    expect(res.json()).toContain('name');
  });

  it('should return 400 when posting_mode is invalid', async () => {
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { Authorization: `Bearer ${validToken}` },
      body: JSON.stringify({ name: 'Test', posting_mode: 'invalid_mode' }),
    });
    expect(res.status).toBe(400);
  });

  // 4. Test 200 — success (happy path)
  it('should return 200 and create campaign when input is valid', async () => {
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { Authorization: `Bearer ${validToken}` },
      body: JSON.stringify({ name: 'Q2 Campaign', posting_mode: 'scheduled' }),
    });
    expect(res.status).toBe(200);
    expect(res.json()).toHaveProperty('id');
  });
});
```

### Database Testing (Real Supabase, No Mocks)
- **NEVER mock Prisma** — use real test database or Supabase test fixtures
- **Create test data inline** — factory functions at top of test file:
  ```typescript
  const createTestCampaign = async (orgId: string) => {
    return prisma.campaign.create({
      data: { name: 'Test', org_id: orgId },
    });
  };
  ```
- **Clean up after tests** — use `afterEach()` to delete test records:
  ```typescript
  afterEach(async () => {
    await prisma.campaign.deleteMany({ where: { name: 'Test' } });
  });
  ```

### Test File Location and Naming
- **API routes**: `__tests__/api/path/to/route.test.ts` (matches `app/api/path/to/route.ts`)
- **Lib services**: `__tests__/lib/service-name.test.ts` (matches `lib/service-name.ts`)
- **React components**: `__tests__/components/ComponentName.test.tsx` (matches `components/ComponentName.tsx`)
- **Naming convention**: `*.test.ts` or `*.test.tsx` (not `.spec.ts`)

### Assertion Quality
- **Every test must have at least one `expect()`** — test runner will pass a test with no assertions (false positive)
- **Assert response shape** — not just status code:
  ```typescript
  // ❌ INSUFFICIENT
  expect(res.status).toBe(200);

  // ✅ COMPLETE
  expect(res.status).toBe(200);
  expect(res.json()).toHaveProperty('id');
  expect(res.json().id).toBeDefined();
  ```
- **Assert error messages** for 400/422 responses:
  ```typescript
  expect(res.json().errors).toContain('name is required');
  ```

### Known Test Failures (Do NOT Flag)
- **16 Stripe-related test failures** — pre-existing, not introduced by recent PRs
- **1 notifications-crud test failure** — pre-existing schema issue
- Do NOT flag these in test-quality review (inform user but set confidence 0)

### Component Testing
- **Do not test implementation details** (internal state, function calls)
- **Test user-visible behaviour** (what appears on screen, what happens when clicked)
- **Avoid snapshot tests on frequently-changing components** (campaign builder, forms)
- **Do use snapshots for** static layouts, fixed UI patterns (if they rarely change)

### Coverage Targets
- **API routes**: >90% (every code path must be tested)
- **Services**: >85% (error paths, happy path, edge cases)
- **Components**: >70% (primary user flows, error states)
- **Soft requirement**: coverage decrease is noted but not blocking

### Excluded from Review
- **Mock factories in `__tests__/fixtures/`** — review actual test code
- **Pre-existing test failures** — do not flag as HIGH/CRITICAL
- **Integration tests** in separate `__tests__/e2e/` directory — handled separately
- **Skipped tests** (`it.skip()`) — only flag if no alternative coverage exists

---

## Methodology

1. **Scan for test files** — check if changed routes/services have corresponding test files
2. **Parse test structure** — verify 401-403-400-200 order for API tests
3. **Check assertions** — count `expect()` statements, verify they validate response shape
4. **Database mocking** — flag any Prisma mocks or database stubs
5. **Coverage gaps** — identify untested code paths (error handlers, edge cases)
6. **Test names** — verify names describe expected behaviour
7. **Report findings** — only confidence ≥80%, map to severity, suggest reference test

---

## Examples

### Example 1: CRITICAL — New route without test file
```typescript
// ❌ FAIL: app/api/campaigns/[id]/publish/route.ts created, no test file
// app/api/campaigns/[id]/publish/route.ts
export async function POST(req, { params }) {
  // 50 lines of logic
}

// __tests__/api/campaigns/[id]/publish/route.test.ts does NOT exist
```

**Finding:**
- Severity: CRITICAL
- Issue: New POST route added but no test file exists
- Fix: Create `__tests__/api/campaigns/[id]/publish/route.test.ts` with 401/403/400/200 cases
- Reference: `__tests__/api/campaigns/route.test.ts`

### Example 2: CRITICAL — Test with no assertions
```typescript
// ❌ FAIL
it('should create a campaign', async () => {
  const res = await fetch('/api/campaigns', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: 'Test' }),
  });
  // No expect() — test passes even if res.status is 500
});

// ✅ PASS
it('should return 200 and create a campaign', async () => {
  const res = await fetch('/api/campaigns', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: 'Test' }),
  });
  expect(res.status).toBe(200);
  expect(res.json()).toHaveProperty('id');
});
```

**Finding:**
- Severity: CRITICAL
- Issue: Test has no assertions; false positive pass
- Fix: Add `expect()` statements validating response status and shape

### Example 3: HIGH — Missing 403 test case
```typescript
// ❌ FAIL: only tests 401 and 200
describe('POST /api/campaigns', () => {
  it('should return 401 when unauthenticated', async () => {
    const res = await fetch('/api/campaigns', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('should return 200 when valid', async () => {
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { Authorization: `Bearer ${validToken}` },
      body: JSON.stringify({ name: 'Test' }),
    });
    expect(res.status).toBe(200);
  });
  // No 403 test for wrong org
});

// ✅ PASS: includes 403
it('should return 403 when user not in organisation', async () => {
  const res = await fetch('/api/campaigns', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenFromOtherOrg}` },
  });
  expect(res.status).toBe(403);
});
```

**Finding:**
- Severity: HIGH
- Issue: Missing 403 test case (org-scoped security not validated)
- Fix: Add test for unauthenticated user in different organization

### Example 4: MEDIUM — Missing edge case test
```typescript
// ❌ FAIL: only tests valid name
describe('POST /api/campaigns', () => {
  it('should return 200 when input is valid', async () => {
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { Authorization: `Bearer ${validToken}` },
      body: JSON.stringify({ name: 'Test Campaign' }),
    });
    expect(res.status).toBe(200);
  });
  // No test for empty name, null, missing field
});

// ✅ PASS: includes edge cases
it('should return 400 when name is empty string', async () => {
  const res = await fetch('/api/campaigns', {
    method: 'POST',
    headers: { Authorization: `Bearer ${validToken}` },
    body: JSON.stringify({ name: '' }),
  });
  expect(res.status).toBe(400);
});

it('should return 400 when name is missing', async () => {
  const res = await fetch('/api/campaigns', {
    method: 'POST',
    headers: { Authorization: `Bearer ${validToken}` },
    body: JSON.stringify({}),
  });
  expect(res.status).toBe(400);
});
```

**Finding:**
- Severity: MEDIUM
- Issue: Edge cases not tested (empty string, missing field)
- Fix: Add test cases for boundary values and required field validation

---

## References

- Jest docs: [https://jestjs.io/docs/getting-started](https://jestjs.io/docs/getting-started)
- Synthex test reference: `__tests__/api/posts/route.test.ts`
- Synthex test reference: `__tests__/api/campaigns/route.test.ts`
- Test structure pattern: "401-403-400-200" order
