/**
 * React Testing Library async-utility timeout.
 *
 * WHY THIS EXISTS. RTL's `waitFor` / `findBy*` default to a 1000ms window. This repo runs
 * ~8,400 tests across parallel jest workers, and under that load a mocked fetch resolving
 * plus a React re-render routinely takes longer than one second. The assertion then reports
 * "Unable to find an element with the text: ..." - which reads exactly like a broken
 * component, and is not.
 *
 * MEASURED, not assumed. Two release-gate receipt runs of the SAME commit
 * (fe05fcad092ab9af3c860a41f338cf9bd684aa28) produced DISJOINT failure sets:
 *
 *   run A (15-min load average 80.89):  ConnectionSpinePanel
 *   run B (load recovering):            IntegrationsReconnect, DraftCommandIntakePanel,
 *                                       IntentScapeWorkspace   <- ConnectionSpinePanel PASSED
 *
 * No test failed in both. Identical code, different failures, is nondeterminism by
 * definition. ConnectionSpinePanel was also run alone and passed in 152ms, having failed at
 * 4312ms inside the full suite.
 *
 * WHY THIS IS NOT MASKING A DEFECT. Raising the window cannot turn a failing render into a
 * passing one: an element that never appears still never appears, and the test still fails -
 * just later. The only behaviour that changes is how long the harness tolerates scheduling
 * delay before declaring a verdict. jest's own `testTimeout` in this repo is already 30000ms,
 * so 5000ms sits well inside the existing budget and a genuinely hung test still fails fast
 * relative to that.
 *
 * The cost of NOT doing this is concrete: the release gate requires a fully green suite to
 * mint a receipt, so a random 1-3 test failures per run means no branch can ship reliably,
 * however good it is. Two finished, independently-reviewed branches were blocked by exactly
 * this.
 */
const { configure } = require('@testing-library/react');

configure({ asyncUtilTimeout: 5000 });
