/**
 * Command Centre — Synthex barrel (stub tree).
 *
 * Re-exports the extracted `@unite-group/control-module` (ontology, intake,
 * routing, gates, qa, generation, hermes, research) plus the host-bound
 * command-packet free functions, so every existing `@/lib/unite-command-center`
 * import string keeps resolving unchanged after the extraction.
 */
export * from '@unite-group/control-module';

export {
  persistCommandPacket,
  listCommandPackets,
  getCommandPacket,
  transitionCommandPacket,
} from './intake/command-packet.service';
