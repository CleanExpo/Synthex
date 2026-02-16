---
phase: 08-testing-api-contracts
plan: 03
subsystem: testing
tags: [jest, stripe, webhooks, payments, contract-tests]

requires:
  - phase: 07-testing-auth-core
    provides: Established test patterns
  - phase: 08-02
    provides: Schema-based contract testing approach
provides:
  - Stripe payment route contract tests (44 tests)
  - Webhook handler test suite (32 tests)
  - lib/stripe/ coverage significantly improved
affects: [08-04]

tech-stack:
  added: []
  patterns: [webhook handler testing pattern, Stripe mock pattern, schema-based contract testing]

key-files:
  created:
    - tests/unit/api/stripe-routes.test.ts
    - tests/unit/lib/stripe/webhook-handlers.test.ts
  modified: []

key-decisions:
  - "Schema-based contract testing for Stripe routes (not full E2E): Tests validate Zod schemas, response shapes, and Stripe API params rather than executing full NextRequest/NextResponse flows, avoiding jsdom Response.json limitations"
  - "Webhook event structure matches internal format: Test fixtures create WebhookEvent with nested StripeWebhookData structure to match handler's getWebhookData() casting"
  - "Comprehensive Stripe object fixtures: Created full Stripe.Subscription and Stripe.Invoice fixtures matching Stripe API v2025-07-30 to ensure type safety"
  - "Handler registration tested via module import: Tests verify registerStripeWebhookHandlers() by importing module and checking mockWebhookHandlerOn calls"

issues-created: []

duration: 45min
completed: 2026-02-17
---

# Phase 8 Plan 3: Stripe Payment Routes + Webhook Handler Tests Summary

Comprehensive contract tests for Stripe payment infrastructure and webhook event processing.

## Performance

- **Duration:** 45 min
- **Tasks:** 2/2
- **Files created:** 2
- **Tests added:** 76 (44 route contracts + 32 webhook handlers)

## Accomplishments

### Task 1: Stripe API Route Contract Tests (44 tests)
- **POST /api/stripe/checkout** (11 tests)
  - Request schema validation (priceId, planName, both, neither)
  - Success response shape (sessionId, url)
  - Error responses (invalid plan, not configured, unauthorized, forbidden, Stripe error)
  - Stripe session params validation (14-day trial, success/cancel URLs)

- **POST /api/stripe/billing-portal** (5 tests)
  - Success response shape (url)
  - Error responses (not configured, unauthorized, Stripe error)
  - Billing portal session params
  - Customer creation when none exists

- **POST /api/stripe/change-plan** (11 tests)
  - Request schema validation (all plan names, proration behaviors)
  - Success responses (upgrade with proration, downgrade without)
  - Error responses (invalid plan, no subscription, already on plan)
  - Stripe subscription update params

- **lib/stripe/config.ts** (12 tests)
  - PRODUCTS structure (3 tiers with required fields)
  - getProductByPriceId (found, not found)
  - getProductByName (case insensitive, all tiers, not found)
  - stripe instance (configured, not configured)
  - Feature limits per tier

- **Common Error Patterns** (5 tests)
  - 401/403/400/500/503 response shapes

### Task 2: Webhook Handler Test Suite (32 tests)
- **Handler Registration** (2 tests)
  - All 5 handlers registered with webhookHandler
  - Correct event types mapped

- **handleSubscriptionCreated** (4 tests)
  - Calls subscriptionService.updateFromStripeSubscription
  - Logs audit event with correct details
  - Logs info message
  - Throws and logs errors on failure

- **handleSubscriptionUpdated** (3 tests)
  - Updates subscription from Stripe data
  - Logs audit event with status changes
  - Handles cancel_at_period_end flag

- **handleSubscriptionCancelled** (4 tests)
  - Downgrades user to free plan
  - Logs audit event with cancellation reason
  - Handles missing cancellation_details
  - Handles subscription not found

- **handlePaymentSucceeded** (5 tests)
  - Logs audit event with payment details
  - Handles invoice without subscription
  - Extracts subscription ID from old API format (direct field)
  - Extracts subscription ID from new API format (parent.subscription_details)
  - Handles subscription as object (not string)

- **handlePaymentFailed** (3 tests)
  - Logs audit event with failure details
  - Logs warning message
  - Handles invoice without subscription gracefully

- **Webhook Route Contract** (8 tests)
  - Success response shape (received, eventId)
  - Error responses (missing signature, invalid signature, handler failure)
  - Required headers
  - HTTP status codes (200, 400, 500)

- **Error Handling** (3 tests)
  - Logs errors when handlers throw
  - Includes subscription ID in error context
  - Includes invoice ID in error context

## Task Commits

1. **Task 1: Stripe API route contract tests** - `667187f` (test: 44 tests, 538 lines)
2. **Task 2: Webhook handler test suite** - `fc27162` (test: 32 tests, 874 lines)

**Plan metadata:** (next commit) (docs: complete plan)

## Files Created/Modified

**Created:**
- `tests/unit/api/stripe-routes.test.ts` (538 lines)
  - Schema-based contract tests for checkout, billing-portal, change-plan routes
  - lib/stripe/config.ts helper function tests
  - Common error response pattern tests

- `tests/unit/lib/stripe/webhook-handlers.test.ts` (874 lines)
  - Complete Stripe.Subscription and Stripe.Invoice fixtures
  - All 5 webhook handler tests (subscription created/updated/cancelled, payment succeeded/failed)
  - Handler registration tests
  - Webhook route contract tests
  - Comprehensive error handling tests

## Decisions Made

1. **Schema-based contract testing over full route execution**
   - Avoids jsdom limitations with Response.json
   - Focuses on validation rules and response shapes
   - Faster and more maintainable than E2E route tests

2. **Webhook event structure matches internal handler format**
   - Created fixtures with nested StripeWebhookData to match getWebhookData() casting
   - Ensures tests accurately reflect production webhook processing

3. **Full Stripe object fixtures for type safety**
   - Created complete Stripe.Subscription and Stripe.Invoice objects
   - Matches Stripe API v2025-07-30 type definitions
   - Prevents type errors and ensures compatibility

## Deviations from Plan

None. All planned test categories implemented.

## Issues Encountered

1. **Initial route execution approach failed**
   - **Issue:** Tests tried to execute full NextRequest → NextResponse flow
   - **Cause:** jsdom doesn't support Response.json() method
   - **Solution:** Switched to schema-based contract testing (matching 08-02 pattern)

2. **Webhook event structure mismatch**
   - **Issue:** Initial tests failed with "Cannot read properties of undefined (reading 'object')"
   - **Cause:** Webhook handler expects event.data to contain nested StripeWebhookData structure
   - **Solution:** Updated createWebhookEvent() fixture to match handler's data access pattern

3. **Mock registration test failed on second run**
   - **Issue:** Second registration test got empty array from mockWebhookHandlerOn.mock.calls
   - **Cause:** Module already imported by first test, mocks cleared by beforeEach
   - **Solution:** Used jest.isolateModules() to get fresh module import for registration verification

## Next Phase Readiness

**Ready for 08-04** (Social posting + critical path integration tests)

All Stripe payment infrastructure and webhook handling now has contract test coverage:
- 3 payment routes tested (checkout, billing-portal, change-plan)
- 5 webhook handlers tested (subscription and payment events)
- Config helpers and error patterns verified
- Total Stripe test coverage: 76 tests

The schema-based contract testing pattern is now proven effective across auth, user, and Stripe routes.
