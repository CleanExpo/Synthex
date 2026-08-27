import { defineConfig } from 'tsup';

// Five entry points: the barrel plus the four subpaths the Synthex stub tree
// re-exports (hermes-handoff, command-packet.service, board-input.schema,
// command-ontology.schema). Building them as named entries is what makes the
// package's subpath `exports` resolvable — a single-entry barrel would leave the
// deep imports unresolved (the REV-1 BLOCK).
export default defineConfig({
  entry: [
    'src/index.ts',
    'src/hermes/hermes-handoff.service.ts',
    'src/intake/command-packet.service.ts',
    'src/intake/board-input.schema.ts',
    'src/ontology/command-ontology.schema.ts',
  ],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
});
