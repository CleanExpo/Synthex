/**
 * QMD — Quick MarkDown with Clear Taxonomy
 *
 * Synthex's content storage format for Google Drive.
 * Structured YAML frontmatter + Markdown body.
 * Clear + Clean Data — Systemised, Structured, with MetaData, Embedded, and Tagged.
 */

import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QMDDocType =
  | 'post'      // Social media post
  | 'campaign'  // Campaign document
  | 'asset'     // Media asset reference (image/video)
  | 'report'    // Analytics or SEO report
  | 'brief'     // Content brief
  | 'content';  // Generic generated content

export type QMDStatus = 'draft' | 'published' | 'scheduled' | 'archived';
export type QMDIntent = 'awareness' | 'engagement' | 'conversion' | 'retention';

export interface QMDTaxonomy {
  category: string;        // Primary category  e.g. 'disaster-recovery'
  subcategory?: string;    // Sub-category      e.g. 'data-backup'
  topic?: string;          // Topic focus       e.g. 'business-continuity'
  industry?: string;       // Industry vertical e.g. 'it-services'
  audience?: string;       // Target audience   e.g. 'enterprise'
  intent?: QMDIntent;      // Content intent
}

export interface QMDMeta {
  created: string;         // ISO 8601 datetime
  updated?: string;
  author?: string;
  status: QMDStatus;
  version: number;
  source: 'synthex';
}

export interface QMDDrive {
  folderId?: string;       // Google Drive folder ID
  fileId?: string;         // Google Drive file ID (set after save)
  path?: string;           // Human-readable path in Drive
}

export interface QMDFrontmatter {
  qmd: '1.0';
  id: string;
  title: string;
  type: QMDDocType;
  taxonomy: QMDTaxonomy;
  platform?: string;       // Social platform, e.g. 'linkedin'
  campaign?: string;       // Campaign name/slug
  tags: string[];
  meta: QMDMeta;
  drive?: QMDDrive;
}

export interface QMDDocument {
  frontmatter: QMDFrontmatter;
  body: string;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export function createQMD(
  title: string,
  type: QMDDocType,
  body: string,
  options: {
    taxonomy: QMDTaxonomy;
    platform?: string;
    campaign?: string;
    tags?: string[];
    status?: QMDStatus;
    author?: string;
    drive?: QMDDrive;
  }
): QMDDocument {
  return {
    frontmatter: {
      qmd: '1.0',
      id: randomUUID(),
      title,
      type,
      taxonomy: options.taxonomy,
      platform: options.platform,
      campaign: options.campaign,
      tags: options.tags ?? [],
      meta: {
        created: new Date().toISOString(),
        author: options.author ?? 'Synthex AI',
        status: options.status ?? 'draft',
        version: 1,
        source: 'synthex',
      },
      drive: options.drive,
    },
    body,
  };
}

// ---------------------------------------------------------------------------
// Format (serialize to string)
// ---------------------------------------------------------------------------

function yamlStr(value: string): string {
  // Escape double quotes and wrap in double quotes
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function formatQMD(doc: QMDDocument): string {
  const f = doc.frontmatter;
  const lines: string[] = [
    `qmd: ${yamlStr(f.qmd)}`,
    `id: ${yamlStr(f.id)}`,
    `title: ${yamlStr(f.title)}`,
    `type: ${yamlStr(f.type)}`,
    `taxonomy:`,
    `  category: ${yamlStr(f.taxonomy.category)}`,
  ];

  if (f.taxonomy.subcategory) lines.push(`  subcategory: ${yamlStr(f.taxonomy.subcategory)}`);
  if (f.taxonomy.topic)       lines.push(`  topic: ${yamlStr(f.taxonomy.topic)}`);
  if (f.taxonomy.industry)    lines.push(`  industry: ${yamlStr(f.taxonomy.industry)}`);
  if (f.taxonomy.audience)    lines.push(`  audience: ${yamlStr(f.taxonomy.audience)}`);
  if (f.taxonomy.intent)      lines.push(`  intent: ${yamlStr(f.taxonomy.intent)}`);
  if (f.platform)             lines.push(`platform: ${yamlStr(f.platform)}`);
  if (f.campaign)             lines.push(`campaign: ${yamlStr(f.campaign)}`);

  lines.push(`tags:`);
  for (const tag of f.tags) {
    lines.push(`  - ${yamlStr(tag)}`);
  }

  lines.push(
    `meta:`,
    `  created: ${yamlStr(f.meta.created)}`,
  );
  if (f.meta.updated) lines.push(`  updated: ${yamlStr(f.meta.updated)}`);
  if (f.meta.author)  lines.push(`  author: ${yamlStr(f.meta.author)}`);
  lines.push(
    `  status: ${yamlStr(f.meta.status)}`,
    `  version: ${f.meta.version}`,
    `  source: ${yamlStr(f.meta.source)}`,
  );

  if (f.drive) {
    lines.push(`drive:`);
    if (f.drive.folderId) lines.push(`  folderId: ${yamlStr(f.drive.folderId)}`);
    if (f.drive.fileId)   lines.push(`  fileId: ${yamlStr(f.drive.fileId)}`);
    if (f.drive.path)     lines.push(`  path: ${yamlStr(f.drive.path)}`);
  }

  return `---\n${lines.join('\n')}\n---\n\n${doc.body}`;
}

// ---------------------------------------------------------------------------
// Filename convention
// ---------------------------------------------------------------------------

/**
 * Generate a QMD filename from a title.
 * e.g. "Q1 Campaign Brief" → "2026-03-02_q1-campaign-brief.qmd.md"
 */
export function qmdFilename(title: string, date?: Date): string {
  const d = date ?? new Date();
  const datePart = d.toISOString().slice(0, 10);
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
  return `${datePart}_${slug}.qmd.md`;
}

// ---------------------------------------------------------------------------
// Drive path helper
// ---------------------------------------------------------------------------

/**
 * Compute the Drive subfolder path for a document type.
 * All paths sit under the Synthex root folder.
 */
export function qmdDrivePath(type: QMDDocType, campaign?: string): string {
  const base = '/Synthex';
  switch (type) {
    case 'post':     return campaign ? `${base}/campaigns/${campaign}/posts` : `${base}/content/posts`;
    case 'campaign': return `${base}/campaigns/${campaign ?? 'general'}`;
    case 'asset':    return `${base}/media`;
    case 'report':   return `${base}/reports`;
    case 'brief':    return campaign ? `${base}/campaigns/${campaign}/briefs` : `${base}/content/briefs`;
    case 'content':  return `${base}/content`;
  }
}
