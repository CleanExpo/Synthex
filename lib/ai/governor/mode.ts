/**
 * GOVERNOR — enforcement mode (P5).
 *
 * 'shadow': every gate is evaluated and a would-be refusal is logged and
 * receipted, but the call still runs. 'enforcing': a refusal blocks the call.
 *
 * Routes pass `mode: GOVERNOR_MODE`. scripts/fleet/check-governor-mode.mjs
 * parses this constant; the flip to 'enforcing' is a human act (P9), never a
 * fleet commit.
 */
export type GovernorMode = 'shadow' | 'enforcing';

export const GOVERNOR_MODE: GovernorMode = 'shadow';
