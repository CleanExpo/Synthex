// Compile-time tests that verify `as const satisfies BrandConfig`
// successfully narrows brand-token fields to their literal types.
//
// If the `as const` narrowing breaks (e.g. someone removes the modifier),
// these assertions fail at `tsc --noEmit` and CI goes red.
//
// Per [[board-deliberation-code-patterns-2026-05-15]] PR3 — verify the
// literal-narrowing on the COLOR token (highest-impact use case for design
// systems) plus voice-tone arrays (tuple-narrowed by `as const`).

import { Equal, doNotExecute } from './utils';
import { ra } from '../brands/ra';
import { dr } from '../brands/dr';
import { nrpg } from '../brands/nrpg';
import { carsi } from '../brands/carsi';
import { synthex } from '../brands/synthex';
import { unite } from '../brands/unite';
import { johnCoutis } from '../brands/john-coutis';

doNotExecute(() => {
  // RA — Wave 1 navy palette must narrow to the exact literals.
  const raPrimary: Equal<typeof ra.colour.primary, '#1C2E47'> = true;
  const raSlug: Equal<typeof ra.slug, 'ra'> = true;
  const raFirstTone: Equal<typeof ra.voice.tone[0], 'direct'> = true;
  void raPrimary; void raSlug; void raFirstTone;

  // DR — navy primary, linkedin default channel.
  const drPrimary: Equal<typeof dr.colour.primary, '#0B2545'> = true;
  const drChannel: Equal<typeof dr.defaultChannel, 'linkedin'> = true;
  void drPrimary; void drChannel;

  // NRPG — emerald-600.
  const nrpgPrimary: Equal<typeof nrpg.colour.primary, '#059669'> = true;
  void nrpgPrimary;

  // CARSI — blue-600.
  const carsiPrimary: Equal<typeof carsi.colour.primary, '#2563EB'> = true;
  const carsiChannel: Equal<typeof carsi.defaultChannel, 'youtube'> = true;
  void carsiPrimary; void carsiChannel;

  // Synthex — candy-orange.
  const synthexPrimary: Equal<typeof synthex.colour.primary, '#FF6B35'> = true;
  void synthexPrimary;

  // Unite — candy-orange-dark.
  const unitePrimary: Equal<typeof unite.colour.primary, '#E55A2B'> = true;
  void unitePrimary;

  // John Coutis — charcoal hero with gold accent.
  const jcPrimary: Equal<typeof johnCoutis.colour.primary, '#1A1A1A'> = true;
  const jcAccent: Equal<typeof johnCoutis.colour.accent, '#D4A437'> = true;
  void jcPrimary; void jcAccent;

  // Negative check — if the narrowing was lost, typeof X would be `string`
  // (or BrandSlug for slug). Confirm the broad type is NOT equal to the
  // literal — guards against future regressions that re-introduce a wider
  // annotation.
  const raPrimaryNotString: Equal<typeof ra.colour.primary, string> = false;
  void raPrimaryNotString;
});
