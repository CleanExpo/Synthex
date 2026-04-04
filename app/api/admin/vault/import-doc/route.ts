/**
 * Admin API: Vault Credential Importer — Document Parser
 *
 * POST /api/admin/vault/import-doc
 *
 * Accepts a .docx file upload, extracts text via mammoth, then runs a
 * multi-strategy extraction engine to find ALL credential pairs regardless
 * of document format (tables, labelled fields, delimited lines, section blocks).
 *
 * Strategies (in priority order):
 *   1. Word table — tab-separated rows with detected column headers
 *   2. Section header + field blocks — "FACEBOOK\nUser: x\nPass: y"
 *   3. Single-line delimited — "Service | user@email.com | password"
 *   4. Consecutive labelled lines — consecutive Username:/Password: pairs
 *   5. Free-form context-aware — service header above username/password lines
 *
 * Returns structured preview for user review — NOTHING stored at this stage.
 * OWNER-ONLY. Passwords never logged.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isOwnerEmail } from '@/lib/auth/jwt-utils';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { sanitizeErrorForResponse } from '@/lib/utils/error-utils';
import { logger } from '@/lib/logger';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// Types
// =============================================================================

export type CredentialCategory =
  | 'social_media'
  | 'email'
  | 'hosting'
  | 'domain'
  | 'banking'
  | 'ecommerce'
  | 'crm'
  | 'analytics'
  | 'api_key'
  | 'vpn'
  | 'other';

export interface ExtractedCredential {
  id: string;
  service: string;
  url: string | null;
  username: string | null;
  password: string;
  category: CredentialCategory;
  confidence: 'high' | 'medium' | 'low';
  rawLine: string;
}

type RawCred = Omit<ExtractedCredential, 'id'>;

// =============================================================================
// Owner Auth
// =============================================================================

async function requireOwner(
  request: NextRequest
): Promise<{ userId: string; ipAddress: string; userAgent: string } | { error: NextResponse }> {
  const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_READ);
  if (!security.allowed) {
    return { error: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) };
  }
  const userId = security.context.userId!;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user || !isOwnerEmail(user.email)) {
    return { error: NextResponse.json({ error: 'Owner access required' }, { status: 403 }) };
  }
  return {
    userId,
    ipAddress: request.headers.get('x-forwarded-for') ?? 'unknown',
    userAgent: request.headers.get('user-agent') ?? 'unknown',
  };
}

// =============================================================================
// Helpers
// =============================================================================

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
}

function clean(s: string): string {
  return s.trim().replace(/^["'`«»]|["'`«»]$/g, '').trim();
}

function extractUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s,;)]+|www\.[a-zA-Z0-9-]+\.[a-z]{2,}[^\s,;)]*/);
  return m ? m[0].replace(/[.,;)]+$/, '') : null;
}

// =============================================================================
// Category Detector
// =============================================================================

const CATEGORY_MAP: Array<{ re: RegExp; cat: CredentialCategory }> = [
  { re: /facebook|instagram|twitter|tiktok|linkedin|youtube|reddit|threads|pinterest|snapchat|x\.com|social/i, cat: 'social_media' },
  { re: /gmail|outlook|hotmail|yahoo\.com|icloud|mail\.|email|imap|smtp|webmail|proton/i, cat: 'email' },
  { re: /cpanel|plesk|whm|ftp|sftp|ssh|server|hosting|aws|azure|gcp|digitalocean|cloudflare|namecheap|godaddy|bluehost|siteground|wpengine|kinsta|linode|vultr/i, cat: 'hosting' },
  { re: /domain|dns|registrar|enom|netsol|crazydomains|netregistry|iwantmyname/i, cat: 'domain' },
  { re: /bank|nab|anz|commonwealth|westpac|paypal|stripe|square|xero|myob|quickbooks|eftpos|bpay/i, cat: 'banking' },
  { re: /shopify|woocommerce|magento|ebay|amazon|etsy|bigcommerce|wix store/i, cat: 'ecommerce' },
  { re: /hubspot|salesforce|zoho|pipedrive|freshdesk|zendesk|monday|asana/i, cat: 'crm' },
  { re: /analytics|semrush|ahrefs|moz|gtm|tag manager|search console|ga4/i, cat: 'analytics' },
  { re: /api[_ -]?key|api[_ -]?secret|bearer|token|webhook/i, cat: 'api_key' },
  { re: /vpn|nordvpn|expressvpn|surfshark|tunnelbear|openvpn/i, cat: 'vpn' },
];

function detectCategory(service: string, url: string | null = null): CredentialCategory {
  const text = `${service} ${url ?? ''}`.toLowerCase();
  for (const { re, cat } of CATEGORY_MAP) {
    if (re.test(text)) return cat;
  }
  return 'other';
}

