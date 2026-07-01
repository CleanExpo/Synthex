/**
 * Host binding stub — command-packet persistence (SYN-1032).
 *
 * The service logic now lives in `@unite-group/control-module` as a
 * host-agnostic factory `createCommandPacketService(prisma)`. This stub binds
 * it to Synthex's `@/lib/prisma` client and re-exports the same zero-arg
 * free-function surface every call site (and the `jest.mock('@/lib/prisma')`
 * test) already depends on — no import string changes.
 *
 * @module lib/unite-command-center/intake/command-packet.service
 */
import { prisma } from '@/lib/prisma';
import { createCommandPacketService } from '@unite-group/control-module/intake/command-packet.service';

export * from '@unite-group/control-module/intake/command-packet.service';

const svc = createCommandPacketService(prisma);

export const persistCommandPacket = svc.persistCommandPacket;
export const listCommandPackets = svc.listCommandPackets;
export const getCommandPacket = svc.getCommandPacket;
export const transitionCommandPacket = svc.transitionCommandPacket;
