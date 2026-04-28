/**
 * Typed in-process pub/sub for SYN-836 ContractorOnboardedEvent.
 *
 * Why not Node's built-in EventEmitter:
 * - Untyped (`(eventName: string, ...args: any[])` shape)
 * - Subscribe pattern is `on(name, fn)` / `off(name, fn)` — easy to leak
 *   on missed `off` calls
 * - Errors thrown by handlers can crash the emitter
 *
 * This emitter is small, typed, and:
 * - Returns an unsubscribe closure from `subscribe()` (no name to remember)
 * - Awaits all handlers in parallel via `Promise.allSettled` so one
 *   handler's rejection does not break siblings
 * - Logs per-handler failures via `lib/logger`
 * - Caller cannot accidentally pass the wrong event shape (compile-time error)
 *
 * @see SYN-836 (parent: SYN-834 epic)
 */

import { logger } from '@/lib/logger';
import type {
  ContractorOnboardedEvent,
  ContractorOnboardedHandler,
  Subscription,
} from './types';

/**
 * Module-level subscriber set. Module is a singleton — every import shares
 * the same subscriber list within a process. (For multi-process broadcasting
 * use a real bus; this is in-process only.)
 */
const handlers = new Set<ContractorOnboardedHandler>();

/**
 * Subscribe to ContractorOnboardedEvent. Returns an unsubscribe closure.
 *
 * Idempotent: registering the same handler twice has no effect.
 */
export function subscribeContractorOnboarded(
  handler: ContractorOnboardedHandler
): Subscription {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

/**
 * Notify all subscribers of a ContractorOnboardedEvent.
 * Returns the count of handlers that ran and the count that threw.
 *
 * Per-handler errors are caught + logged; sibling handlers still run.
 */
export async function notifyContractorOnboarded(
  event: ContractorOnboardedEvent
): Promise<{ notified: number; failed: number }> {
  const snapshot = [...handlers];
  if (snapshot.length === 0) {
    return { notified: 0, failed: 0 };
  }

  const results = await Promise.allSettled(
    snapshot.map(handler => Promise.resolve().then(() => handler(event)))
  );

  let failed = 0;
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'rejected') {
      failed++;
      logger.error('[contractor.event] subscriber threw', {
        sourceOfTruthJobId: event.sourceOfTruthJobId,
        contractorId: event.contractorId,
        handlerIndex: i,
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  }
  return { notified: snapshot.length, failed };
}

/**
 * For tests only: clear the subscriber set between cases.
 * @internal
 */
export function _resetContractorEventSubscribersForTests(): void {
  handlers.clear();
}

/**
 * For tests only: peek at the current subscriber count.
 * @internal
 */
export function _getContractorEventSubscriberCountForTests(): number {
  return handlers.size;
}
