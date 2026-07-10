/**
 * Invite-only market mode — FAIL CLOSED (Track A, consumption boundary).
 *
 * The open-market door is shut unless NEXT_PUBLIC_INVITE_ONLY_MODE is the
 * literal string 'false'. An unset, empty, or typo'd flag keeps the gate ON.
 *
 * Client-safe: no server-only imports. Server-side evidence checks live in
 * lib/auth/invite-gate.ts.
 */
export function isInviteOnlyMode(): boolean {
  return process.env.NEXT_PUBLIC_INVITE_ONLY_MODE !== 'false';
}
