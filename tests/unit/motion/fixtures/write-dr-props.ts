/**
 * Writes MotionStudio props for a Disaster Recovery sample built only from
 * DR's approved claims (packages/brand-config/src/brands/dr.claims.md).
 * Used by the Done contract's render check and for manual previews:
 *   tsx tests/unit/motion/fixtures/write-dr-props.ts <out.json> [placement]
 */
import { writeFileSync } from 'fs';
import { MotionBriefSchema, planMotion, resolveHouseStyle } from '@/lib/motion';

export const DR_SAMPLE = MotionBriefSchema.parse({
  brand: 'dr',
  placement: process.argv[3] ?? 'youtube',
  durationSeconds: 20,
  audience: 'Home and business owners after a flood or fire',
  headline: 'Damage does not wait',
  cta: '24/7 emergency restoration response',
  source:
    'Approved DR facts: 24/7 emergency restoration response. Restoration services across Australia and New Zealand. Work carried out by IICRC-certified contractors.',
  content: {
    kind: 'list',
    items: ['Across Australia and New Zealand', 'IICRC-certified contractors'],
  },
});

if (process.argv[2]) {
  const plan = planMotion(DR_SAMPLE, resolveHouseStyle('dr'));
  if (plan.issues.length) throw new Error(plan.issues.join('; '));
  writeFileSync(process.argv[2], JSON.stringify(plan.props));
}
