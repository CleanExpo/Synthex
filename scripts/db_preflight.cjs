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

// Live supabase-runtime tables preflight expects to exist. The 17 legacy-dead
// tables previously listed here were dropped in the F1 founder session
// (parity remediation, spec docs/specs/spm-parity-remediation-2026-07-11.md C3);
// removing them stops this report false-alarming "missing" after the drop.
const expected = [
  'automation_rules',
  'client_conversations',
  'content',
  'conversation_events',
  'dunning_states',
  'effect_reports',
  'mention_freshness',
  'nap_citation',
  'viral_patterns',
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
