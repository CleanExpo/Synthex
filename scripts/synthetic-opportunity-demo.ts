import { createSyntheticOpportunityWorkflow } from './offline-opportunity/workflow';
import {
  syntheticFixture,
  fixtureSession,
} from './offline-opportunity/fixture';

const workflow = createSyntheticOpportunityWorkflow();
workflow.capture(fixtureSession, syntheticFixture);
workflow.decide(
  fixtureSession,
  syntheticFixture.id,
  'accept',
  'Operator-invoked synthetic draft exercise'
);
process.stdout.write(
  `${JSON.stringify(workflow.promote(fixtureSession, syntheticFixture.id), null, 2)}\n`
);
