/**
 * Haversine distance — great-circle distance between two lat/lng points
 * on a spherical Earth model.
 *
 * Pure function. No I/O. No deps.
 *
 * Accuracy: ±0.5% for distances under 1000 km (Earth isn't a perfect sphere).
 * Adequate for AU postcode resolution where the largest suburb-to-suburb
 * distance we care about is ~50 km radius.
 *
 * @see SYN-835 (parent: SYN-834 epic)
 */

const EARTH_RADIUS_KM = 6371.0;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Great-circle distance in kilometres between two points.
 *
 * @throws Error if any coordinate is NaN, infinite, or out of range.
 */
export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  if (!Number.isFinite(aLat) || !Number.isFinite(aLng)) {
    throw new Error(
      `haversineKm: invalid origin coordinates (lat=${aLat}, lng=${aLng})`
    );
  }
  if (!Number.isFinite(bLat) || !Number.isFinite(bLng)) {
    throw new Error(
      `haversineKm: invalid destination coordinates (lat=${bLat}, lng=${bLng})`
    );
  }
  if (aLat < -90 || aLat > 90 || bLat < -90 || bLat > 90) {
    throw new Error(
      `haversineKm: latitude out of range [-90, 90] (a=${aLat}, b=${bLat})`
    );
  }
  if (aLng < -180 || aLng > 180 || bLng < -180 || bLng > 180) {
    throw new Error(
      `haversineKm: longitude out of range [-180, 180] (a=${aLng}, b=${bLng})`
    );
  }

  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const aLatR = toRadians(aLat);
  const bLatR = toRadians(bLat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const a =
    sinDLat * sinDLat + Math.cos(aLatR) * Math.cos(bLatR) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}
