const mysql = require('mysql2/promise'); // Make sure '/promise' is included here!
require('dotenv').config();

// Create a Promise-based pool
const db = mysql.createPool({
    host: process.env.DB_HOST || 'mysql-2282e591-sirichandini40-a2a.e.aivencloud.com',
    port: process.env.DB_PORT || 11520,
    user: process.env.DB_USER || 'avnadmin',
    password: process.env.DB_PASSWORD, 
    database: process.env.DB_NAME || 'defaultdb',
    ssl: {
        rejectUnauthorized: false
    },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Auto-patch column changes and ensure the table exists on launch
const initDatabase = async () => {
    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS github_profiles (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(255) NOT NULL UNIQUE,
            name VARCHAR(255),
            bio TEXT,
            location VARCHAR(255),
            public_repos INT DEFAULT 0,
            public_gists INT DEFAULT 0,
            followers INT DEFAULT 0,
            following INT DEFAULT 0,
            account_age_years DECIMAL(5,2) DEFAULT 0.00,
            engagement_score INT DEFAULT 0,
            primary_sub_stack VARCHAR(100) DEFAULT 'Unknown',
            created_at TIMESTAMP NULL,
            analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );
    `;
    try {
        await db.execute(createTableSQL);
        
        // Safely add column if missing from earlier steps
        try {
            await db.execute("ALTER TABLE github_profiles ADD COLUMN primary_sub_stack VARCHAR(100) DEFAULT 'Unknown' AFTER engagement_score;");
            console.log('✏️ Database patched: added missing primary_sub_stack column.');
        } catch (alterErr) {
            // Safe to ignore if column already exists
        }

        console.log('✅ MySQL Database Schema Verified: github_profiles table ready.');
    } catch (err) {
        console.error('❌ Database initialization failed:', err.message);
    }
};

initDatabase();

module.exports = db;