/**
 * Deterministic render-completion for component suites.
 *
 * WHY THIS EXISTS. `waitFor` / `findBy*` poll against a wall-clock deadline
 * (1000ms by default). This repo runs ~8,400 tests across parallel jest
 * workers, and under that load a mocked fetch resolving plus a React re-render
 * can lose that race. The assertion then reports "Unable to find an element
 * with the text: ..." — which reads exactly like a broken component and is
 * not one. Two release-gate runs of commit fe05fcad produced DISJOINT failure
 * sets from identical code, which is nondeterminism by definition.
 *
 * WHY NOT JUST RAISE THE DEADLINE. Because the deadline is also the detector.
 * A 5000ms window lets a component that takes 1200ms to render its data pass,
 * so the change that buys green also destroys the signal for delayed-render
 * regressions. That trade was reviewed and rejected.
 *
 * WHAT THIS DOES INSTEAD. React's async `act` drains the microtask queue and
 * flushes the React work that results from it, and it has NO deadline of its
 * own — it returns when the work is done, however long the scheduler took to
 * get a slice of CPU. A mocked fetch is entirely microtasks
 * (`Promise.resolve(response)` → `res.json()` → `setState`, chained), so one
 * call always completes it. Load can make this slower; it cannot change the
 * verdict. jest's own `testTimeout` (30000ms) remains the only ceiling, and a
 * genuinely hung render still hits it.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It never advances real time. A component
 * that puts a real timer in its data path is NOT waited out: the element is
 * still absent when `settle` returns and the assertion fails at once. That
 * makes detection of a delayed-render regression strictly SHARPER than the
 * 1000ms default it replaces — the reviewer's 1200ms mutant fails immediately
 * rather than after a second of polling.
 *
 * There is deliberately no tunable here. A pass count would be the same class
 * of magic number as the timeout it replaces; if one call is ever not enough,
 * that means a real macrotask entered the path under test and is a finding,
 * not a number to raise.
 *
 * KNOWN RESIDUAL - tracked as SYN-1195, not merely noted here.
 *
 * This converts the 19 call sites in the four suites OBSERVED failing across two
 * receipt runs of fe05fcad. The identical mechanism remains in 20 other test files,
 * 67 further call sites, all still resolving on the 1000ms wall-clock default. Those
 * sites were on that default before this branch and are on it again after, so this is
 * a strict improvement rather than a complete fix - but the four converted here are
 * the suites that happened to lose the race, not the set exposed to it. If the release
 * gate keeps flaking, that is where it comes from.
 *
 * A note for whoever closes SYN-1195, because it cost eight runs to learn: a CPU-spin
 * load rig is NOT a control for this. The pre-fix tree passed 8 of 8 under load average
 * 133 with ten real jest workers, so a green result from that rig is a null result from
 * a check never shown capable of failing. Shrink the RTL async window to 1ms instead -
 * that tests the property (the verdict must not depend on wall-clock time) rather than
 * hoping to be unlucky.
 */
import { act } from '@testing-library/react';

export async function settle(): Promise<void> {
  await act(async () => {});
}
