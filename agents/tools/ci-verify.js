const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

function loadJSON(p) {
  const full = path.resolve(p);
  if (!fs.existsSync(full)) {
    throw new Error(`Missing JSON file: ${p}`);
  }
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function main() {
  // Generate fresh reports
  run('node agents/tools/extract-client-endpoints.js');
  run('node agents/tools/extract-server-routes.js');
  run('node agents/tools/compare-contracts.js');
  run('node agents/tools/scan-ui-wiring.js');

  // Load reports
  const contract = loadJSON('agents/reports/contract-report.json');
  const wiring = loadJSON('agents/reports/ui-wiring-report.json');

  const failures = [];

  // Contract checks
  const counts = contract.counts || {};
  if (typeof counts.missingOnServer === 'number' && counts.missingOnServer > 0) {
    failures.push(`API parity failed: missingOnServer=${counts.missingOnServer}`);
  }
  if (typeof counts.methodMismatch === 'number' && counts.methodMismatch > 0) {
    failures.push(`API method mismatch: methodMismatch=${counts.methodMismatch}`);
  }

  // UI wiring checks
  const summary = wiring.summary || {};
  if (typeof summary.missing === 'number' && summary.missing > 0) {
    failures.push(`UI wiring failed: missing IDs=${summary.missing}`);
  }

  if (failures.length) {
    console.error('CI verification FAILED:');
    failures.forEach(f => console.error(' - ' + f));
    process.exit(1);
  }

  console.log('CI verification PASSED:');
  console.log(` - API parity: ${counts.clientEndpoints} client endpoints vs ${counts.serverRoutes} server routes, missingOnServer=${counts.missingOnServer}, methodMismatch=${counts.methodMismatch}`);
  console.log(` - UI wiring: referenced=${wiring.referencedIdCount}, missing=${summary.missing}, resolved=${summary.resolved}`);
}

main();
