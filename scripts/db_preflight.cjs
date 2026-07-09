// CommonJS preflight check for DB remediation
const { Pool } = require('pg');

// Connection string comes from argv[2] or DATABASE_URL — never hardcode credentials.
const url = process.argv[2] || process.env.DATABASE_URL;
if (!url) {
  console.error(
    'Missing connection string: pass as argv[2] or set DATABASE_URL'
  );
  process.exit(1);
}

const expected = [
  'ai_training_data',
  'analytics',
  'automation_logs',
  'automation_rules',
  'billing_history',
  'client_conversations',
  'collaboration_invites',
  'competitor_analysis',
  'content',
  'content_performance_history',
  'content_queue',
  'content_templates',
  'content_versions',
  'conversation_events',
  'dunning_states',
  'effect_reports',
  'hashtag_performance',
  'live_sessions',
  'mention_freshness',
  'nap_citation',
  'performance_metrics',
  'trending_topics',
  'user_preferences',
  'viral_patterns',
  'workspace_members',
  'workspaces',
];

(async () => {
  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });
  const client = await pool.connect();
  try {
    let missing = [],
      present = [];
    for (const t of expected) {
      const r = await client.query(
        "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1",
        [t]
      );
      (r.rowCount > 0 ? present : missing).push(t);
    }
    console.log(
      JSON.stringify({
        total: expected.length,
        missing: missing.length,
        present: present.length,
        missingNames: missing,
        presentNames: present,
      })
    );
  } catch (e) {
    console.error(e.message);
  } finally {
    client.release();
    await pool.end();
  }
})();
