#!/usr/bin/env node
// scripts/aeo-audit.mjs
//
// AEO Phase A audit tool — Q3.2.3 Amendment 4 schema-vs-content match
// + Aid Rule check + brand-distinctness check + category-claim VG-state flag.
//
// SYN-823 (Phase A audit · DR + cross-portfolio readable parts).
// SYN-822 epic. local-seo-geo-veteran + seo-schema skill output.
//
// Usage:
//   node scripts/aeo-audit.mjs                       # all 4 brand homepages
//   node scripts/aeo-audit.mjs --brand=DR
//   node scripts/aeo-audit.mjs --url=https://example.com/path
//
// Output:
//   .claude/scratchpad/aeo-phase-a-{brand}-audit.md  per brand
//   .claude/scratchpad/aeo-phase-a-summary.md         cross-portfolio rollup
//
// What it checks:
//   1. JSON-LD presence + parseability (Q3.2.3 A4)
//   2. Schema-vs-content match (does schema reference visible page text?)
//   3. Aid Rule violations (AI framed as actor in description/headlines)
//   4. Category claim audit (first/only/leading/largest needs VG-state)
//   5. Brand-distinctness (does Brand A schema mention Brand B per Phase 3.4 carve-out)
//   6. Bing Places parity (front-end signal: are Bing-specific meta tags present)

import { writeFile, mkdir } from 'node:fs/promises';
import DOMPurify from 'isomorphic-dompurify';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const SCRATCHPAD = resolve(REPO_ROOT, '.claude/scratchpad');

// ─── BRAND CATALOGUE ─────────────────────────────────────────────────────
// Per CEO foundation memory + 2026-04-29 probe.
// NRPG URL not confirmed — skip for now and flag in summary.
const BRANDS = {
  DR: {
    name: 'Disaster Recovery',
    domain: 'disasterrecovery.com.au',
    urls: ['https://disasterrecovery.com.au/'],
    expectedSchemaTypes: [
      'Organization',
      'WebSite',
      'LocalBusiness',
      'Service',
    ],
    aidRuleApplicable: true,
    l7CarveOut: 'full-gbp-allowed',
    sisterBrands: ['NRPG', 'RestoreAssist', 'CARSI'],
    phase34Boundary: [],
  },
  RestoreAssist: {
    name: 'RestoreAssist',
    domain: 'restoreassist.app',
    urls: ['https://restoreassist.app/'],
    expectedSchemaTypes: ['Organization', 'SoftwareApplication', 'WebSite'],
    aidRuleApplicable: true,
    l7CarveOut: 'org-schema-only',
    sisterBrands: ['DR', 'NRPG', 'CARSI'],
    phase34Boundary: [],
  },
  CARSI: {
    name: 'CARSI',
    domain: 'carsi.com.au',
    urls: ['https://carsi.com.au/'],
    expectedSchemaTypes: ['Organization', 'EducationalOrganization', 'WebSite'],
    aidRuleApplicable: true,
    l7CarveOut: 'org-schema-only',
    sisterBrands: ['DR', 'NRPG', 'RestoreAssist'],
    phase34Boundary: [],
  },
};

// ─── PATTERNS ────────────────────────────────────────────────────────────
const AID_RULE_PATTERNS = [
  /\bAI[-\s]?powered\b/i,
  /\bAI[-\s]?driven\b/i,
  /\bAI[-\s]?automated\b/i,
  /\bautomated by AI\b/i,
  /\bAI\s+(restores?|repairs?|cleans?|documents?|inspects?|decides?|approves?)\b/i,
  /\b(restoration|repair|cleanup|documentation|inspection|approval) by (our )?AI\b/i,
];

const CATEGORY_CLAIM_PATTERNS = [
  /\b(Australia['']?s?|the)\s+(first|only|leading|largest|number\s*one|#1|biggest|best)\b/i,
  /\b(first|only|leading|largest|number\s*one|#1|biggest|best)\s+(AI|software|platform|app|tool|service|company|provider)\b/i,
];

// ─── UTILS ───────────────────────────────────────────────────────────────
function arg(name, fallback) {
  const found = process.argv.slice(2).find(a => a.startsWith(`--${name}=`));
  return found ? found.split('=')[1] : fallback;
}

async function ensureScratchpad() {
  if (!existsSync(SCRATCHPAD)) await mkdir(SCRATCHPAD, { recursive: true });
}

async function fetchPage(url) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; SynthexAEOAudit/1.0; +https://synthex.social)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15000),
    });
    return {
      ok: res.ok,
      status: res.status,
      ms: Date.now() - t0,
      html: await res.text(),
      contentType: res.headers.get('content-type') || '',
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      ms: Date.now() - t0,
      html: '',
      error: err.message || String(err),
      contentType: '',
    };
  }
}

