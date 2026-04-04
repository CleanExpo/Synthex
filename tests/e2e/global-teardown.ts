/**
 * Global teardown for E2E tests.
 *
 * This is used to print manual verification gates at the *end* of a run.
 * It intentionally does not fail the test suite.
 */

export default async function globalTeardown() {
  // Intentionally printed to stdout (not assertions). This should always
  // appear at the end of the run to prompt the manual verification steps.
  console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║              PRODUCTION — HUMAN VERIFICATION GATES                  ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  After automated tests pass, complete these manually:                ║
║                                                                      ║
║  [ ] 1. Full signup → email confirm → 5-step onboarding → dashboard  ║
║                                                                      ║
║  [ ] 2. Stripe checkout → tier shows Pro                             ║
║         → webhook confirmed in Stripe dashboard                      ║
║                                                                      ║
║  [ ] 3. Live Instagram OAuth → connection confirmed                  ║
║                                                                      ║
║  [ ] 4. Post schedule → notification bell badge count correct        ║
║                                                                      ║
║  [ ] 5. Register Linear webhook URL (UNI-1180)                       ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
  `);
}
