/**
 * lib/postcode — public entry point.
 *
 * AU postcode/suburb resolver for SYN-834 NRPG → DR dynamic service-area
 * expansion. Given a contractor base location + GEO km radius, returns the
 * list of AU suburbs/postcodes within range (Haversine, sphere).
 *
 * @see SYN-835 (parent: SYN-834 epic)
 * @see lib/postcode/README.md
 */

export type {
  BaseLocation,
  SuburbHit,
  ResolveOptions,
  PostcodeDatasetRow,
} from './types';

export { haversineKm } from './haversine';

export {
  loadDataset,
  parseCsv,
  parseCsvLine,
  _resetDatasetCacheForTests,
} from './dataset-loader';

export {
  resolveSuburbsWithinRadius,
  resolveSuburbsWithinRadiusSync,
} from './postcode-resolver';