// =============================================================================
// Service Name Normaliser
// =============================================================================

const ALIASES: Record<string, string> = {
  fb: 'Facebook', ig: 'Instagram', tw: 'Twitter / X',
  yt: 'YouTube', li: 'LinkedIn', tt: 'TikTok',
  ga: 'Google Analytics', ga4: 'Google Analytics 4',
  gtm: 'Google Tag Manager', gsc: 'Google Search Console',
  wp: 'WordPress', woo: 'WooCommerce', gh: 'GitHub',
  gs: 'Google Search Console', sc: 'Search Console',
};

function normaliseService(raw: string): string {
  const lower = raw.trim().toLowerCase();
  if (ALIASES[lower]) return ALIASES[lower];
  return raw.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

// =============================================================================
// Label patterns
// =============================================================================

const USER_LABEL  = /^(?:user(?:name)?|email|login|user\s*id|u\/n|usr|account|handle)\s*[=:]\s*/i;
const PASS_LABEL  = /^(?:pass(?:word)?|pwd|p\/w|pw|secret|pin)\s*[=:]\s*/i;
const URL_LABEL   = /^(?:url|website|link|site|address|web)\s*[=:]\s*/i;
const SVC_LABEL   = /^(?:site|service|platform|account|name|app|for|login\s*for)\s*[=:]\s*/i;

function stripLabel(line: string, re: RegExp): string {
  return clean(line.replace(re, ''));
}

function isHeaderLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 2 || t.length > 80) return false;
  // All-caps words (e.g. "FACEBOOK", "SOCIAL MEDIA")
  if (/^[A-Z][A-Z\s\-/_&()]{1,50}$/.test(t)) return true;
  // Title with trailing colon and no value (e.g. "Facebook:")
  if (/^[A-Za-z][A-Za-z\s\-/_&().]{0,50}:$/.test(t)) return true;
  // Heading-style line ending with dash or equals separator
  if (/^[-=*#]{3,}$/.test(t)) return true;
  return false;
}

function isDatalessLine(line: string): boolean {
  const t = line.trim();
  return !t || t.length < 3 || /^[-=*#]{3,}$/.test(t);
}

// =============================================================================
// Strategy 1: Word table (tab-separated with column header detection)
// =============================================================================

function extractFromTable(lines: string[]): RawCred[] {
  const results: RawCred[] = [];
  let colService = -1, colUser = -1, colPass = -1, colUrl = -1;
  let inTable = false;

  for (const line of lines) {
    if (!line.includes('\t')) {
      // Tab-free line breaks the table context
      if (inTable && (colUser >= 0 || colPass >= 0)) inTable = false;
      continue;
    }

    const cols = line.split('\t').map((c) => c.trim());
    const lower = cols.map((c) => c.toLowerCase());

    // Detect header row
    const hasUserHeader = lower.findIndex((c) => /^(?:user(?:name)?|email|login)$/.test(c));
    const hasPassHeader = lower.findIndex((c) => /^(?:pass(?:word)?|pwd|password)$/.test(c));

    if (hasUserHeader >= 0 && hasPassHeader >= 0) {
      colService = lower.findIndex((c) => /^(?:service|platform|site|name|account|app)$/.test(c));
      colUrl    = lower.findIndex((c) => /^(?:url|website|link|address)$/.test(c));
      colUser   = hasUserHeader;
      colPass   = hasPassHeader;
      inTable   = true;
      continue;
    }

    // Also detect header row where columns are positional (3-4 columns, first is service)
    if (!inTable && cols.length >= 3 && cols.length <= 6) {
      const looksLikeHeader = lower.some((c) => /user|pass|email|login/.test(c));
      if (looksLikeHeader) {
        colService = 0;
        colUser    = lower.findIndex((c) => /user|email|login/.test(c));
        colPass    = lower.findIndex((c) => /pass|pwd/.test(c));
        colUrl     = lower.findIndex((c) => /url|website|link/.test(c));
        inTable    = true;
        continue;
      }
    }

    if (!inTable) continue;

    // Data row
    const getCol = (idx: number) => (idx >= 0 && idx < cols.length ? clean(cols[idx]) : null);
    const password = getCol(colPass);
    const username = getCol(colUser);

    if (!password || password.length < 2) continue;

    const svcRaw = getCol(colService);
    const url = getCol(colUrl) || extractUrl(line);

    results.push({
      service: svcRaw ? normaliseService(svcRaw) : (username ?? 'Unknown'),
      url,
      username,
      password,
      category: detectCategory(svcRaw ?? '', url),
      confidence: 'high',
      rawLine: line.slice(0, 200),
    });
  }

  return results;
}

// =============================================================================
// Strategy 2: Section header + field blocks
// "FACEBOOK\nUsername: john\nPassword: pass"
// =============================================================================

function extractFromSectionBlocks(lines: string[]): RawCred[] {
  const results: RawCred[] = [];
  let context = { service: '', url: null as string | null };
  let username: string | null = null;
  let password: string | null = null;
  let urlFromField: string | null = null;

  const flush = () => {
    if (password && (username || context.service)) {
      results.push({
        service: context.service || (username ? `Account (${username})` : 'Unknown'),
        url: urlFromField || context.url,
        username,
        password,
        category: detectCategory(context.service, urlFromField || context.url),
        confidence: context.service && username ? 'high' : 'medium',
        rawLine: `${context.service} ${username ?? ''} ${password ?? ''}`.slice(0, 200),
      });
    }
    username = null;
    password = null;
    urlFromField = null;
  };

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;

    if (isHeaderLine(t)) {
      flush();
      context = {
        service: normaliseService(t.replace(/:$/, '').trim()),
        url: extractUrl(t),
      };
      continue;
    }

    if (USER_LABEL.test(t)) {
      if (username && password) flush(); // new entry within same section
      username = stripLabel(t, USER_LABEL);
      continue;
    }
    if (PASS_LABEL.test(t)) {
      password = stripLabel(t, PASS_LABEL);
      continue;
    }
    if (URL_LABEL.test(t)) {
      urlFromField = stripLabel(t, URL_LABEL);
      // URL can also give us service name if not set
      if (!context.service && urlFromField) {
        const domain = urlFromField.replace(/https?:\/\//, '').split('/')[0].replace(/^www\./, '');
        context.service = normaliseService(domain.split('.')[0] ?? domain);
      }
      continue;
    }
    if (SVC_LABEL.test(t)) {
      if (username && password) flush();
      context.service = normaliseService(stripLabel(t, SVC_LABEL));
      continue;
    }

    // If we have an in-progress entry and hit an unrecognised line, maybe flush
    if (username && password) flush();
  }
  flush();

  return results;
}

// =============================================================================
// Strategy 3: Single-line delimited entries
// "Facebook | john@email.com | password123"
// "Gmail - john@email.com / pass123"
// "Twitter: @john Pass: twitterpass"
// =============================================================================

const SINGLE_LINE_PATTERNS: RegExp[] = [
  // service | username | password (with any non-word delimiter)
  /^(.+?)\s*[|/–—]\s*([^\s|/–—]+@[^\s|/–—]+)\s*[|/–—]\s*(\S+)\s*$/,
  // service - username - password (dash-separated, email clearly in middle)
  /^(.+?)\s*[-–—]\s*([^\s-–—]+@[^\s-–—]+)\s*[-–—]\s*(\S+)\s*$/,
  // service | username | password (no email, but 3 clear tokens)
  /^([A-Za-z][A-Za-z0-9 ._-]{1,40})\s*[|]\s*([^\s|]{3,60})\s*[|]\s*(\S{4,})\s*$/,
  // service: username / password
  /^([A-Za-z][A-Za-z0-9 ._-]{1,40}):\s*([^\s/]{3,60})\s*\/\s*(\S{4,})\s*$/,
];

function extractSingleLineEntries(lines: string[]): RawCred[] {
  const results: RawCred[] = [];

  for (const line of lines) {
    const t = line.trim();
    if (t.length < 8 || isHeaderLine(t)) continue;

    for (const pattern of SINGLE_LINE_PATTERNS) {
      const m = t.match(pattern);
      if (m) {
        const svc = clean(m[1]);
        const user = clean(m[2]);
        const pass = clean(m[3]);
        if (!pass || pass.length < 2) continue;

        results.push({
          service: normaliseService(svc),
          url: extractUrl(t),
          username: user || null,
          password: pass,
          category: detectCategory(svc),
          confidence: isEmail(user) ? 'high' : 'medium',
          rawLine: t.slice(0, 200),
        });
        break;
      }
    }
  }

  return results;
}

// =============================================================================
// Strategy 4: Consecutive labelled lines without a section header
// When Username: and Password: appear on adjacent lines with no header above
// =============================================================================

function extractOrphanLabelPairs(lines: string[]): RawCred[] {
  const results: RawCred[] = [];
  let i = 0;

  while (i < lines.length) {
    const t = lines[i].trim();

    if (USER_LABEL.test(t)) {
      const username = stripLabel(t, USER_LABEL);
      // Look ahead for password within the next 3 lines
      let pass: string | null = null;
      let url: string | null = null;
      let j = i + 1;
      while (j < Math.min(i + 4, lines.length)) {
        const next = lines[j].trim();
        if (PASS_LABEL.test(next)) {
          pass = stripLabel(next, PASS_LABEL);
          j++;
          break;
        }
        if (URL_LABEL.test(next)) {
          url = stripLabel(next, URL_LABEL);
        }
        j++;
      }
      if (pass && pass.length >= 2) {
        results.push({
          service: `Account (${username || 'unknown'})`,
          url,
          username: username || null,
          password: pass,
          category: detectCategory(''),
          confidence: 'medium',
          rawLine: t.slice(0, 200),
        });
        i = j;
        continue;
      }
    }
    i++;
  }

  return results;
}

// =============================================================================
// Strategy 5: Context-aware free-form
// Infer password from lines like: "password123" following a known-format username
// =============================================================================

function extractContextAware(lines: string[]): RawCred[] {
  const results: RawCred[] = [];

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!isEmail(t)) continue;

    // Email found as a standalone line — look for password on next line
    const next = lines[i + 1]?.trim();
    if (!next || isEmail(next) || isHeaderLine(next) || USER_LABEL.test(next) || PASS_LABEL.test(next)) continue;
    if (next.length < 3 || next.length > 100) continue;
    // Next line should look like a password (no spaces, no labels)
    if (next.includes(' ') && !next.includes('\t')) continue;

    // Look back for a service name
    let service = '';
    for (let k = i - 1; k >= Math.max(0, i - 4); k--) {
      const prev = lines[k].trim();
      if (!prev || isDatalessLine(prev)) continue;
      if (isHeaderLine(prev) || SVC_LABEL.test(prev)) {
        service = prev.replace(/:$/, '').trim();
        break;
      }
    }

    results.push({
      service: service ? normaliseService(service) : `Account (${t})`,
      url: null,
      username: t,
      password: next,
      category: detectCategory(service),
      confidence: service ? 'medium' : 'low',
      rawLine: `${t} ${next}`.slice(0, 200),
    });
    i++; // skip the password line
  }

  return results;
}

