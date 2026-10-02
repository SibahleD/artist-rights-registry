const { Pool } = require('pg');

const u = new URL(process.env.DATABASE_URL);
console.log('DB user:', u.username, '| host:', u.host, '| db:', u.pathname);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});
 
module.exports = pool;
 