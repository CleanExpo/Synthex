/**
 * Admin API: Vault Credential Importer — Document Parser
 *
 * POST /api/admin/vault/import-doc
 *
 * Accepts a .docx file upload, extracts text using mammoth, then applies
 * heuristic parsing to identify credential pairs (service, username, password, URL).
 * Returns a structured preview for user review — NOTHING is stored at this stage.
 *
 * OWNER-ONLY. Passwords are returned over HTTPS for review and NEVER logged.
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
  id: string;                        // Temp UUID for review table key
  service: string;                   // Normalised service name
  url: string | null;                // URL if detected
  username: string | null;           // Email or username
  password: string;                  // Raw password (for review only — never stored as-is)
  category: CredentialCategory;
  confidence: 'high' | 'medium' | 'low';
  rawLine: string;                   // Original text for debugging
}

// =============================================================================
// Owner Auth Helper (matches pattern in app/api/admin/vault/route.ts)
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
// Category Detector
// =============================================================================

const CATEGORY_KEYWORDS: Array<{ patterns: RegExp[]; category: CredentialCategory }> = [
  {
    patterns: [/facebook|instagram|twitter|linkedin|tiktok|youtube|reddit|threads|pinterest|snapchat|x\.com/i],
    category: 'social_media',
  },
  {
    patterns: [/gmail|outlook|hotmail|yahoo|mail|email|imap|smtp|webmail/i],
    category: 'email',
  },
  {
    patterns: [/cpanel|plesk|whm|ftp|sftp|ssh|server|hosting|aws|azure|gcp|digitalocean|cloudflare|namecheap|godaddy|bluehost|siteground|wpengine/i],
    category: 'hosting',
  },
  {
    patterns: [/domain|dns|registrar|enom|net sol|netsol|crazydomains|netregistry/i],
    category: 'domain',
  },
  {
    patterns: [/bank|nab|anz|commonwealth|westpac|paypal|stripe|square|eftpos|bpay|xero|myob/i],
    category: 'banking',
  },
  {
    patterns: [/shopify|woocommerce|magento|ebay|amazon|etsy|bigcommerce/i],
    category: 'ecommerce',
  },
  {
    patterns: [/hubspot|salesforce|zoho|pipedrive|crm|freshdesk|zendesk/i],
    category: 'crm',
  },
  {
    patterns: [/google analytics|ga4|gtm|tag manager|search console|semrush|ahrefs|moz|analytics/i],
    category: 'analytics',
  },
  {
    patterns: [/api[_ -]?key|token|secret|bearer|apikey/i],
    category: 'api_key',
  },
  {
    patterns: [/vpn|nordvpn|expressvpn|surfshark|tunnelbear/i],
    category: 'vpn',
  },
];

function detectCategory(service: string, url: string | null): CredentialCategory {
  const text = `${service} ${url ?? ''}`.toLowerCase();
  for (const { patterns, category } of CATEGORY_KEYWORDS) {
    if (patterns.some((p) => p.test(text))) return category;
  }
  return 'other';
}

// =============================================================================
// Service Name Normaliser
// =============================================================================

const SERVICE_ALIASES: Record<string, string> = {
  fb: 'Facebook',
  ig: 'Instagram',
  tw: 'Twitter / X',
  yt: 'YouTube',
  li: 'LinkedIn',
  tt: 'TikTok',
  'google analytics': 'Google Analytics',
  ga: 'Google Analytics',
  ga4: 'Google Analytics 4',
  gtm: 'Google Tag Manager',
  gsc: 'Google Search Console',
  wp: 'WordPress',
  woo: 'WooCommerce',
};

function normaliseService(raw: string): string {
  const lower = raw.trim().toLowerCase();
  for (const [alias, normalised] of Object.entries(SERVICE_ALIASES)) {
    if (lower === alias) return normalised;
  }
  // Title-case the raw string
  return raw.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

// =============================================================================
// URL Extractor
// =============================================================================

const URL_REGEX = /https?:\/\/[^\s,)]+|www\.[^\s,)]+/gi;
const DOMAIN_ONLY = /^(?:www\.)?([a-z0-9-]+\.(?:com|com\.au|net|org|io|co))/i;

function extractUrl(text: string): string | null {
  const match = text.match(URL_REGEX);
  if (match) return match[0].replace(/[,;).\s]+$/, '');
  const domainMatch = text.match(DOMAIN_ONLY);
  return domainMatch ? domainMatch[0] : null;
}

// =============================================================================
// Core Credential Parser
//
// Handles common real-world document formats:
//   1. Labelled pairs:  "Username: foo  Password: bar"
//   2. Slash-separated: "Facebook - user@email.com / mypass"
//   3. Table rows:      "Facebook | user@email.com | mypass"
//   4. Colon blocks:    "Service: Facebook\nUser: foo\nPass: bar"
//   5. Equals signs:    "user=foo pass=bar"
// =============================================================================

const USERNAME_LABELS = /(?:user(?:name)?|email|login|user id|u\/n|usr|account)\s*[=:]\s*/i;
const PASSWORD_LABELS = /(?:pass(?:word)?|pwd|p\/w|pw|secret)\s*[=:]\s*/i;
const SERVICE_LABELS  = /(?:site|service|platform|account|name|for)\s*[=:]\s*/i;
const URL_LABELS      = /(?:url|website|link|site url|web|address)\s*[=:]\s*/i;

