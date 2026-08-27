/**
 * Realtime compatibility shim.
 *
 * SYN-1070 deleted lib/realtime.ts. This shim re-exports from the new
 * lib/platform/realtime.ts so legacy components continue to compile.
 */

export { realtimeService } from '@/lib/platform/realtime';
export type {
  RealtimeMessage,
  RealtimePresence,
} from '@/lib/platform/realtime';
