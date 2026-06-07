const { Pool } = require('pg');
require('dotenv').config();

// Initialize the Postgres connection configuration pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for secure serverless connections to Neon Postgres
    },
    max: 10, // Maintain safe connection scaling counts
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Expose a unified query executor mapping database arrays to match your Express routing pipeline
module.exports = {
    query: (text, params) => pool.query(text, params),
    execute: (text, params) => pool.query(text, params), // Mapped for backwards-compatibility with index.js
};