function isEmail(val: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
}

function cleanValue(val: string): string {
  return val.trim().replace(/^["']|["']$/g, '').trim();
}

/**
 * Parse a block of text (single line or multi-line group) into a credential.
 * Returns null if we can't confidently extract at least a username AND password.
 */
function parseCredentialBlock(block: string): Omit<ExtractedCredential, 'id'> | null {
  const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
  const combined = lines.join(' ');

  let service: string | null = null;
  let username: string | null = null;
  let password: string | null = null;
  let url: string | null = null;
  let confidence: 'high' | 'medium' | 'low' = 'medium';

  // ── Strategy 1: Labelled key-value pairs ──────────────────────────────────
  const usernameMatch = combined.match(new RegExp(`${USERNAME_LABELS.source}([^\\s,|;]+)`, 'i'));
  const passwordMatch = combined.match(new RegExp(`${PASSWORD_LABELS.source}([^\\s,|;]+)`, 'i'));
  const serviceMatch  = combined.match(new RegExp(`${SERVICE_LABELS.source}([^\\s,|;:\\n]+)`, 'i'));
  const urlMatch      = combined.match(new RegExp(`${URL_LABELS.source}([^\\s,|;\\n]+)`, 'i'));

  if (usernameMatch) username = cleanValue(usernameMatch[1]);
  if (passwordMatch) password = cleanValue(passwordMatch[1]);
  if (serviceMatch)  service  = cleanValue(serviceMatch[1]);
  if (urlMatch)      url      = cleanValue(urlMatch[1]);

  // ── Strategy 2: Table / slash-delimited single line ────────────────────────
  // e.g.  "Facebook | john@gmail.com | mypassword123"
  // e.g.  "Facebook - john@gmail.com / mypassword123"
  if (!username || !password) {
    const delimMatch = combined.match(
      /^([^|/\-–—]+?)\s*[|/\-–—]+\s*([^|/\-–—@\s]+@[^|/\-–—\s]+)\s*[|/\-–—]+\s*(\S+)/
    );
    if (delimMatch) {
      if (!service)   service  = cleanValue(delimMatch[1]);
      if (!username)  username = cleanValue(delimMatch[2]);
      if (!password)  password = cleanValue(delimMatch[3]);
      confidence = 'high';
    }
  }

  // ── Strategy 3: Email on one line, password on next ───────────────────────
  if (!password && lines.length >= 2) {
    const emailLine = lines.find((l) => isEmail(l.split(/[\s|:/\-–—]/)[0] ?? l));
    const passLineIdx = emailLine ? lines.indexOf(emailLine) + 1 : -1;
    if (emailLine && passLineIdx < lines.length) {
      if (!username) username = cleanValue(emailLine.split(/[\s|:/\-–—]/)[0]);
      const potentialPass = lines[passLineIdx];
      // Make sure it doesn't look like another label
      if (potentialPass && !USERNAME_LABELS.test(potentialPass) && !SERVICE_LABELS.test(potentialPass)) {
        if (!password) password = cleanValue(potentialPass.replace(PASSWORD_LABELS, ''));
      }
    }
  }

  // ── Strategy 4: equals-sign pairs ─────────────────────────────────────────
  // e.g. "user=john@email.com password=secret"
  if (!username || !password) {
    const eqUser = combined.match(/(?:user|email|login)\s*=\s*([^\s,;]+)/i);
    const eqPass = combined.match(/(?:pass(?:word)?|pwd)\s*=\s*([^\s,;]+)/i);
    if (eqUser && !username) username = cleanValue(eqUser[1]);
    if (eqPass && !password) password = cleanValue(eqPass[1]);
  }

  // ── No valid credential found ──────────────────────────────────────────────
  if (!password || password.length < 2) return null;
  if (!username && !service) return null;

  // Infer service from URL if not found
  if (!service && url) {
    const domain = url.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
    service = normaliseService(domain.split('.')[0] ?? domain);
  }

  // Infer URL from service name if not found
  if (!url) url = extractUrl(combined);

  // Set confidence
  if (usernameMatch && passwordMatch && serviceMatch) confidence = 'high';
  else if (!service || !username) confidence = 'low';

  return {
    service: service ? normaliseService(service) : (username ? `Account (${username})` : 'Unknown'),
    url,
    username,
    password,
    category: detectCategory(service ?? '', url),
    confidence,
    rawLine: block.slice(0, 200),
  };
}

// =============================================================================
// Document Text Segmenter
// Splits raw text into logical blocks (one block = one credential entry)
// =============================================================================

function segmentText(text: string): string[] {
  const blocks: string[] = [];

  // Split on blank lines first (paragraph-style docs)
  const paragraphs = text.split(/\n{2,}/);

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed || trimmed.length < 5) continue;

    // If the paragraph has multiple lines and looks like a labelled block, keep together
    const lineCount = trimmed.split('\n').length;
    if (lineCount <= 6) {
      blocks.push(trimmed);
      continue;
    }

    // Long paragraphs — try line-by-line
    for (const line of trimmed.split('\n')) {
      if (line.trim().length > 5) blocks.push(line.trim());
    }
  }

  return blocks;
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

    // Validate file type
    const isDocx =
      blob.name?.endsWith('.docx') ||
      blob.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    if (!isDocx) {
      return NextResponse.json({ error: 'Only .docx files are supported' }, { status: 400 });
    }

    // Size limit: 10MB
    if (blob.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB' }, { status: 413 });
    }

    // Convert File → Buffer
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse .docx → plain text using mammoth
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const rawText = result.value;

    if (!rawText || rawText.trim().length < 10) {
      return NextResponse.json(
        { error: 'No text content found in document' },
        { status: 422 }
      );
    }

    // Segment and parse
    const blocks = segmentText(rawText);
    const entries: ExtractedCredential[] = [];

    for (const block of blocks) {
      const parsed = parseCredentialBlock(block);
      if (parsed) {
        entries.push({ id: randomUUID(), ...parsed });
      }
    }

    if (entries.length === 0) {
      return NextResponse.json(
        {
          error: 'No credentials detected. The document format may not be supported.',
          hint: 'Try formatting as: Service | username@email.com | password (one per line)',
        },
        { status: 422 }
      );
    }

    logger.info('[Vault Import] Extracted credentials from document', {
      userId: auth.userId,
      fileName: blob.name,
      rawLines: blocks.length,
      extracted: entries.length,
    });

    return NextResponse.json({
      entries,
      rawLineCount: blocks.length,
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
