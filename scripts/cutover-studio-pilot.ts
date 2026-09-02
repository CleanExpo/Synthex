#!/usr/bin/env tsx
/**
 * Cut a pilot organisation over to the org-driven Studio configuration.
 *
 * Writes, for ONE organisation resolved by id or slug:
 *   - `settings.studio` — the complete video identity (avatar, voice, likeness
 *     consent naming that avatar and voice), validated with the Studio's own
 *     schema; refuses to run if any value is missing, so a partial object is
 *     never stored;
 *   - `calendarMode = 'live'`, `liveModeT = 1` — the publish-safety state a
 *     Studio post is gated on (lib/publish/safetyChecks.ts). A pilot publishes
 *     nothing from the Studio until this is set, and no route can set it for
 *     an organisation the operator does not belong to.
 *
 * Not a Prisma migration on purpose: the target is a JSONB key plus a scalar,
 * and a data write in a schema migration is the one step a code revert cannot
 * undo. Idempotent: re-running with the same values produces the same rows.
 * Defaults to dry-run and prints before/after; use --write to apply.
 *
 * Usage:
 *   tsx scripts/cutover-studio-pilot.ts --org restoreassist \
 *     --avatar <HEYGEN_AVATAR_ID> --voice <ELEVENLABS_VOICE_ID> \
 *     --presenter "<name>" --consent-ref <ref> --consent-confirmed-at <ISO> \
 *     [--funnel https://…] [--platforms linkedin,facebook] [--write]
 *
 * The values are founder-supplied (vault contract g8). Nothing here reads them
 * from the environment, so what is written is exactly what was typed.
 */

import { prisma } from '../lib/prisma';
import { studioSettingsSchema } from '../lib/marketing-agency/studio/clients';

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  return value && !value.startsWith('--') ? value : undefined;
}

const WRITE = process.argv.includes('--write');

async function main() {
  const orgRef = flag('org');
  const required = {
    avatarId: flag('avatar'),
    voiceId: flag('voice'),
    subjectName: flag('presenter'),
    sourceRef: flag('consent-ref'),
    confirmedAt: flag('consent-confirmed-at'),
  };
  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (!orgRef || missing.length > 0) {
    console.error(
      `Refusing to run: missing ${[!orgRef ? 'org' : null, ...missing].filter(Boolean).join(', ')}. A partial studio object is never written.`
    );
    process.exitCode = 2;
    return;
  }

  const studio = {
    avatarId: required.avatarId!,
    voiceId: required.voiceId!,
    consent: {
      subjectName: required.subjectName!,
      sourceRef: required.sourceRef!,
      confirmedAt: required.confirmedAt!,
      avatarId: required.avatarId!,
      voiceId: required.voiceId!,
      recordedBy: 'scripts/cutover-studio-pilot.ts',
      recordedAt: new Date().toISOString(),
    },
    ...(flag('funnel') ? { funnelUrl: flag('funnel') } : {}),
    ...(flag('platforms')
      ? {
          platforms: flag('platforms')!
            .split(',')
            .map(p => p.trim()),
        }
      : {}),
  };
  const parsed = studioSettingsSchema.safeParse(studio);
  if (!parsed.success) {
    console.error('Refusing to run: the studio object does not validate:');
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
    process.exitCode = 2;
    return;
  }

  const org = await prisma.organization.findFirst({
    where: { OR: [{ id: orgRef }, { slug: orgRef }] },
    select: {
      id: true,
      slug: true,
      settings: true,
      calendarMode: true,
      liveModeT: true,
      autoPublishPaused: true,
    },
  });
  if (!org) throw new Error(`Organisation not found for id or slug: ${orgRef}`);

  const existingSettings =
    org.settings &&
    typeof org.settings === 'object' &&
    !Array.isArray(org.settings)
      ? (org.settings as Record<string, unknown>)
      : {};
  const nextSettings = { ...existingSettings, studio: parsed.data };

  console.log(
    `${WRITE ? 'WRITE' : 'dry-run'}  organisation ${org.slug} (${org.id})`
  );
  console.log(
    `  settings.studio: ${existingSettings.studio ? 'present' : 'absent'} -> present (avatar ${parsed.data.avatarId}, voice ${parsed.data.voiceId}, consent for ${parsed.data.consent?.subjectName})`
  );
  console.log(`  calendarMode:    ${org.calendarMode} -> live`);
  console.log(
    `  liveModeT:       ${org.liveModeT} -> ${Math.max(org.liveModeT, 1)}`
  );
  if (org.autoPublishPaused) {
    console.log(
      '  NOTE: autoPublishPaused is true and is NOT changed by this script; Studio posts stay blocked until it is cleared.'
    );
  }
  if (!WRITE) {
    console.log('Re-run with --write to apply.');
    return;
  }

  await prisma.organization.update({
    where: { id: org.id },
    data: {
      settings: nextSettings,
      calendarMode: 'live',
      liveModeT: Math.max(org.liveModeT, 1),
      ...(org.liveModeT < 1 ? { liveModeActivatedAt: new Date() } : {}),
    },
  });
  console.log('Applied.');
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
