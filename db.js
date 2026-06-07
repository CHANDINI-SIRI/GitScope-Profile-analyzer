const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    },
    max: 4, 
    idleTimeoutMillis: 15000,
    connectionTimeoutMillis: 5000,
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    execute: (text, params) => pool.query(text, params),
};