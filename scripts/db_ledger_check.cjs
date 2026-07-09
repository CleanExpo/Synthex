// CommonJS ledger verification check
const { Pool } = require('pg');
// Connection string comes from argv[2] or DATABASE_URL — never hardcode credentials.
const url = process.argv[2] || process.env.DATABASE_URL;
if (!url) {
  console.error(
    'Missing connection string: pass as argv[2] or set DATABASE_URL'
  );
  process.exit(1);
}

(async () => {
  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });
  const client = await pool.connect();
  try {
    const r = await client.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = '_prisma_migrations'
    `);
    if (r.rowCount === 0) {
      console.log(
        JSON.stringify({ status: 'NO_LEDGER_TABLE', count: 0, ledgers: [] })
      );
      return;
    }
    const res = await client.query(
      'SELECT migration_name FROM public._prisma_migrations ORDER BY migration_name DESC LIMIT 20'
    );
    console.log(
      JSON.stringify({
        status: 'OK',
        count: res.rowCount,
        latest: res.rows.map(r => r.migration_name).slice(0, 10),
      })
    );
  } catch (e) {
    console.error(e.message);
  } finally {
    client.release();
    await pool.end();
  }
})();
