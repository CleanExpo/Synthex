// Compile-time tests for the Equal / doNotExecute helpers themselves.
//
// This file is checked by `tsc --noEmit` (the `typecheck` script). If
// `Equal` mis-reports type equality, this file fails to compile and CI
// goes red.
//
// Naming: `.test-d.ts` is the convention for type-only tests; tsup
// excludes it from the build via the `src/index.ts` entry-point filter.

import { Equal, doNotExecute } from './utils';

doNotExecute(() => {
  // Positive: identical literal types compare equal.
  const a: Equal<true, true> = true;
  void a;

  // Positive: identical string-literal types compare equal.
  const b: Equal<'foo', 'foo'> = true;
  void b;

  // Negative: a string-literal is NOT equal to the wider `string` type.
  // If `as const` narrowing is broken, BRAND.colour.primary becomes
  // `string` and `Equal<typeof BRAND.colour.primary, '#1C2E47'>` falls to
  // `false` — which the consumer-side assertion (`: true`) then rejects.
  const c: Equal<string, 'literal'> = false;
  void c;

  // Negative: object literal types vs widened type.
  const d: Equal<{ x: 1 }, { x: number }> = false;
  void d;
});
