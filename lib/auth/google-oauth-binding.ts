import type { NextRequest, NextResponse } from 'next/server';

export const GOOGLE_OAUTH_BINDING_COOKIE = 'google-oauth-binding';
export const GOOGLE_OAUTH_BINDING_TTL_SECONDS = 10 * 60;

const bindingCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export function getGoogleOAuthBinding(
  request: NextRequest
): string | undefined {
  return request.cookies.get(GOOGLE_OAUTH_BINDING_COOKIE)?.value;
}

export function setGoogleOAuthBinding(
  response: NextResponse,
  state: string
): void {
  response.cookies.set(GOOGLE_OAUTH_BINDING_COOKIE, state, {
    ...bindingCookieOptions,
    maxAge: GOOGLE_OAUTH_BINDING_TTL_SECONDS,
  });
}

export function clearGoogleOAuthBinding(response: NextResponse): void {
  response.cookies.set(GOOGLE_OAUTH_BINDING_COOKIE, '', {
    ...bindingCookieOptions,
    maxAge: 0,
  });
}