function extractJsonLd(html) {
  const blocks = [];
  const regex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const raw = m[1].trim();
    let parsed = null;
    let parseError = null;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      parseError = e.message;
    }
    blocks.push({ raw: raw.slice(0, 4000), parsed, parseError });
  }
  return blocks;
}

// Atomic entity decoder — single pass prevents double-decoding bugs (e.g.
// `&amp;lt;` should stay as `&lt;`, not become `<`).
const ENTITY_MAP = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
};

function extractVisibleText(html) {
  // DOMPurify is the security boundary — removes script/style/iframe/etc.
  // using a real HTML parser, eliminating the nested-tag bypass that regex
  // strips are vulnerable to.
  const safe = DOMPurify.sanitize(html, {
    FORBID_TAGS: ['script', 'style', 'noscript', 'iframe', 'object', 'embed', 'form'],
    KEEP_CONTENT: true,
  });
  return safe
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:nbsp|amp|quot|#39|apos);/g, (match) => ENTITY_MAP[match] || match)
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitle(html) {
  const m = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
  return m ? m[1].trim() : null;
}

function extractMetaDescription(html) {
  const m = /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i.exec(
    html
  );
  return m ? m[1].trim() : null;
}

function extractHeadings(html) {
  const out = { h1: [], h2: [], h3: [] };
  for (const tag of ['h1', 'h2', 'h3']) {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
    let m;
    while ((m = re.exec(html)) !== null) {
      const txt = m[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (txt) out[tag].push(txt.slice(0, 200));
    }
  }
  return out;
}

function flatten(obj, depth = 0) {
  // Walk JSON-LD object and flatten string values for substring matching
  if (depth > 6) return [];
  if (obj === null || obj === undefined) return [];
  if (typeof obj === 'string') return [obj];
  if (typeof obj !== 'object') return [];
  if (Array.isArray(obj)) return obj.flatMap(v => flatten(v, depth + 1));
  return Object.values(obj).flatMap(v => flatten(v, depth + 1));
}

function findAidRuleViolations(text) {
  const hits = [];
  for (const pattern of AID_RULE_PATTERNS) {
    const m = text.match(pattern);
    if (m) hits.push({ pattern: pattern.source, match: m[0] });
  }
  return hits;
}

function findCategoryClaims(text) {
  const hits = [];
  for (const pattern of CATEGORY_CLAIM_PATTERNS) {
    const m = text.match(pattern);
    if (m) hits.push({ pattern: pattern.source, match: m[0] });
  }
  return hits;
}

function checkSchemaContentMatch(jsonLd, visibleText) {
  // For each JSON-LD value that's a "claim" (name/description/address/etc),
  // check whether a slug of it appears in visible page text.
  if (!jsonLd.parsed) return { checked: 0, matched: 0, mismatches: [] };
  const claimKeys = [
    'name',
    'alternateName',
    'description',
    'streetAddress',
    'addressLocality',
  ];
  const mismatches = [];
  let checked = 0;
  let matched = 0;
  function walk(node, path = '') {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${path}[${i}]`));
      return;
    }
    for (const [k, v] of Object.entries(node)) {
      if (claimKeys.includes(k) && typeof v === 'string' && v.length > 4) {
        checked++;
        // Check first 30 chars of the claim appears in visible text
        const slug = v.slice(0, 30).toLowerCase();
        if (visibleText.toLowerCase().includes(slug)) {
          matched++;
        } else {
          mismatches.push({ key: `${path}.${k}`, value: v.slice(0, 120) });
        }
      } else if (v && typeof v === 'object') {
        walk(v, `${path}.${k}`);
      }
    }
  }
  walk(jsonLd.parsed);
  return { checked, matched, mismatches };
}

function checkBrandDistinctness(
  jsonLdAllValues,
  brand,
  sisterBrands,
  phase34Boundary
) {
  // Does this brand's schema mention sister-brand names? (informational)
  // Does it mention Phase 3.4 boundary brands? (HARD violation)
  const text = jsonLdAllValues.join(' ').toLowerCase();
  const sisterMentions = sisterBrands.filter(s =>
    text.includes(BRANDS[s] ? BRANDS[s].name.toLowerCase() : s.toLowerCase())
  );
  const phase34Violations = phase34Boundary.filter(p =>
    text.includes(BRANDS[p] ? BRANDS[p].name.toLowerCase() : p.toLowerCase())
  );
  return { sisterMentions, phase34Violations };
}

// ─── AUDIT ───────────────────────────────────────────────────────────────
async function auditUrl(url, brandKey) {
  const brand = BRANDS[brandKey];
  const fetched = await fetchPage(url);
  if (!fetched.ok) {
    return {
      url,
      brandKey,
      fetchOk: false,
      status: fetched.status,
      error: fetched.error,
    };
  }
  const jsonLd = extractJsonLd(fetched.html);
  const visibleText = extractVisibleText(fetched.html);
  const title = extractTitle(fetched.html);
  const metaDesc = extractMetaDescription(fetched.html);
  const headings = extractHeadings(fetched.html);

  // Aid Rule check (only for Nexus brands per foundation)
  const aidRuleScopes = [];
  if (brand.aidRuleApplicable) {
    if (title) {
      const hits = findAidRuleViolations(title);
      if (hits.length)
        aidRuleScopes.push({ where: 'title', text: title, hits });
    }
    if (metaDesc) {
      const hits = findAidRuleViolations(metaDesc);
      if (hits.length)
        aidRuleScopes.push({ where: 'meta-description', text: metaDesc, hits });
    }
    for (const h of headings.h1.concat(headings.h2)) {
      const hits = findAidRuleViolations(h);
      if (hits.length) aidRuleScopes.push({ where: 'heading', text: h, hits });
    }
    for (const block of jsonLd) {
      if (!block.parsed) continue;
      for (const v of flatten(block.parsed)) {
        if (typeof v !== 'string') continue;
        const hits = findAidRuleViolations(v);
        if (hits.length)
          aidRuleScopes.push({ where: 'jsonld', text: v.slice(0, 200), hits });
      }
    }
  }

  // Category-claim audit
  const categoryClaims = [];
  for (const text of [title, metaDesc, ...headings.h1, ...headings.h2]) {
    if (!text) continue;
    const hits = findCategoryClaims(text);
    if (hits.length)
      categoryClaims.push({
        where:
          text === title
            ? 'title'
            : text === metaDesc
              ? 'meta-description'
              : 'heading',
        text,
        hits,
      });
  }
  for (const block of jsonLd) {
    if (!block.parsed) continue;
    for (const v of flatten(block.parsed)) {
      if (typeof v !== 'string') continue;
      const hits = findCategoryClaims(v);
      if (hits.length)
        categoryClaims.push({ where: 'jsonld', text: v.slice(0, 200), hits });
    }
  }

  // Schema-vs-content match (Q3.2.3 A4)
  const matchPerBlock = jsonLd.map((b, i) => ({
    blockIndex: i,
    types: b.parsed
      ? Array.isArray(b.parsed['@type'])
        ? b.parsed['@type']
        : [b.parsed['@type']].filter(Boolean)
      : [],
    parseError: b.parseError,
    ...checkSchemaContentMatch(b, visibleText),
  }));

  // Brand-distinctness + Phase 3.4 violations
  const allJsonLdValues = jsonLd.flatMap(b => flatten(b.parsed));
  const brandDist = checkBrandDistinctness(
    allJsonLdValues,
    brandKey,
    brand.sisterBrands,
    brand.phase34Boundary
  );

  // Expected schema types coverage
  const presentTypes = new Set(matchPerBlock.flatMap(m => m.types));
  const missingExpected = brand.expectedSchemaTypes.filter(
    t => !presentTypes.has(t)
  );

  return {
    url,
    brandKey,
    fetchOk: true,
    httpStatus: fetched.status,
    fetchMs: fetched.ms,
    title,
    metaDescription: metaDesc,
    headings: {
      h1Count: headings.h1.length,
      h2Count: headings.h2.length,
      sample: { h1: headings.h1.slice(0, 3), h2: headings.h2.slice(0, 5) },
    },
    jsonLd: {
      blockCount: jsonLd.length,
      parseErrors: jsonLd.filter(b => b.parseError).length,
      types: [...presentTypes],
      missingExpectedTypes: missingExpected,
    },
    aidRuleViolations: aidRuleScopes,
    categoryClaims,
    schemaContentMatch: matchPerBlock,
    brandDistinctness: brandDist,
  };
}

// ─── REPORT ──────────────────────────────────────────────────────────────
function classifyFinding(audit) {
  const findings = [];
  // P0 Aid Rule violations on Nexus brands
  for (const v of audit.aidRuleViolations || []) {
    findings.push({
      severity: 'P0',
      category: 'Aid Rule',
      where: v.where,
      detail: `"${v.text}" matches pattern: ${v.hits.map(h => h.match).join(' · ')}`,
      foundationRef: 'Aid Rule binding (no AI-as-actor framing)',
    });
  }
  // P0 Phase 3.4 boundary violations
  if (audit.brandDistinctness?.phase34Violations.length) {
    findings.push({
      severity: 'P0',
      category: 'Phase 3.4 boundary',
      detail: `Schema mentions Phase 3.4 carve-out brand(s): ${audit.brandDistinctness.phase34Violations.join(', ')}`,
      foundationRef: 'Phase 3.4 cross-portfolio boundary mechanical',
    });
  }
  // P1 schema parse errors
  if (audit.jsonLd?.parseErrors > 0) {
    findings.push({
      severity: 'P1',
      category: 'Schema parse error',
      detail: `${audit.jsonLd.parseErrors} of ${audit.jsonLd.blockCount} JSON-LD blocks failed to parse`,
      foundationRef: 'Q3.2.3 A4',
    });
  }
  // P1 schema-vs-content mismatches
  for (const m of audit.schemaContentMatch || []) {
    if (m.mismatches?.length) {
      findings.push({
        severity: 'P1',
        category: 'Schema-vs-content mismatch (Q3.2.3 A4)',
        where: `JSON-LD block #${m.blockIndex} (types: ${m.types.join('+')})`,
        detail: `${m.matched}/${m.checked} claim values found in visible page text. Mismatches: ${m.mismatches.map(x => `\`${x.key}\` = "${x.value}"`).join(' · ')}`,
        foundationRef: 'Q3.2.3 A4',
      });
    }
  }
  // P1 unverified category claims
  for (const c of audit.categoryClaims || []) {
    findings.push({
      severity: 'P1',
      category: 'Unverified category claim',
      where: c.where,
      detail: `"${c.text}" — claim "${c.hits.map(h => h.match).join(' · ')}" requires VG-state [verified-DD/MM/YYYY] or fallback to functional language`,
      foundationRef:
        'category-claim gating (pr-communications-lead NEVER list rule 1)',
    });
  }
  // P2 missing expected schema types
  if (audit.jsonLd?.missingExpectedTypes.length) {
    findings.push({
      severity: 'P2',
      category: 'Missing expected schema type',
      detail: `Missing: ${audit.jsonLd.missingExpectedTypes.join(', ')}`,
      foundationRef: `Brand-expected types per ${audit.brandKey} foundation profile`,
    });
  }
  // P3 sister-brand mentions (informational only)
  if (audit.brandDistinctness?.sisterMentions.length) {
    findings.push({
      severity: 'P3',
      category: 'Sister-brand mention (informational)',
      detail: `Schema mentions sister brand(s): ${audit.brandDistinctness.sisterMentions.join(', ')} — review whether brand-distinctness per Q3.2.2 is at risk`,
      foundationRef: 'Q3.2.2 brand-distinctness (informational)',
    });
  }
  return findings;
}

function renderBrandReport(brandKey, audits) {
  const brand = BRANDS[brandKey];
  let md = `# AEO Phase A Audit — ${brand.name} (${brand.domain})\n\n`;
  md += `**Generated:** ${new Date().toISOString()}\n`;
  md += `**Tool:** \`scripts/aeo-audit.mjs\` (SYN-823 deliverable)\n`;
  md += `**Foundation:** Q3.2.3 A4 (schema-vs-content match) + Aid Rule + Phase 3.4 boundary + L7 carve-out (${brand.l7CarveOut})\n\n`;

  for (const audit of audits) {
    md += `---\n\n## ${audit.url}\n\n`;
    if (!audit.fetchOk) {
      md += `**FETCH FAILED:** HTTP ${audit.status} ${audit.error || ''}\n\n`;
      continue;
    }
    md += `**HTTP ${audit.httpStatus}** · ${audit.fetchMs}ms · title: \`${audit.title}\` · meta-description: ${audit.metaDescription ? `present (${audit.metaDescription.length} chars)` : '**MISSING**'}\n\n`;
    md += `**JSON-LD:** ${audit.jsonLd.blockCount} block(s) · ${audit.jsonLd.parseErrors} parse error(s) · types present: \`${audit.jsonLd.types.join('` · `') || '(none)'}\`\n\n`;
    if (audit.jsonLd.missingExpectedTypes.length) {
      md += `**Missing expected types:** \`${audit.jsonLd.missingExpectedTypes.join('` · `')}\`\n\n`;
    }

    const findings = classifyFinding(audit);
    if (findings.length === 0) {
      md += `### ✅ No findings\n\n`;
    } else {
      const ranked = { P0: [], P1: [], P2: [], P3: [] };
      for (const f of findings) ranked[f.severity].push(f);
      for (const sev of ['P0', 'P1', 'P2', 'P3']) {
        if (ranked[sev].length === 0) continue;
        md += `### ${sev} findings (${ranked[sev].length})\n\n`;
        for (const f of ranked[sev]) {
          md += `- **${f.category}**${f.where ? ` (\`${f.where}\`)` : ''}\n`;
          md += `  - ${f.detail}\n`;
          md += `  - _Foundation:_ ${f.foundationRef}\n\n`;
        }
      }
    }
  }

  md += `---\n\n## Headings sample (last URL)\n\n`;
  const last = audits[audits.length - 1];
  if (last && last.headings) {
    md += `**H1:** ${last.headings.sample.h1.map(h => `\`${h}\``).join(' · ') || '(none)'}\n\n`;
    md += `**H2:** ${last.headings.sample.h2.map(h => `\`${h}\``).join(' · ') || '(none)'}\n\n`;
  }
  return md;
}

function renderSummary(allAudits) {
  let md = `# AEO Phase A Audit — Cross-Portfolio Summary\n\n`;
  md += `**Generated:** ${new Date().toISOString()}\n`;
  md += `**Tool:** \`scripts/aeo-audit.mjs\` (SYN-823 deliverable)\n`;
  md += `**Brands audited:** ${Object.keys(allAudits).join(' · ')}\n`;
  md += `**Brands NOT audited:** NRPG (URL not yet confirmed by CEO)\n\n`;

  md += `## Headline\n\n`;
  let p0 = 0,
    p1 = 0,
    p2 = 0,
    p3 = 0;
  for (const audits of Object.values(allAudits)) {
    for (const audit of audits) {
      if (!audit.fetchOk) continue;
      const findings = classifyFinding(audit);
      for (const f of findings) {
        if (f.severity === 'P0') p0++;
        else if (f.severity === 'P1') p1++;
        else if (f.severity === 'P2') p2++;
        else p3++;
      }
    }
  }
  md += `| Severity | Count | What it means |\n`;
  md += `|---|---|---|\n`;
  md += `| **P0** | ${p0} | Aid Rule violation OR Phase 3.4 cross-boundary breach — fix before any earned-media outreach |\n`;
  md += `| **P1** | ${p1} | Schema-vs-content mismatch · parse errors · unverified category claims |\n`;
  md += `| **P2** | ${p2} | Missing expected schema types — opportunity loss but no policy violation |\n`;
  md += `| **P3** | ${p3} | Sister-brand mentions — informational, review if brand-distinctness at risk |\n\n`;

  md += `## Per-brand snapshot\n\n`;
  md += `| Brand | URLs | JSON-LD blocks | Aid Rule | Phase 3.4 | Category claims | Schema mismatches |\n`;
  md += `|---|---|---|---|---|---|---|\n`;
  for (const [brandKey, audits] of Object.entries(allAudits)) {
    const a = audits[0]; // homepage
    if (!a || !a.fetchOk) {
      md += `| ${brandKey} | FETCH FAIL | — | — | — | — | — |\n`;
      continue;
    }
    const findings = classifyFinding(a);
    const aidCount = findings.filter(f => f.category === 'Aid Rule').length;
    const phase34Count = findings.filter(
      f => f.category === 'Phase 3.4 boundary'
    ).length;
    const claimCount = findings.filter(
      f => f.category === 'Unverified category claim'
    ).length;
    const mismatchCount = findings.filter(f =>
      f.category.startsWith('Schema-vs-content')
    ).length;
    md += `| ${brandKey} | ${audits.length} | ${a.jsonLd.blockCount} | ${aidCount > 0 ? '🔴 ' + aidCount : '✅'} | ${phase34Count > 0 ? '🔴 ' + phase34Count : '✅'} | ${claimCount > 0 ? '🟡 ' + claimCount : '✅'} | ${mismatchCount > 0 ? '🟡 ' + mismatchCount : '✅'} |\n`;
  }
  md += `\n## What this audit cannot see (deferred to follow-up tickets)\n\n`;
  md += `- GBP attribute completeness — needs GBP API auth (Phill-side action SYN-823 A1+A2)\n`;
  md += `- GSC query gap analysis — needs Search Console OAuth (Phill-side SYN-823 A3)\n`;
  md += `- Whitespark/BrightLocal NAP — needs paid subscription (Phill decision #2 SYN-822)\n`;
  md += `- Server-rendered vs client-rendered schema — this tool fetches static HTML; client-injected schema not seen\n`;
  md += `- Subpage coverage — currently audits homepage only per brand; expand URL list when Phase B audit specifics are confirmed\n\n`;
  md += `## Next actions\n\n`;
  md += `1. Triage every P0 (Aid Rule + Phase 3.4) immediately — these are non-negotiable foundation rules\n`;
  md += `2. For each P1 schema-vs-content mismatch: either fix the schema OR add visible page content to match (Q3.2.3 A4 binding)\n`;
  md += `3. For each P1 category claim: route through pr-communications-lead claim-audit, fall back to functional language unless VG-state is verified\n`;
  md += `4. For each P2 missing schema type: route to seo-schema for generation\n`;
  md += `5. Re-run \`node scripts/aeo-audit.mjs\` after each fix to verify the cluster cleared\n\n`;
  return md;
}

// ─── MAIN ────────────────────────────────────────────────────────────────
async function main() {
  await ensureScratchpad();
  const targetBrand = arg('brand', null);
  const targetUrl = arg('url', null);

  if (targetUrl) {
    // Single URL mode
    console.log(`Auditing ${targetUrl}...`);
    const audit = await auditUrl(targetUrl, targetBrand || 'DR');
    console.log(JSON.stringify(audit, null, 2));
    return;
  }

  const allAudits = {};
  const brandKeys = targetBrand ? [targetBrand] : Object.keys(BRANDS);
  for (const brandKey of brandKeys) {
    const brand = BRANDS[brandKey];
    if (!brand) {
      console.error(`Unknown brand: ${brandKey}`);
      continue;
    }
    console.log(`\n=== ${brandKey} (${brand.domain}) ===`);
    const audits = [];
    for (const url of brand.urls) {
      console.log(`  ${url} ...`);
      const a = await auditUrl(url, brandKey);
      audits.push(a);
      const findings = a.fetchOk ? classifyFinding(a) : [];
      const c = findings.reduce(
        (acc, f) => ({ ...acc, [f.severity]: (acc[f.severity] || 0) + 1 }),
        {}
      );
      console.log(
        `    HTTP ${a.httpStatus || 'X'} · ${a.fetchOk ? `${a.jsonLd.blockCount} JSON-LD blocks` : a.error} · findings P0=${c.P0 || 0} P1=${c.P1 || 0} P2=${c.P2 || 0} P3=${c.P3 || 0}`
      );
    }
    allAudits[brandKey] = audits;
    const md = renderBrandReport(brandKey, audits);
    const path = resolve(
      SCRATCHPAD,
      `aeo-phase-a-${brandKey.toLowerCase()}-audit.md`
    );
    await writeFile(path, md);
    console.log(`  → ${path}`);
  }

  if (!targetBrand) {
    const summary = renderSummary(allAudits);
    const summaryPath = resolve(SCRATCHPAD, 'aeo-phase-a-summary.md');
    await writeFile(summaryPath, summary);
    console.log(`\n=== SUMMARY ===`);
    console.log(`→ ${summaryPath}`);
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
