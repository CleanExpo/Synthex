/**
 * Calendar connection gate (SYN-1024) — pure.
 *
 * The weekly calendar schedules slots from historical posting signals
 * (`activePlatforms`), which says nothing about whether the platform is still
 * CONNECTED. This gate marks any slot whose platform has no active connection
 * so the UI can show a setup blocker and the publish path can refuse it, rather
 * than attempting to publish to an unconnected account.
 *
 * Pure function — the caller supplies the set of connected platforms (read from
 * PlatformConnection); no secrets, no DB access here.
 */
import type { CalendarPlatform, CalendarSlot } from './types';

/**
 * Annotate slots with `connectionBlocked` / `connectionBlockReason` for any
 * platform not in `connectedPlatforms`. Returns new slot objects; does not
 * mutate the input. Already-set fields on connected slots are cleared so a
 * re-run after connecting an account un-blocks the slot.
 */
export function annotateSlotsConnectivity(
  slots: CalendarSlot[],
  connectedPlatforms: Iterable<CalendarPlatform>,
): CalendarSlot[] {
  const connected = new Set<string>(
    Array.from(connectedPlatforms, (p) => p.toLowerCase()),
  );

  return slots.map((slot) => {
    const isConnected = connected.has(slot.platform.toLowerCase());
    if (isConnected) {
      // Clear any prior block so reconnecting an account frees the slot.
      const { connectionBlocked, connectionBlockReason, ...rest } = slot;
      void connectionBlocked;
      void connectionBlockReason;
      return rest;
    }
    return {
      ...slot,
      connectionBlocked: true,
      connectionBlockReason: `No active ${slot.platform} connection — connect the account before this slot can be published.`,
    };
  });
}

/** Count of slots currently connection-blocked. */
export function countBlockedSlots(slots: CalendarSlot[]): number {
  return slots.filter((s) => s.connectionBlocked === true).length;
}
