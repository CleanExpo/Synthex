import { render } from '@testing-library/react';
import { RouteIdentity } from '@/components/system/RouteIdentity';

/**
 * These attribute names are a CONTRACT with the required post-deploy gate.
 * `scripts/smoke-test.mjs` greps the served HTML for exactly these strings to
 * decide whether the advertised page really rendered. Renaming an attribute
 * here without changing the script would not fail a type-check or a lint - it
 * would silently make the production gate unable to find its own signal, which
 * is the failure this test exists to prevent. They are written as literals on
 * purpose: importing them from a shared constant would let both sides drift
 * together and still pass.
 */
const ROUTE_ATTR = 'data-synthex-route';
const BUILD_ATTR = 'data-synthex-build';

describe('RouteIdentity', () => {
  test('emits the requested route under the attribute the smoke gate reads', () => {
    const { container } = render(<RouteIdentity route="/login" />);
    const marker = container.querySelector(`[${ROUTE_ATTR}]`);

    expect(marker).not.toBeNull();
    expect(marker?.getAttribute(ROUTE_ATTR)).toBe('/login');
  });

  test('carries a non-empty build id even when the deploy env is absent', () => {
    // An empty build id would be a silent hole: the gate would read a present
    // attribute with nothing in it. With VERCEL_GIT_COMMIT_SHA unset, as it is
    // in this test environment, the component must still say something.
    const { container } = render(<RouteIdentity route="/" />);
    const build = container
      .querySelector(`[${BUILD_ATTR}]`)
      ?.getAttribute(BUILD_ATTR);

    expect(build).toBe('local');
  });

  test('is a single hidden element that adds nothing visible to the page', () => {
    const { container } = render(<RouteIdentity route="/pricing" />);

    expect(container.childElementCount).toBe(1);
    const marker = container.firstElementChild as HTMLElement;
    expect(marker.tagName).toBe('SPAN');
    expect(marker.hidden).toBe(true);
    expect(marker.textContent).toBe('');
  });

  test('does not emit a marker for a route it was not given', () => {
    // The gate treats a different route's marker as a hard failure, which is
    // what catches "the homepage served at /login". That only works if the
    // component reports the route it was handed and nothing else.
    const { container } = render(<RouteIdentity route="/pricing" />);

    expect(container.querySelector(`[${ROUTE_ATTR}="/login"]`)).toBeNull();
    expect(
      container.querySelector(`[${ROUTE_ATTR}="/pricing"]`)
    ).not.toBeNull();
  });
});
