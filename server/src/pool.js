const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Add it to server/.env or the host environment.');
    process.exit(1);
}

const { isProduction } = require('../env');
const useSsl = process.env.DATABASE_SSL !== undefined
    ? process.env.DATABASE_SSL !== 'false'
    : isProduction;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    max: Number(process.env.DB_POOL_MAX) || 10,
});

pool.on('error', (err) => console.error('Unexpected database error on idle client:', err.message));

module.exports = pool;