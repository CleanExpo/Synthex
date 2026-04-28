/**
 * CSV serialiser for the NRPG → DR coverage snapshot.
 *
 * Output columns:
 *   serviceAreaCoverageId, suburb, postcode, status,
 *   openedByContractorId, openedAt, monthlyAud, flaggedForRetreat,
 *   thirtyDayClicks, thirtyDayConversions, thirtyDayRevenueAud,
 *   ninetyDayClicks, ninetyDayConversions, ninetyDayRevenueAud
 *
 * Used for the monthly board pack export per SYN-843 acceptance.
 *
 * @see SYN-843 (parent: SYN-834 epic)
 */

import type { DashboardLocationRow, NrpgCoverageSnapshot } from './types';

const HEADERS = [
  'serviceAreaCoverageId',
  'suburb',
  'postcode',
  'status',
  'openedByContractorId',
  'openedAt',
  'monthlyAud',
  'flaggedForRetreat',
  'thirtyDayClicks',
  'thirtyDayConversions',
  'thirtyDayRevenueAud',
  'ninetyDayClicks',
  'ninetyDayConversions',
  'ninetyDayRevenueAud',
] as const;

/**
 * Serialise the locations array of a coverage snapshot to CSV.
 * RFC-4180-ish: quote fields containing commas / quotes / newlines,
 * double-up embedded quotes.
 */
export function snapshotToCsv(snapshot: NrpgCoverageSnapshot): string {
  const lines = [HEADERS.join(',')];
  for (const row of snapshot.locations) {
    lines.push(rowToCsvLine(row));
  }
  return lines.join('\n') + '\n';
}

function rowToCsvLine(row: DashboardLocationRow): string {
  const k30 = row.latestThirtyDayKpi;
  const k90 = row.latestNinetyDayKpi;
  const cells = [
    row.serviceAreaCoverageId,
    row.suburb,
    row.postcode,
    row.status,
    row.openedByContractorId,
    row.openedAt,
    row.monthlyAud.toFixed(2),
    row.flaggedForRetreat ? 'true' : 'false',
    k30 ? String(k30.clicks) : '',
    k30 ? String(k30.conversions) : '',
    k30 ? k30.revenueAud.toFixed(2) : '',
    k90 ? String(k90.clicks) : '',
    k90 ? String(k90.conversions) : '',
    k90 ? k90.revenueAud.toFixed(2) : '',
  ];
  return cells.map(escapeCsvCell).join(',');
}

function escapeCsvCell(cell: string): string {
  if (cell === '') return '';
  if (/[",\n\r]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}
