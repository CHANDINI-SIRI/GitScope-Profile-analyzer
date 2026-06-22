const db = require('./config/db');

async function createTable() {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS profiles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(255),
                bio TEXT,
                public_repos INT,
                followers INT,
                following INT,
                top_languages JSON,
                calculated_score INT
            )
        `);
        console.log("✅ Cloud Database Table created successfully!");
    } catch (error) {
        console.error("❌ Error creating table:", error.message);
    } process.exit();
}

createTable();