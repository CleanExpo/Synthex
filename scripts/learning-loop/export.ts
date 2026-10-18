/**
 * Export one experiment's learning loop as the shared unite-learning-loop/1
 * record (skills-library: unite-project-completion/references/learning-loop.md).
 *
 *   DATABASE_URL=<localhost db> npx tsx scripts/learning-loop/export.ts <organizationId> <experimentId> loop.json
 *   python3 ~/.claude/skills/unite-project-completion/scripts/check_learning_loop.py loop.json
 *
 * Read-only. Refuses a non-localhost database unless EXPORT_ALLOW_REMOTE=1 is set
 * deliberately by someone with read authority over that data.
 */
import { writeFileSync } from 'node:fs';
import prisma from '@/lib/prisma';
import { getExperimentSpec } from '@/lib/cards/white-rabbit';
import { loadLoop } from '@/lib/learning-loop/store';

type Json = Record<string, unknown>;

async function main(
  organizationId: string,
  experimentId: string,
  outFile: string
) {
  const url = process.env.DATABASE_URL ?? '';
  if (
    !/@(127\.0\.0\.1|localhost)(:\d+)?\//.test(url) &&
    process.env.EXPORT_ALLOW_REMOTE !== '1'
  ) {
    console.error(
      'export: refusing a non-localhost database (set EXPORT_ALLOW_REMOTE=1 only with read authority).'
    );
    process.exit(2);
  }
  const loop = await loadLoop(organizationId, experimentId);
  const spec = getExperimentSpec(experimentId);
  const rec = loop.experiment.record as Json;
  const out = {
    schema: 'unite-learning-loop/1',
    project: 'Synthex',
    experimentId,
    exportedAt: new Date().toISOString(),
    revision: process.env.GIT_COMMIT_SHA || 'local-uncommitted',
    need: { customerBenefit: rec.customerBenefit },
    hypothesis: {
      statement: loop.hypothesis?.title ?? rec.hypothesis,
      mechanism: loop.hypothesis?.causalMechanism ?? null,
      evidenceFor: loop.hypothesis?.evidenceFor ?? [],
      evidenceAgainst: loop.hypothesis?.evidenceAgainst ?? [],
    },
    challenge: {
      invalidatingAssumption: loop.hypothesis?.invalidatingAssumption,
      mainRisk: loop.hypothesis?.mainRisk,
    },
    experiment: {
      owner: rec.owner,
      scope: rec.scope,
      permissions: rec.permissions,
      approvalReference: rec.approvalReference,
      goalContractId: loop.goalContract?.id ?? null,
      baseline: rec.baseline,
      comparison: rec.comparison,
      successMeasure: rec.successMeasure,
      observationPeriod: rec.observationPeriod,
      stopConditions: rec.stopConditions,
      randomised: spec?.randomised ?? false,
      minSessionsPerVariant: spec?.minSessionsPerVariant ?? null,
      deliveryCost: rec.deliveryCost,
      commercialMeasures: rec.commercialMeasures,
      pilotStatus: rec.pilotStatus,
    },
    outcomes: loop.outcomes.map(o => {
      const s = (o as Json).summary as Json;
      const variants = (s.variants as Json[]) ?? [];
      return {
        id: o.id,
        at: o.at,
        dataClass: s.dataClass,
        claim: s.claim,
        primaryMeasure: variants.map(v => ({
          variant: v.variant,
          sessions: v.sessions,
          useful: v.useful,
          interval: v.usefulRate,
        })),
        diagnostics: Object.fromEntries(
          variants.map(v => [String(v.variant), v.diagnostics])
        ),
        missingData: s.missingData,
        deliveryCostCents: s.deliveryCostCents,
        costPerUsefulAnswerCents: s.costPerUsefulAnswerCents,
        provenance: (o as Json).provenance,
      };
    }),
    recommendations: loop.recommendations.map(r => {
      const x = r as Json;
      return {
        id: r.id,
        at: r.at,
        verdict: x.verdict,
        reasons: x.reasons,
        stopConditionsHit: x.stopConditionsHit,
        requiredAuthority: x.requiredAuthority,
        generatedBy: x.generatedBy,
        outcomeId: x.outcomeEventId,
      };
    }),
    decisions: loop.decisions.map(d => {
      const x = d as Json;
      return {
        id: d.id,
        at: d.at,
        decision: x.decision,
        rationale: x.rationale,
        decidedBy: x.decidedBy,
        recommendationId: x.recommendationEventId,
        nextDecision: x.nextDecision,
      };
    }),
  };
  // A file, not stdout: the Prisma client logs to stdout and would corrupt piped JSON.
  writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n');
  console.error(`export: wrote ${outFile}`);
}

const [org, exp, outFile] = process.argv.slice(2);
if (!org || !exp || !outFile) {
  console.error('usage: export.ts <organizationId> <experimentId> <out.json>');
  process.exit(2);
}
main(org, exp, outFile)
  .catch(e => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
