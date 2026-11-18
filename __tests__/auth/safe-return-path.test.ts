/**
 * SYN-1215: the ?redirect= value that proxy.ts, requireOrganisationPageAccess
 * and the invite-accept page put on /login must survive sign-in, but only
 * when it is a same-site path. Anything that could leave the site is dropped.
 */
import { safeReturnPath } from '@/lib/auth/safe-return-path';

describe('safeReturnPath', () => {
  it.each([
    ['/invite/accept?token=abc123', '/invite/accept?token=abc123'],
    ['/dashboard/content', '/dashboard/content'],
    ['/onboarding/season-brief', '/onboarding/season-brief'],
    ['/dashboard?tab=week#top', '/dashboard?tab=week#top'],
  ])('keeps the same-site path %s', (raw, expected) => {
    expect(safeReturnPath(raw)).toBe(expected);
  });

  it.each([
    [null],
    [undefined],
    [''],
    ['dashboard'],
    ['https://evil.example/phish'],
    ['//evil.example/phish'],
    ['/\\evil.example'],
    ['/\t/evil.example'],
    ['javascript:alert(1)'],
    ['/%2F%2Fevil.example'],
    ['/login'],
    ['/login?redirect=/dashboard'],
    ['/signup'],
    ['/api/auth/user'],
    ['/' + 'a'.repeat(2100)],
  ])('drops the unsafe or looping value %p', raw => {
    expect(safeReturnPath(raw as string | null | undefined)).toBeNull();
  });
});
