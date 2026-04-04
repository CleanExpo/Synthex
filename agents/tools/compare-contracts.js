const fs = require('fs');
const path = require('path');

function toRegexFromDisplay(displayPath) {
  // Recreate the same transformation used in extract-server-routes
  let p = displayPath;
  // Escape regex metachars
  p = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Replace :param+, :param*, :param with segment patterns
  p = p.replace(/\\:([a-zA-Z0-9_]+)\+/g, '([^/]+(?:/[^/]+)*)'); // one or more segments
  p = p.replace(/\\:([a-zA-Z0-9_]+)\*/g, '(?:.*)?');            // optional any
  p = p.replace(/\\:([a-zA-Z0-9_]+)/g, '([^/]+)');              // single segment
  const re = '^' + p + '$';
  return new RegExp(re);
}

function loadJSON(p) {
  if (!fs.existsSync(p)) {
    console.error('Missing JSON file:', p);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function main() {
  const reportsDir = path.resolve('agents/reports');
  const clientPath = path.join(reportsDir, 'client-endpoints.json');
  const serverPath = path.join(reportsDir, 'server-routes.json');
  const outPath = path.join(reportsDir, 'contract-report.json');

  const client = loadJSON(clientPath);
  const server = loadJSON(serverPath);

  const clientEndpoints = client.endpoints || [];
  const serverRoutes = (server.routes || []).map(r => ({
    ...r,
    regexObj: toRegexFromDisplay(r.path)
  }));

  // Apply known Next.js rewrites to client endpoints for comparison, mirroring next.config.mjs
  function applyRewrites(p) {
    let r = p;
    // Specific v2 mappings for renamed resources
    r = r.replace(/^\/api\/v2\/users\//, '/api/user/');
    r = r.replace(/^\/api\/v2\/ai-content\/generate$/, '/api/ai/generate-content');
    // Generic v2 -> unified /api fallback
    r = r.replace(/^\/api\/v2\//, '/api/');
    return r;
  }

  // Build indices
  const matchedByServer = new Map(); // server index -> list of client matches
  const matchedByClient = new Map(); // client index -> list of server matches

  // Compare
  const missingOnServer = [];
  const methodMismatch = [];
  for (let i = 0; i < clientEndpoints.length; i++) {
    const ce = clientEndpoints[i]; // {method, path}
    // Apply rewrite normalization mirroring next.config.mjs
    const ceMatchPath = applyRewrites(ce.path);
    // Convert client placeholder tokens like :param, :param+, :param* into a concrete segment
    // so they will match server route regexes like /([^/]+)/
    const ceTestPath = ceMatchPath.replace(/:param(\+|\*)?/g, 'placeholder');
    const matches = serverRoutes
      .map((sr, idx) => ({
        idx,
        sr,
        norm: (sr.path || '').replace(/:([A-Za-z0-9_]+)(\+|\*)?/g, ':param$2')
      }))
      .filter(({ sr, norm }) => sr.regexObj.test(ceTestPath) || norm === ceMatchPath);

    if (matches.length === 0) {
      // Keep original client endpoint but include the normalized path used for matching
      missingOnServer.push({ ...ce, matchPath: ceMatchPath });
      continue;
    }

    matchedByClient.set(i, matches.map(m => m.idx));
    for (const { idx, sr } of matches) {
      if (!matchedByServer.has(idx)) matchedByServer.set(idx, []);
      matchedByServer.get(idx).push(i);
    }

    // Check method match
    const anyMethodMatch = matches.some(({ sr }) => {
      const methods = sr.methods || [];
      if (methods.includes('UNKNOWN')) return true; // unknown => cannot assert mismatch
      return methods.includes(ce.method);
    });

    if (!anyMethodMatch) {
      // Report with details of what server methods exist
      methodMismatch.push({
        client: ce,
        serverCandidates: matches.map(({ sr }) => ({
          source: sr.source,
          path: sr.path,
          methods: sr.methods
        }))
      });
    }
  }

  // Server routes unused by client
  const serverUnused = [];
  for (let sIdx = 0; sIdx < serverRoutes.length; sIdx++) {
    if (!matchedByServer.has(sIdx)) {
      serverUnused.push({
        path: serverRoutes[sIdx].path,
        methods: serverRoutes[sIdx].methods,
        source: serverRoutes[sIdx].source
      });
    }
  }

  // Summary
  const report = {
    generatedAt: new Date().toISOString(),
    clientSource: client.source,
    counts: {
      clientEndpoints: clientEndpoints.length,
      serverRoutes: serverRoutes.length,
      missingOnServer: missingOnServer.length,
      methodMismatch: methodMismatch.length,
      serverUnused: serverUnused.length
    },
    missingOnServer,
    methodMismatch,
    serverUnused
  };

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

  // Console summary
  console.log('Contract comparison complete.');
  console.log('Counts:', report.counts);
  console.log(`Wrote ${path.relative(process.cwd(), outPath)}`);
}

main();
