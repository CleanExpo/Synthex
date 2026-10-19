import { spawnSync } from 'child_process';
import path from 'path';

// Founder 19/10/2026: the fleet runs on subscription plans only. The checker is a node ESM script,
// so it is run as a child process rather than imported into this ts-jest/jsdom suite.
describe('fleet review lanes are subscription-only', () => {
  it('check-subscription-lanes.mjs passes', () => {
    const root = path.resolve(__dirname, '../../..');
    const r = spawnSync(
      process.execPath,
      [path.join(root, 'scripts/fleet/check-subscription-lanes.mjs')],
      { encoding: 'utf8', env: { PATH: process.env.PATH ?? '' } }
    );
    expect(`${r.stdout}${r.stderr}`).toContain(
      'ok subscription-only review lanes'
    );
    expect(r.status).toBe(0);
  });
});
