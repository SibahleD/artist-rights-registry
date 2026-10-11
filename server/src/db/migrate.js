
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const pool = require('./pool');

const DIR = path.join(__dirname, 'migrations');
const BASELINE = '001_baseline.sql';
const LOCK_KEY = 727001;

function listFiles() {
    return fs.readdirSync(DIR).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
}

async function ensureTable(client) {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
        name        TEXT PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
}

async function applied(client) {
    const { rows } = await client.query('SELECT name FROM schema_migrations');
    return new Set(rows.map((r) => r.name));
}

async function main() {
    const status = process.argv[2] === 'status';
    const client = await pool.connect();
    try {
        await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
        await ensureTable(client);

        let done = await applied(client);
        if (done.size === 0) {
            const { rows } = await client.query("SELECT to_regclass('public.users') AS t");
            if (rows[0].t && listFiles().includes(BASELINE)) {
                if (status) {
                    console.log(`Existing database detected: ${BASELINE} will be recorded as applied without running.`);
                } else {
                    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [BASELINE]);
                    console.log(`Existing database detected: recorded ${BASELINE} as applied.`);
                    done = await applied(client);
                }
            }
        }

        const files = listFiles();
        const pending = files.filter((f) => !done.has(f));

        if (status) {
            for (const f of files) console.log(`${done.has(f) ? 'applied' : 'pending'}  ${f}`);
            return;
        }
        if (pending.length === 0) {
            console.log('Database is up to date.');
            return;
        }

        for (const f of pending) {
            const sql = fs.readFileSync(path.join(DIR, f), 'utf8');
            try {
                await client.query('BEGIN');
                await client.query(sql);
                await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
                await client.query('COMMIT');
                console.log(`applied  ${f}`);
            } catch (err) {
                await client.query('ROLLBACK').catch(() => {});
                console.error(`FAILED   ${f}: ${err.message}`);
                process.exitCode = 1;
                return;
            }
        }
    } finally {
        await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {});
        client.release();
        await pool.end();
    }
}

main().catch((err) => {
    console.error('migration error:', err.message);
    process.exit(1);
});
