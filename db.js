const { Pool } = require('pg');

// Initialize the Postgres connection pool container for Neon
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for secure cloud connections to Neon
    }
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    execute: (text, params) => pool.query(text, params)
};