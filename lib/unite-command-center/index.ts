/**
 * Thin stub tree. The command-module implementation now lives in the shared package
 * `@unite-group/control-module` (git-tag-pinned). This barrel re-exports the package
 * plus the Synthex-host-bound command-packet free functions (they thread the local
 * prisma client through the package's factory). Every import string that previously
 * resolved against this directory is preserved.
 */
export * from '@unite-group/control-module';
export {
  persistCommandPacket,
  listCommandPackets,
  getCommandPacket,
  transitionCommandPacket,
} from './intake/command-packet.service';
