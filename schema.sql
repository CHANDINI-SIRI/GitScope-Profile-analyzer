CREATE DATABASE IF NOT EXISTS gitscope_db;
USE gitscope_db;

CREATE TABLE IF NOT EXISTS github_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    public_repos INT DEFAULT 0,
    followers INT DEFAULT 0,
    primary_language VARCHAR(100) DEFAULT 'N/A',
    user_type VARCHAR(100) DEFAULT 'Passive Lurker',
    total_stars INT DEFAULT 0,
    commitment_score INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);