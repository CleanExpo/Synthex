/**
 * Postcode resolver types
 *
 * Foundation primitive for SYN-834 NRPG → DR dynamic service-area expansion.
 * Pure types module — no I/O, no side effects.
 *
 * @see SYN-835 (parent: SYN-834 epic)
 * @see lib/postcode/README.md
 */

/**
 * Base location for a contractor (or any anchor point).
 * lat/lng in WGS84 decimal degrees.
 */
export interface BaseLocation {
  /** Latitude in decimal degrees · -90 to 90 inclusive. */
  lat: number;
  /** Longitude in decimal degrees · -180 to 180 inclusive. */
  lng: number;
}

/**
 * One AU postcode/suburb row that falls within the search radius.
 * Distance is measured from the {@link BaseLocation} provided to the resolver.
 */
export interface SuburbHit {
  /** AU postcode (e.g. "4000" for Brisbane CBD). 4-digit string with leading zeros preserved. */
  postcode: string;
  /** Suburb / locality name (e.g. "Brisbane City"). */
  suburb: string;
  /** State / territory code (e.g. "QLD"). */
  state: string;
  /** Suburb centroid latitude in decimal degrees. */
  lat: number;
  /** Suburb centroid longitude in decimal degrees. */
  lng: number;
  /** Distance from the base location in kilometres (Haversine, sphere). */
  distanceFromBaseKm: number;
}

/**
 * Internal dataset row shape after CSV parse.
 * @internal
 */
export interface PostcodeDatasetRow {
  postcode: string;
  suburb: string;
  state: string;
  lat: number;
  lng: number;
}

/**
 * Options passed to {@link resolveSuburbsWithinRadius}. All optional.
 */
export interface ResolveOptions {
  /**
   * Optional override of the dataset (for tests). When omitted, the default
   * AU postcode dataset is loaded lazily from `lib/postcode/data/au-postcodes.csv`.
   */
  dataset?: ReadonlyArray<PostcodeDatasetRow>;
  /**
   * Optional state filter — restrict results to one or more AU states/territories.
   * Useful for performance when caller knows results can't be in other states.
   */
  states?: ReadonlyArray<string>;
}
