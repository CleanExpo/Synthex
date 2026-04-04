 // UI Wiring Verifier
 // - Extracts DOM id references from public/js/*.js (vanilla scripts)
 // - Searches for matching id="..." in templates/components (public/**/*.html, app/**, components/**)
 // - Reports missing IDs and where found
const fs = require('fs');
const path = require('path');

function walk(dir, exts = [], ignoreDirs = ['node_modules', '.next', '.git', 'playwright-report']) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoreDirs.includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, exts, ignoreDirs));
    else {
      if (exts.length === 0) out.push(full);
      else if (exts.some((e) => full.toLowerCase().endsWith(e.toLowerCase()))) out.push(full);
    }
  }
  return out;
}

function unique(arr) {
  return Array.from(new Set(arr));
}

function extractIdsFromJS(source) {
  const ids = [];
  // document.getElementById('id')
  const reGetById = /document\.getElementById\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  // querySelector(...) or querySelectorAll(...) — capture full selector and filter to pure "#id"
  const reQuerySel = /document\.querySelector(All)?\(\s*(['"`])([^'"`]+)\2\s*\)/g;

  let m;
  while ((m = reGetById.exec(source)) !== null) {
    const id = m[1];
    if (id && !id.includes('${')) {
      ids.push(id);
    }
  }

  while ((m = reQuerySel.exec(source)) !== null) {
    const sel = m[3];
    // Only accept simple id selectors exactly like "#my-id"
    const simpleId = sel.match(/^#([A-Za-z0-9_-]+)$/);
    if (simpleId && simpleId[1] && !simpleId[1].includes('${')) {
      ids.push(simpleId[1]);
    }
  }

  return ids;
}

function findIdOccurrencesInSource(source, id) {
  // Match id="myId" or id='myId'
  const re = new RegExp(`\\bid\\s*=\\s*["']${id}["']`, 'g');
  const occurrences = [];
  let m;
  while ((m = re.exec(source)) !== null) {
    // Provide a small snippet around the match for context
    const start = Math.max(0, m.index - 60);
    const end = Math.min(source.length, m.index + 60);
    occurrences.push(source.slice(start, end).replace(/\s+/g, ' ').trim());
  }
  return occurrences;
}

function main() {
  const jsDir = path.resolve('public/js');
  const searchRoots = [
    path.resolve('public'),
    path.resolve('app'),
    path.resolve('components'),
    path.resolve('src'),
  ];
  const outDir = path.resolve('agents/reports');
  const outPath = path.join(outDir, 'ui-wiring-report.json');
  fs.mkdirSync(outDir, { recursive: true });

  // 1) Extract referenced IDs from vanilla JS files
  const jsFiles = walk(jsDir, ['.js', '.mjs']);
  const idMap = new Map(); // id -> { files: [file...], count }
  for (const f of jsFiles) {
    const src = fs.readFileSync(f, 'utf8');
    const ids = extractIdsFromJS(src);
    for (const id of ids) {
      if (!idMap.has(id)) idMap.set(id, { files: new Set(), count: 0 });
      const info = idMap.get(id);
      info.files.add(path.relative(process.cwd(), f));
      info.count++;
    }
  }

  const referencedIds = Array.from(idMap.keys()).sort();

  // 2) Search for id occurrences in templates/components
  const exts = ['.html', '.tsx', '.jsx', '.ts', '.js', '.mjs'];
  const searchFiles = unique(searchRoots.flatMap((r) => walk(r, exts)));
  const foundIndex = new Map(); // id -> [{ file, snippets[] }]
  for (const id of referencedIds) {
    foundIndex.set(id, []);
  }

  for (const f of searchFiles) {
    const src = fs.readFileSync(f, 'utf8');
    for (const id of referencedIds) {
      const occ = findIdOccurrencesInSource(src, id);
      if (occ.length) {
        foundIndex.get(id).push({
          file: path.relative(process.cwd(), f),
          matches: occ.slice(0, 3), // limit snippets
        });
      }
    }
  }

  // 3) Build report
  const report = {
    generatedAt: new Date().toISOString(),
    scannedJSFiles: jsFiles.map((f) => path.relative(process.cwd(), f)),
    referencedIdCount: referencedIds.length,
    referencedIds: referencedIds.map((id) => ({
      id,
      referencedBy: Array.from(idMap.get(id).files),
      referenceCount: idMap.get(id).count,
      foundIn: foundIndex.get(id),
      status: foundIndex.get(id).length ? 'RESOLVED' : 'MISSING',
    })),
    summary: {
      missing: referencedIds.filter((id) => foundIndex.get(id).length === 0).length,
      resolved: referencedIds.filter((id) => foundIndex.get(id).length > 0).length,
    },
  };

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(
    `UI wiring scan complete. IDs referenced: ${report.referencedIdCount}, missing: ${report.summary.missing}, resolved: ${report.summary.resolved}`
  );
  console.log(`Wrote ${path.relative(process.cwd(), outPath)}`);
}

main();
