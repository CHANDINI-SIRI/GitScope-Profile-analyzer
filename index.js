const express = require('express');
const axios = require('axios');
const db = require('./db'); 
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// API Consumer Protection Rules
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100, // Increased to ensure you don't block yourself during testing
    message: {
        error: "Too many requests from this IP.",
        details: "Rate limit exceeded. Please wait 15 minutes."
    },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/', apiLimiter);

const PORT = process.env.PORT || 5000;

// ====================================================================
// 1. POST: Deep Metric Profile Analysis Engine
// ====================================================================
app.post('/api/profiles/:username', async (req, requireRes) => {
    const username = req.params.username.toLowerCase();

    try {
        const [existing] = await db.execute('SELECT * FROM github_profiles WHERE username = ?', [username]);
        
        if (existing.length > 0) {
            const cachedProfile = existing[0];
            const lastAnalyzedTime = new Date(cachedProfile.analyzed_at || cachedProfile.looked_up_at);
            const currentTime = new Date();
            const hoursPassed = (currentTime - lastAnalyzedTime) / (1000 * 60 * 60);
            const CACHE_EXPIRATION_HOURS = 24; 

            if (hoursPassed < CACHE_EXPIRATION_HOURS) {
                return requireRes.status(200).json({
                    message: "Profile retrieved from fresh local database cache!",
                    cache_age_hours: hoursPassed.toFixed(2),
                    insights: {
                        username: cachedProfile.username,
                        name: cachedProfile.name,
                        public_repositories: cachedProfile.public_repos,
                        followers: cachedProfile.followers,
                        developer_archetype: cachedProfile.user_type,
                        primary_language: cachedProfile.primary_language,
                        total_stars_accumulated: cachedProfile.total_stars,
                        total_forks_accumulated: cachedProfile.total_forks,
                        commitment_score: cachedProfile.commitment_score,
                        avatar: cachedProfile.avatar_url,
                        career_insights: { 
                            strength: cachedProfile.commitment_score > 50 ? "High consistency." : "Strong structural setup.", 
                            weakness: "Documentation focus." 
                        },
                        recommendations: ["Continue building optimized full-stack infrastructure."]
                    }
                });
            }
        }

        // Fetch Live GitHub Metrics
        const profileRes = await axios.get(`https://api.github.com/users/${username}`, {
            headers: { 'User-Agent': 'Nodejs-Intern-Assignment' }
        });
        const profile = profileRes.data;

        const reposRes = await axios.get(`https://api.github.com/users/${username}/repos?per_page=100`, {
            headers: { 'User-Agent': 'Nodejs-Intern-Assignment' }
        });
        const repos = reposRes.data;

        let totalStars = 0;
        let totalForks = 0;
        let languageCounts = {};
        let recentlyUpdatedCount = 0;
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        repos.forEach(repo => {
            totalStars += repo.stargazers_count || 0;
            totalForks += repo.forks_count || 0;
            if (repo.language) {
                languageCounts[repo.language] = (languageCounts[repo.language] || 0) + 1;
            }
            if (repo.pushed_at && new Date(repo.pushed_at) > oneMonthAgo) {
                recentlyUpdatedCount++;
            }
        });

        let primaryLang = 'Unknown';
        let maxCount = 0;
        for (const [lang, count] of Object.entries(languageCounts)) {
            if (count > maxCount) {
                maxCount = count;
                primaryLang = lang;
            }
        }

        const totalReposChecked = repos.length || 1;
        const commitmentScore = Math.round((recentlyUpdatedCount / totalReposChecked) * 100);
        const followers = profile.followers || 0;
        const following = profile.following || 1;
        const publicRepos = profile.public_repos || 0;
        const repoRatio = (followers / following).toFixed(2);

        // Archetype Assignment
        let userType = "Passive Lurker";
        if (publicRepos > 50 && followers > 5000) {
            userType = "Open Source Legend";
        } else if (publicRepos > 20) {
            userType = "Active Creator";
        } else if (publicRepos <= 20 && followers > 1000) {
            userType = "Influential Developer";
        } else if (publicRepos >= 6 && publicRepos <= 20) {
            userType = "Casual Developer";
        } else if (publicRepos >= 1 && publicRepos <= 5) {
            userType = "Getting Started";
        }

        // Database Persistence (Upsert)
        if (existing.length > 0) {
            const updateQuery = `
                UPDATE github_profiles 
                SET name = ?, bio = ?, public_repos = ?, followers = ?, following = ?, 
                    avatar_url = ?, profile_url = ?, calculated_repo_ratio = ?, user_type = ?, 
                    total_stars = ?, total_forks = ?, primary_language = ?, commitment_score = ?, analyzed_at = CURRENT_TIMESTAMP
                WHERE username = ?
            `;
            await db.execute(updateQuery, [
                profile.name || null, profile.bio || null, publicRepos, followers, following,
                profile.avatar_url, profile.html_url, repoRatio, userType,
                totalStars, totalForks, primaryLang, commitmentScore, username
            ]);
        } else {
            const insertQuery = `
                INSERT INTO github_profiles 
                (username, name, bio, public_repos, followers, following, avatar_url, profile_url, calculated_repo_ratio, user_type, total_stars, total_forks, primary_language, commitment_score) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            await db.execute(insertQuery, [
                username, profile.name || null, profile.bio || null, publicRepos, followers, following,
                profile.avatar_url, profile.html_url, repoRatio, userType, totalStars, totalForks, primaryLang, commitmentScore
            ]);
        }

        // Recommendations Builder
        let recommendations = ["Build full-stack applications showcasing repository strengths."];
        if (primaryLang === 'JavaScript' || primaryLang === 'TypeScript') {
            recommendations = ["Build a high-performance Next.js full-stack application utilizing server actions."];
        } else if (primaryLang === 'Python') {
            recommendations = ["Develop a custom REST API using FastAPI and back it with PostgreSQL."];
        }

        const strength = commitmentScore > 50 ? "High consistency." : "Strong structural setup.";
        const weakness = "Documentation focus.";

        return requireRes.status(201).json({
            message: "Profile metrics computed and synchronized successfully!",
            insights: {
                username: username,
                name: profile.name,
                public_repositories: publicRepos,
                followers: followers,
                developer_archetype: userType,
                primary_language: primaryLang,
                total_stars_accumulated: totalStars,
                total_forks_accumulated: totalForks,
                commitment_score: commitmentScore,
                avatar: profile.avatar_url,
                career_insights: { strength, weakness },
                recommendations: recommendations
            }
        });
    } catch (error) {
        console.error("❌ Error:", error.message);
        return requireRes.status(500).json({ error: "Internal Server Error" });
    }
});

// ====================================================================
// UPDATED GET: Unified Local + Live Global Discovery Search Engine
// ====================================================================
app.get('/api/profiles', async (req, res) => {
    try {
        const { archetype, sortBy, globalDiscover } = req.query;

        // Unified live network query string compiler 
        if (globalDiscover === 'true') {
            console.log(`🌐 Scraping Global Network Pipeline parameters: ${archetype || 'All'}`);
            
            let githubQuery = 'followers:>=10'; // Default base query if 'All Archetypes' selected
            let targetArchetype = archetype || "Active Creator"; 

            if (archetype === 'Open Source Legend') githubQuery = 'repos:>50 followers:>5000';
            else if (archetype === 'Active Creator') githubQuery = 'repos:>20';
            else if (archetype === 'Influential Developer') githubQuery = 'followers:>1000';
            else if (archetype === 'Casual Developer') githubQuery = 'repos:6..20';
            else if (archetype === 'Getting Started') githubQuery = 'repos:1..5';
            else if (archetype === 'Passive Lurker') githubQuery = 'repos:0';

            try {
                const searchRes = await axios.get(`https://api.github.com/search/users?q=${encodeURIComponent(githubQuery)}&per_page=15`, {
                    headers: { 'User-Agent': 'Nodejs-Profile-Analyzer' }
                });

                const globalProfiles = searchRes.data.items.map(item => ({
                    username: item.login,
                    public_repos: 'Live',
                    primary_language: 'GitHub API Network',
                    followers: 'Global Sync',
                    user_type: targetArchetype,
                    source: "Live GitHub Network"
                }));

                return res.status(200).json({ profiles: globalProfiles });
            } catch (apiErr) {
                console.error("GitHub Global Search Failed/Rate-Limited:", apiErr.message);
                // Fail gracefully down to local database query if GitHub hits rate limits
            }
        }

        // --- Fallback Safe Local Database Pipeline Execution ---
        let query = 'SELECT * FROM github_profiles';
        let queryParams = [];

        if (archetype) {
            query += ' WHERE user_type = ? OR developer_archetype = ?';
            queryParams.push(archetype, archetype);
        }

        switch (sortBy) {
            case 'followers': query += ' ORDER BY followers DESC'; break;
            case 'repos': query += ' ORDER BY public_repos DESC'; break;
            case 'stars': query += ' ORDER BY total_stars DESC'; break;
            case 'commitment': query += ' ORDER BY commitment_score DESC'; break;
            default: query += ' ORDER BY id DESC'; break;
        }

        const [rows] = await db.query(query, queryParams);

        const formattedProfiles = rows.map(p => ({
            username: p.username,
            public_repos: p.public_repos !== undefined ? p.public_repos : 0,
            primary_language: p.primary_language || "N/A",
            followers: p.followers !== undefined ? p.followers : 0,
            user_type: p.user_type || p.developer_archetype || "Passive Lurker",
            source: "Local Database"
        }));

        return res.status(200).json({ profiles: formattedProfiles });
    } catch (err) {
        console.error("Data Matrix Aggregation Ingestion Fault:", err);
        return res.status(500).json({ error: "System failed processing historical matrix listings." });
    }
});

// ====================================================================
// 3. Fallback Route & Port Listener (Clean & Balanced Termination)
// ====================================================================

// Point Express to serve static frontend asset files
app.use(express.static(__dirname));

// Directly routing the home route to point to your UI
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Primary Server Listener
app.listen(PORT, () => {
    console.log(`🚀 Premium Analytics Server active on port ${PORT}`);
});