// =============================================================================
// Deduplication
// Remove entries that are clearly duplicates (same service + username + password)
// =============================================================================

function dedup(entries: RawCred[]): RawCred[] {
  const seen = new Set<string>();
  return entries.filter((e) => {
    const key = `${e.service.toLowerCase()}|${(e.username ?? '').toLowerCase()}|${e.password}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// =============================================================================
// Main Extraction Pipeline
// =============================================================================

function extractAllCredentials(text: string): RawCred[] {
  const lines = text.split('\n');

  // Run all strategies in parallel, then merge + dedup
  const tableResults    = extractFromTable(lines);
  const sectionResults  = extractFromSectionBlocks(lines);
  const singleResults   = extractSingleLineEntries(lines);
  const orphanResults   = extractOrphanLabelPairs(lines);
  const contextResults  = extractContextAware(lines);

  // Priority merge: table > section > single-line > orphan > context-aware
  // Any entry already covered by a higher-priority strategy is dropped
  const all = [
    ...tableResults,
    ...sectionResults,
    ...singleResults,
    ...orphanResults,
    ...contextResults,
  ];

  return dedup(all);
}

// =============================================================================
// POST Handler
// =============================================================================

export async function POST(request: NextRequest) {
  const auth = await requireOwner(request);
  if ('error' in auth) return auth.error;

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const blob = file as File;

    const isDocx =
      blob.name?.endsWith('.docx') ||
      blob.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    if (!isDocx) {
      return NextResponse.json({ error: 'Only .docx files are supported' }, { status: 400 });
    }

    if (blob.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum size is 25MB' }, { status: 413 });
    }

    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const rawText = result.value;

    if (!rawText || rawText.trim().length < 10) {
      return NextResponse.json({ error: 'No text content found in document' }, { status: 422 });
    }

    const rawCredentials = extractAllCredentials(rawText);

    if (rawCredentials.length === 0) {
      return NextResponse.json(
        {
          error: 'No credentials detected. Check the format tip below.',
          hint: 'Supported formats: tables (Service | Username | Password), labelled fields (Username: / Password:), or one-line entries (Service - email@x.com / password)',
          rawLineCount: rawText.split('\n').filter(Boolean).length,
        },
        { status: 422 }
      );
    }

    const entries: ExtractedCredential[] = rawCredentials.map((c) => ({
      id: randomUUID(),
      ...c,
    }));

    logger.info('[Vault Import] Document parsed', {
      userId: auth.userId,
      fileName: blob.name,
      rawLines: rawText.split('\n').length,
      extracted: entries.length,
    });

    return NextResponse.json({
      entries,
      rawLineCount: rawText.split('\n').filter(Boolean).length,
      extractedCount: entries.length,
    });
  } catch (error: unknown) {
    logger.error('[POST /api/admin/vault/import-doc] Error:', error);
    return NextResponse.json(
      { error: sanitizeErrorForResponse(error, 'Failed to parse document') },
      { status: 500 }
    );
  }
}
