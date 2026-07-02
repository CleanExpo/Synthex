#!/usr/bin/env node

/**
 * Compatibility entry point.
 *
 * `scripts/verify-deployment.js` is the maintained public production smoke
 * script. This file remains so older docs or muscle memory do not hit an ESM
 * runtime crash.
 */

import { verifyDeployment } from './verify-deployment.js';

console.warn(
  'scripts/production-verify.js is deprecated; running scripts/verify-deployment.js instead.'
);

await verifyDeployment();
