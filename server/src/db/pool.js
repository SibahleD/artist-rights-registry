const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Add it to server/.env or the host environment.');
}

const { isProduction } = require('../env');
const useSsl = process.env.DATABASE_SSL !== undefined
    ? process.env.DATABASE_SSL !== 'false'
    : isProduction;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    max: Number(process.env.DB_POOL_MAX) || (isProduction ? 3 : 10),
});

pool.on('error', (err) => console.error('Unexpected database error on idle client:', err.message));

module.exports = pool;