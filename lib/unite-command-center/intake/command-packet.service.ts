/**
 * Binding stub — the ONE file that threads Synthex's prisma client into the
 * host-agnostic `createCommandPacketService` factory from @unite-group/control-module.
 * Reproduces the original module's public surface (the four bound free functions, the
 * pure `deriveSafetyFlags` helper, and the shared types) so every importer and the
 * `jest.mock('@/lib/prisma')` service test are unchanged.
 */
import { prisma } from '@/lib/prisma';
import { createCommandPacketService } from '@unite-group/control-module';

export type {
  CommandPacketStatus,
  CommandPacketAction,
  PersistCommandPacketInput,
  TransitionResult,
  PersistedCommandPacket,
} from '@unite-group/control-module';
export { deriveSafetyFlags } from '@unite-group/control-module';

const service = createCommandPacketService(prisma);

export const persistCommandPacket = service.persistCommandPacket;
export const listCommandPackets = service.listCommandPackets;
export const getCommandPacket = service.getCommandPacket;
export const transitionCommandPacket = service.transitionCommandPacket;
