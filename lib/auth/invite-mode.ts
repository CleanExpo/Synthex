/**
 * Invite-only market mode.
 *
 * The gate is OFF unless NEXT_PUBLIC_INVITE_ONLY_MODE is the literal
 * string 'true'. Unset or any other value leaves signup open; invite
 * codes remain optional on the create-account form.
 *
 * Client-safe: no server-only imports. Server-side evidence checks live in
 * lib/auth/invite-gate.ts.
 */
export function isInviteOnlyMode(): boolean {
  return process.env.NEXT_PUBLIC_INVITE_ONLY_MODE === 'true';
}
