DROP TABLE IF EXISTS github_profiles;

CREATE TABLE github_profiles (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(150),
    bio TEXT,
    public_repos INT DEFAULT 0,
    followers INT DEFAULT 0,
    following INT DEFAULT 0,
    avatar_url TEXT,
    profile_url TEXT,
    calculated_repo_ratio DECIMAL(10,2) DEFAULT 0.00,
    user_type VARCHAR(100) DEFAULT 'Casual Developer',
    total_stars INT DEFAULT 0,
    total_forks INT DEFAULT 0,
    primary_language VARCHAR(100) DEFAULT 'Unknown',
    commitment_score INT DEFAULT 0,
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_github_profiles_username ON github_profiles(username);