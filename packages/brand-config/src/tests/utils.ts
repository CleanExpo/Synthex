// Type-test helpers for compile-time assertions on BrandConfig literals.
//
// Pattern source: Matt Pocock ts-reset/src/tests/utils.ts. The `Equal<X, Y>`
// trick compares two types by their assignability of a function-returning-1-or-2
// — this is the only way TS exposes structural-type equality at the value level.
//
// Usage:
//   import { Equal, doNotExecute } from './utils';
//   doNotExecute(() => {
//     const x: Equal<typeof BRAND.colour.primary, '#1C2E47'> = true;
//     // ^ fails to compile if BRAND.colour.primary is `string` rather than the literal
//   });
//
// `doNotExecute` exists so the body is type-checked but never run at test time
// — the assertion lives in the type system, not in runtime behaviour.

export type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2)
    ? true
    : false;

export const doNotExecute = (_fn: () => unknown) => {};
