/**
 * Invite-only market mode — FAIL CLOSED (Track A, consumption boundary).
 *
 * The gate is ON unless NEXT_PUBLIC_INVITE_ONLY_MODE is the literal string
 * 'false'. An unset, empty or typo'd flag keeps it ON, so a deployment that
 * forgets the variable cannot open self-serve signup. With the gate on, the
 * create-account form requires an invite code and the server refuses
 * account and organisation creation without invite evidence.
 *
 * NEXT_PUBLIC_* values are inlined at build time: changing the variable
 * takes effect on the next build, not on a running deployment.
 *
 * Client-safe: no server-only imports. Server-side evidence checks live in
 * lib/auth/invite-gate.ts.
 */
export function isInviteOnlyMode(): boolean {
  return process.env.NEXT_PUBLIC_INVITE_ONLY_MODE !== 'false';
}
