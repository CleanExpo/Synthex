/**
 * CSV Parser for Bulk Content Import
 *
 * Parses CSV text into ContentItem[] for the bulk schedule wizard.
 * Validates columns, platforms, dates, and provides per-row error/warning
 * reporting.
 *
 * @module lib/scheduling/csv-parser
 * Linear: SYN-44
 */

// =============================================================================
// Types
// =============================================================================

export interface ParsedCSVRow {
  content: string;
  platform: string;
  scheduledAt?: string; // ISO datetime, optional
  hashtags?: string[]; // comma-separated in CSV, parsed to array
}

export interface CSVParseError {
  row: number;
  message: string;
}

export interface CSVParseResult {
  items: ParsedCSVRow[];
  errors: CSVParseError[];
  warnings: CSVParseError[];
}

// =============================================================================
// Constants
// =============================================================================

const SUPPORTED_PLATFORMS = [
  'twitter',
  'instagram',
  'linkedin',
  'tiktok',
  'facebook',
  'youtube',
  'pinterest',
  'reddit',
  'threads',
];

const MAX_ROWS = 100;

const REQUIRED_COLUMNS = ['content', 'platform'];
const OPTIONAL_COLUMNS = ['scheduledat', 'hashtags'];
const ALL_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

// =============================================================================
// CSV Template
// =============================================================================

/**
 * Downloadable CSV template string with header row + 3 example rows.
 * Generated client-side in the wizard for the download button.
 */
export const CSV_TEMPLATE = `content,platform,scheduledAt,hashtags
"Your post content here",twitter,2026-03-15T09:00:00Z,"#marketing,#socialmedia"
"Another post for Instagram",instagram,,"#growth,#content"
"LinkedIn thought leadership post",linkedin,,`;

/**
 * Trigger a browser download of the CSV template.
 * Call from a "Download Template" button in the wizard.
 */
export function downloadCSVTemplate(): void {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'schedule-template.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// =============================================================================
// Parser Helpers
// =============================================================================

/**
 * Parse a single CSV line, handling quoted fields with commas inside.
 * Supports double-quote escaping ("" for literal quote).
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote ("")
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        }
        // End of quoted field
        inQuotes = false;
        i++;
        continue;
      }
      current += char;
      i++;
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (char === ',') {
        fields.push(current.trim());
        current = '';
        i++;
        continue;
      }
      current += char;
      i++;
    }
  }

  // Push last field
  fields.push(current.trim());

  return fields;
}

/**
 * Validate that a string is a valid ISO 8601 datetime.
 */
function isValidISODate(dateStr: string): boolean {
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Parse a hashtag string into an array.
 * Input formats: "#tag1,#tag2" or "#tag1 #tag2" or "tag1, tag2"
 */
function parseHashtags(hashtagStr: string): string[] {
  if (!hashtagStr) return [];

  return hashtagStr
    .split(/[,\s]+/)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`));
}

// =============================================================================
// Main Parser
// =============================================================================

/**
 * Parse CSV text into validated content items for bulk scheduling.
 *
 * Rules:
 * 1. Required columns: content, platform
 * 2. Optional columns: scheduledAt, hashtags
 * 3. Platform values validated against supported list
 * 4. scheduledAt validated as ISO datetime if present
 * 5. Empty rows are skipped
 * 6. Per-row errors (missing content, invalid platform) and warnings (past date)
 * 7. Maximum 100 rows per import
 *
 * @param csvText - Raw CSV string to parse
 * @returns Parsed items with errors and warnings
 */
export function parseScheduleCSV(csvText: string): CSVParseResult {
  const items: ParsedCSVRow[] = [];
  const errors: CSVParseError[] = [];
  const warnings: CSVParseError[] = [];

  // Split into lines, handling both \r\n and \n
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    errors.push({ row: 0, message: 'CSV file is empty' });
    return { items, errors, warnings };
  }

  // ---- Parse header row ----
  const headerFields = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());

  // Check for required columns
  for (const required of REQUIRED_COLUMNS) {
    if (!headerFields.includes(required)) {
      errors.push({
        row: 1,
        message: `Missing required column: "${required}". Expected columns: ${ALL_COLUMNS.join(', ')}`,
      });
    }
  }

  if (errors.length > 0) {
    return { items, errors, warnings };
  }

  // Build column index map
  const colIndex: Record<string, number> = {};
  for (let i = 0; i < headerFields.length; i++) {
    const normalised = headerFields[i];
    if (ALL_COLUMNS.includes(normalised)) {
      colIndex[normalised] = i;
    }
  }

  // ---- Parse data rows ----
  const dataLines = lines.slice(1);

  if (dataLines.length > MAX_ROWS) {
    warnings.push({
      row: 0,
      message: `CSV contains ${dataLines.length} rows. Only the first ${MAX_ROWS} will be imported.`,
    });
  }

  const rowsToProcess = dataLines.slice(0, MAX_ROWS);

  for (let i = 0; i < rowsToProcess.length; i++) {
    const rowNum = i + 2; // 1-indexed, header is row 1
    const line = rowsToProcess[i];

    // Skip empty lines
    if (!line.trim()) continue;

    const fields = parseCSVLine(line);

    // Extract fields by column index
    const content = colIndex.content !== undefined ? fields[colIndex.content] ?? '' : '';
    const platform = colIndex.platform !== undefined ? (fields[colIndex.platform] ?? '').toLowerCase() : '';
    const scheduledAtRaw = colIndex.scheduledat !== undefined ? fields[colIndex.scheduledat] ?? '' : '';
    const hashtagsRaw = colIndex.hashtags !== undefined ? fields[colIndex.hashtags] ?? '' : '';

    // ---- Validate content ----
    if (!content || content.trim().length === 0) {
      errors.push({ row: rowNum, message: 'Content is empty' });
      continue;
    }

    // ---- Validate platform ----
    if (!platform) {
      errors.push({ row: rowNum, message: 'Platform is missing' });
      continue;
    }

    if (!SUPPORTED_PLATFORMS.includes(platform)) {
      errors.push({
        row: rowNum,
        message: `Invalid platform "${platform}". Supported: ${SUPPORTED_PLATFORMS.join(', ')}`,
      });
      continue;
    }

    // ---- Validate scheduledAt (optional) ----
    let scheduledAt: string | undefined;

    if (scheduledAtRaw && scheduledAtRaw.trim().length > 0) {
      if (!isValidISODate(scheduledAtRaw)) {
        errors.push({
          row: rowNum,
          message: `Invalid date "${scheduledAtRaw}". Use ISO 8601 format (e.g., 2026-03-15T09:00:00Z)`,
        });
        continue;
      }

      scheduledAt = new Date(scheduledAtRaw).toISOString();

      // Warn if date is in the past
      if (new Date(scheduledAt) < new Date()) {
        warnings.push({
          row: rowNum,
          message: `Scheduled time is in the past. It will be auto-assigned an optimal future time.`,
        });
        scheduledAt = undefined; // Clear past dates so auto-fill handles them
      }
    }

    // ---- Parse hashtags (optional) ----
    const hashtags = parseHashtags(hashtagsRaw);

    // ---- Add valid item ----
    items.push({
      content: content.trim(),
      platform,
      scheduledAt,
      hashtags: hashtags.length > 0 ? hashtags : undefined,
    });
  }

  return { items, errors, warnings };
}
