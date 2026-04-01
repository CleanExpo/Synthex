#!/usr/bin/env ts-node
/**
 * validate-schema.ts — JSON-LD schema validation CI check
 *
 * Parses every <script type="application/ld+json"> block in the Next.js
 * build output for Authority Hub routes (app/clients/[slug]) and validates
 * each block against Google's required fields for the following schema types:
 *   - LocalBusiness
 *   - VideoObject
 *   - FAQPage
 *   - SpeakableSpecification
 *
 * Exits with code 1 if any block fails validation.
 * Run locally: npx ts-node scripts/validate-schema.ts
 * Run in CI:   added to package.json build step after `next build`
 *
 * Board decision: SYN-538 / SYN-539 | Session 9 | 2026-03-30
 *
 * ⚠️  IMPORTANT: Verify this script runs on BOTH Vercel preview AND production
 * deployments. Check Vercel build settings → Build Command includes
 * "&& npx ts-node scripts/validate-schema.ts" or equivalent.
 */

import * as fs from 'fs';
import * as path from 'path';
import { globSync } from 'glob';

// ---------------------------------------------------------------------------
// Required fields per schema @type
// ---------------------------------------------------------------------------

// Google's structured data requirements — only truly REQUIRED fields listed.
// address, telephone, openingHours etc. are RECOMMENDED for LocalBusiness
// but are not required to produce a valid Rich Result.
// Reference: https://developers.google.com/search/docs/appearance/structured-data/local-business
const REQUIRED_FIELDS: Record<string, string[]> = {
  LocalBusiness: ['@context', '@type', 'name'],
  VideoObject: [
    '@context',
    '@type',
    'name',
    'description',
    'thumbnailUrl',
    'uploadDate',
  ],
  FAQPage: ['@context', '@type', 'mainEntity'],
  SpeakableSpecification: ['@context', '@type', 'cssSelector'],
};

const SUPPORTED_TYPES = Object.keys(REQUIRED_FIELDS);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractJsonLdBlocks(html: string): string[] {
  const blocks: string[] = [];
  const regex =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}

interface ValidationError {
  file: string;
  blockIndex: number;
  schemaType: string;
  missingFields: string[];
}

function validateBlock(
  json: Record<string, unknown>,
  file: string,
  blockIndex: number
): ValidationError | null {
  const schemaType = json['@type'] as string | undefined;

  if (!schemaType) {
    return {
      file,
      blockIndex,
      schemaType: '(unknown)',
      missingFields: ['@type'],
    };
  }

  if (!SUPPORTED_TYPES.includes(schemaType)) {
    // Skip unsupported types — do not fail
    return null;
  }

  const required = REQUIRED_FIELDS[schemaType];
  const missing = required.filter(
    (field) => json[field] === undefined || json[field] === null || json[field] === ''
  );

  if (missing.length > 0) {
    return { file, blockIndex, schemaType, missingFields: missing };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const buildDir = path.resolve(process.cwd(), '.next');

  if (!fs.existsSync(buildDir)) {
    console.error(
      '❌  .next/ build directory not found. Run `next build` first.'
    );
    process.exit(1);
  }

  // Find all rendered HTML files under .next/server/app/clients/
  const pattern = path.join(buildDir, 'server', 'app', 'clients', '**', '*.html');
  const files = globSync(pattern);

  if (files.length === 0) {
    console.log(
      '⚠️   No Authority Hub HTML files found at .next/server/app/clients/**/*.html'
    );
    console.log(
      '    Schema validation skipped — no client pages rendered in this build.'
    );
    process.exit(0);
  }

  const errors: ValidationError[] = [];
  let blocksChecked = 0;

  for (const file of files) {
    const html = fs.readFileSync(file, 'utf-8');
    const blocks = extractJsonLdBlocks(html);

    for (let i = 0; i < blocks.length; i++) {
      blocksChecked++;
      let json: Record<string, unknown>;

      try {
        json = JSON.parse(blocks[i]) as Record<string, unknown>;
      } catch {
        errors.push({
          file,
          blockIndex: i,
          schemaType: '(parse error)',
          missingFields: [`JSON parse failed: ${blocks[i].slice(0, 80)}...`],
        });
        continue;
      }

      const error = validateBlock(json, file, i);
      if (error) errors.push(error);
    }
  }

  console.log(
    `\n🔍  Schema validation: checked ${blocksChecked} JSON-LD block(s) across ${files.length} Authority Hub page(s).`
  );

  if (errors.length === 0) {
    console.log('✅  All schema blocks are valid.\n');
    process.exit(0);
  }

  console.error(`\n❌  ${errors.length} schema validation error(s) found:\n`);

  for (const err of errors) {
    const relPath = path.relative(process.cwd(), err.file);
    console.error(
      `  File:         ${relPath}`
    );
    console.error(`  Block index:  ${err.blockIndex}`);
    console.error(`  Schema type:  ${err.schemaType}`);
    console.error(
      `  Missing/empty fields: ${err.missingFields.join(', ')}`
    );
    console.error('');
  }

  console.error(
    'Fix the above schema errors before merging to main.\n' +
    'Reference: https://developers.google.com/search/docs/appearance/structured-data\n'
  );

  process.exit(1);
}

main();
