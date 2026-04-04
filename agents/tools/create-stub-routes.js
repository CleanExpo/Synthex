const fs = require('fs');
const path = require('path');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function makeRouteTS(handlers) {
  // handlers: { GET?: string, POST?: string, PUT?: string, PATCH?: string, DELETE?: string }
  // Each value is JS code that returns a NextResponse (body only).
  const imports = `import { NextResponse } from 'next/server';\n`;
  let body = imports + '\n';
  for (const [method, code] of Object.entries(handlers)) {
    body += `export async function ${method}() {\n  return NextResponse.json(${code});\n}\n\n`;
  }
  return body;
}

function writeRoute(fileRel, handlers) {
  const full = path.resolve(path.join('app', 'api', fileRel));
  ensureDir(path.dirname(full));
  const content = makeRouteTS(handlers);
  fs.writeFileSync(full, content, 'utf8');
  return full;
}

function main() {
  const created = [];

  // TEAMS
  created.push(writeRoute(path.join('teams', 'invite', 'route.ts'), {
    POST: `{ success: true, message: 'Invitation sent (stub)' }`
  }));

  created.push(writeRoute(path.join('teams', 'members', 'route.ts'), {
    GET: `{
      data: [
        { id: '1', name: 'Admin User', email: 'admin@synthex.social', role: 'admin', joinedAt: '2024-01-15', lastActive: new Date().toISOString(), stats: { campaigns: 45, content: 128, reach: 450000 } },
        { id: '2', name: 'Editor User', email: 'editor@synthex.social', role: 'editor', joinedAt: '2024-02-20', lastActive: new Date(Date.now()-2*3600000).toISOString(), stats: { campaigns: 23, content: 67, reach: 125000 } },
        { id: '3', name: 'Marketing Team', email: 'marketing@synthex.social', role: 'editor', joinedAt: '2024-03-10', lastActive: new Date(Date.now()-24*3600000).toISOString(), stats: { campaigns: 18, content: 42, reach: 89000 } },
        { id: '4', name: 'Analytics Team', email: 'analytics@synthex.social', role: 'viewer', joinedAt: '2024-04-05', lastActive: new Date(Date.now()-3*24*3600000).toISOString(), stats: { campaigns: 0, content: 0, reach: 0 } }
      ]
    }`
  }));

  created.push(writeRoute(path.join('teams', 'members', '[memberId]', 'route.ts'), {
    PATCH: `{ success: true }`,
    DELETE: `{ success: true }`
  }));

  created.push(writeRoute(path.join('teams', 'members', '[memberId]', 'role', 'route.ts'), {
    PATCH: `{ success: true }`
  }));

  created.push(writeRoute(path.join('teams', 'activity', 'route.ts'), {
    GET: `{
      data: [
        { id: '1', memberId: '1', memberName: 'Sarah Johnson', action: 'created a new campaign', target: 'Summer Sale 2024', timestamp: new Date(Date.now()-30*60000).toISOString() },
        { id: '2', memberId: '2', memberName: 'Michael Chen', action: 'published content to', target: 'Instagram', timestamp: new Date(Date.now()-2*3600000).toISOString() },
        { id: '3', memberId: '3', memberName: 'Emily Davis', action: 'generated AI content for', target: 'Product Launch', timestamp: new Date(Date.now()-5*3600000).toISOString() }
      ]
    }`
  }));

  created.push(writeRoute(path.join('teams', 'stats', 'route.ts'), {
    GET: `{ totalMembers: 4, activeCampaigns: 12, contentCreated: 248, totalReach: 125000 }`
  }));

  // USERS (rewrite maps /api/v2/users/* -> /api/user/*)
  created.push(writeRoute(path.join('user', 'account', 'route.ts'), {
    DELETE: `{ success: true }`
  }));
  created.push(writeRoute(path.join('user', 'change-password', 'route.ts'), {
    POST: `{ success: true }`
  }));

  // AUTH
  created.push(writeRoute(path.join('auth', 'reset-password', 'route.ts'), {
    POST: `{ success: true }`
  }));
  created.push(writeRoute(path.join('auth', 'verify-token', 'route.ts'), {
    POST: `{ valid: true }`
  }));

  // ANALYTICS
  created.push(writeRoute(path.join('analytics', 'route.ts'), {
    GET: `{ data: { totals: { posts: 0, reach: 0 } } }`
  }));
  created.push(writeRoute(path.join('analytics', 'insights', 'route.ts'), {
    GET: `{ data: [] }`
  }));
  created.push(writeRoute(path.join('analytics', 'realtime', 'route.ts'), {
    GET: `{ data: { online: 0 } }`
  }));

  // AI CONTENT
  created.push(writeRoute(path.join('ai-content', 'hashtags', 'route.ts'), {
    POST: `{ hashtags: ['#synthex', '#ai', '#marketing'] }`
  }));
  created.push(writeRoute(path.join('ai-content', 'optimize', 'route.ts'), {
    POST: `{ optimized: true }`
  }));
  created.push(writeRoute(path.join('ai-content', 'translate', 'route.ts'), {
    POST: `{ translated: true, locale: 'en' }`
  }));

  // AB-TESTING
  created.push(writeRoute(path.join('ab-testing', 'tests', 'route.ts'), {
    GET: `{ data: [] }`,
    POST: `{ id: 'test_1', status: 'created' }`
  }));
  created.push(writeRoute(path.join('ab-testing', 'tests', '[testId]', 'results', 'route.ts'), {
    GET: `{ data: { variants: [] } }`
  }));

  // COMPETITORS
  created.push(writeRoute(path.join('competitors', 'route.ts'), {
    GET: `{ data: [] }`,
    POST: `{ id: 'comp_1', status: 'created' }`
  }));
  created.push(writeRoute(path.join('competitors', '[competitorId]', 'analyze', 'route.ts'), {
    POST: `{ status: 'queued' }`
  }));

  // FEATURES
  created.push(writeRoute(path.join('features', 'route.ts'), {
    GET: `{ features: [] }`
  }));

  // LIBRARY
  created.push(writeRoute(path.join('library', 'content', 'route.ts'), {
    GET: `{ data: [] }`,
    POST: `{ id: 'content_1' }`
  }));
  created.push(writeRoute(path.join('library', 'content', '[contentId]', 'route.ts'), {
    GET: `{ id: 'content_1', content: '' }`
  }));

  // MOBILE
  created.push(writeRoute(path.join('mobile', 'config', 'route.ts'), {
    GET: `{ version: '1.0.0' }`
  }));
  created.push(writeRoute(path.join('mobile', 'sync', 'route.ts'), {
    POST: `{ success: true }`
  }));

  // NOTIFICATIONS
  created.push(writeRoute(path.join('notifications', 'route.ts'), {
    GET: `{ data: [] }`
  }));
  created.push(writeRoute(path.join('notifications', '[notificationId]', 'read', 'route.ts'), {
    PATCH: `{ success: true }`
  }));
  created.push(writeRoute(path.join('notifications', 'settings', 'route.ts'), {
    PUT: `{ success: true }`
  }));

  // PERFORMANCE
  created.push(writeRoute(path.join('performance', 'metrics', 'route.ts'), {
    GET: `{ data: { ttfb: 0, fcp: 0 } }`
  }));

  // REPORTING
  created.push(writeRoute(path.join('reporting', 'generate', 'route.ts'), {
    POST: `{ id: 'report_1', status: 'generated' }`
  }));
  created.push(writeRoute(path.join('reporting', 'reports', 'route.ts'), {
    GET: `{ data: [] }`
  }));
  created.push(writeRoute(path.join('reporting', 'reports', '[reportId]', 'download', 'route.ts'), {
    GET: `{ url: '#' }`
  }));

  // SCHEDULER
  created.push(writeRoute(path.join('scheduler', 'posts', 'route.ts'), {
    GET: `{ data: [] }`,
    POST: `{ id: 'post_1', status: 'scheduled' }`
  }));
  created.push(writeRoute(path.join('scheduler', 'posts', '[postId]', 'route.ts'), {
    DELETE: `{ success: true }`,
    PATCH: `{ success: true }`
  }));

  // WHITE LABEL
  created.push(writeRoute(path.join('white-label', 'config', 'route.ts'), {
    GET: `{ theme: {} }`,
    PUT: `{ success: true }`
  }));

  console.log(`Created/updated ${created.length} route stubs:`);
  created.forEach(f => console.log('-', path.relative(process.cwd(), f)));
}

main();
