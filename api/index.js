const express = require('express');
const axios = require('axios');
const db = require('./db'); 
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// ====================================================================
// CORS Configuration (Allows seamless cross-origin requests)
// ====================================================================
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// ====================================================================
// API Consumer Protection Rules
// ====================================================================
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 300, 
    message: {
        error: "Too many requests from this IP address.",
        details: "Rate limit threshold breached. Please wait 15 minutes."
    },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api', apiLimiter);

const PORT = process.env.PORT || 5000;

const githubConfig = {
    headers: { 
        'User-Agent': 'Nodejs-Intern-Assignment',
        ...(process.env.GITHUB_TOKEN && { 'Authorization': `token ${process.env.GITHUB_TOKEN}` })
    }
};

// ====================================================================
// 1. POST: Deep Metric Profile Analysis Engine
// ====================================================================
app.post('/api/profiles/:username', async (req, requireRes) => {
    const username = req.params.username.toLowerCase();

    try {
        let existing = [];
        try {
            const existingResult = await db.execute('SELECT * FROM github_profiles WHERE username = $1', [username]);
            existing = existingResult.rows || [];
        } catch (dbErr) {
            console.error("⚠️ Local DB Read warning (Proceeding to live fetch):", dbErr.message);
        }
        
        if (existing.length > 0) {
            const cachedProfile = existing[0];
            const lastAnalyzedTime = new Date(cachedProfile.analyzed_at || cachedProfile.looked_up_at || new Date());
            const currentTime = new Date();
            const hoursPassed = (currentTime - lastAnalyzedTime) / (1000 * 60 * 60);
            const CACHE_EXPIRATION_HOURS = 24; 

            if (hoursPassed < CACHE_EXPIRATION_HOURS) {
                const pRepos = cachedProfile.public_repos !== undefined ? cachedProfile.public_repos : 0;
                const uType = cachedProfile.user_type || "Passive Lurker";
                const cScore = cachedProfile.commitment_score !== undefined ? cachedProfile.commitment_score : 0;

                return requireRes.status(200).json({
                    message: "Profile retrieved from fresh local database cache!",
                    cache_age_hours: hoursPassed.toFixed(2),
                    insights: {
                        username: cachedProfile.username,
                        name: cachedProfile.name || cachedProfile.username,
                        public_repositories: pRepos,
                        followers: cachedProfile.followers || 0,
                        developer_archetype: uType,
                        primary_language: cachedProfile.primary_language || "Unknown",
                        total_stars_accumulated: cachedProfile.total_stars || 0,
                        total_forks_accumulated: cachedProfile.total_forks || 0,
                        commitment_score: cScore,
                        avatar: cachedProfile.avatar_url,
                        career_insights: { 
                            strength: cScore > 50 ? "High consistency. The target actively maintains code and pushes changes regularly." : "Strong structural setup. The target acts as a reliable repository vault manager.", 
                            weakness: pRepos < 10 ? "Low repository footprint. Consider publishing more proof-of-work project folders publically." : "Documentation focus. Target can improve project reach by generating better README layouts." 
                        },
                        recommendations: cachedProfile.primary_language === 'JavaScript' || cachedProfile.primary_language === 'TypeScript' 
                            ? ["Build a high-performance Next.js full-stack application utilizing server actions.", "Design a real-time collaborative whiteboard using WebSockets."]
                            : ["Develop a custom REST API using FastAPI and back it with PostgreSQL."]
                    }
                });
            }
        }

        // Fetch Live GitHub Metrics
        const profileRes = await axios.get(`https://api.github.com/users/${username}`, githubConfig);
        const profile = profileRes.data;

        const reposRes = await axios.get(`https://api.github.com/users/${username}/repos?per_page=100`, githubConfig);
        const repos = Array.isArray(reposRes.data) ? reposRes.data : [];

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

        // Database Upsert Mechanics
        try {
            if (existing.length > 0) {
                const updateQuery = `
                    UPDATE github_profiles 
                    SET name = $1, bio = $2, public_repos = $3, followers = $4, following = $5, 
                        avatar_url = $6, profile_url = $7, calculated_repo_ratio = $8, user_type = $9, 
                        total_stars = $10, total_forks = $11, primary_language = $12, commitment_score = $13, analyzed_at = CURRENT_TIMESTAMP
                    WHERE username = $14
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
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                `;
                await db.execute(insertQuery, [
                    username, profile.name || null, profile.bio || null, publicRepos, followers, following,
                    profile.avatar_url, profile.html_url, repoRatio, userType, totalStars, totalForks, primaryLang, commitmentScore
                ]);
            }
        } catch (saveErr) {
            console.error("❌ Database Write Failure:", saveErr.message);
        }

        let recommendations = ["Build full-stack applications showcasing repository strengths."];
        if (primaryLang === 'JavaScript' || primaryLang === 'TypeScript') {
            recommendations = [
                "Build a high-performance Next.js full-stack application utilizing server actions.",
                "Design a real-time collaborative whiteboard using WebSockets and Socket.io.",
                "Create a custom lightweight state management library from scratch."
            ];
        } else if (primaryLang === 'Python') {
            recommendations = [
                "Develop a custom REST API using FastAPI and back it with PostgreSQL.",
                "Build an automated web scraping pipeline with BeautifulSoup and Celery orchestration.",
                "Train and deploy a fine-tuned text classification model using Hugging Face."
            ];
        }

        const strength = commitmentScore > 50 ? "High consistency. The target actively maintains code and pushes changes regularly." : "Strong structural setup. The target acts as a reliable repository vault manager.";
        const weakness = publicRepos < 10 ? "Low repository footprint. Consider publishing more proof-of-work project folders publically." : "Documentation focus. Target can improve project reach by generating better README layouts.";

        return requireRes.status(201).json({
            message: "Profile metrics computed and synchronized successfully!",
            insights: {
                username: username,
                name: profile.name || username,
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
        console.error("❌ Diagnostic Profiler Error:", error.message);
        const codeErr = error.response ? error.response.status : 500;
        return requireRes.status(codeErr).json({ 
            error: "Ingestion Engine Failure", 
            details: error.message 
        });
    }
});

// ====================================================================
// 2. GET: Unified Local + Live Global Discovery Search Engine
// ====================================================================
app.get('/api/profiles', async (req, res) => {
    try {
        const { archetype, sortBy, globalDiscover } = req.query;

        if (globalDiscover === 'true') {
            let githubQuery = 'followers:>=10'; 
            let targetArchetype = archetype || "Active Creator"; 

            if (archetype === 'Open Source Legend') githubQuery = 'repos:>50 followers:>5000';
            else if (archetype === 'Active Creator') githubQuery = 'repos:>20';
            else if (archetype === 'Influential Developer') githubQuery = 'followers:>1000';
            else if (archetype === 'Casual Developer') githubQuery = 'repos:6..20';
            else if (archetype === 'Getting Started') githubQuery = 'repos:1..5';
            else if (archetype === 'Passive Lurker') githubQuery = 'repos:0';

            try {
                const searchRes = await axios.get(`https://api.github.com/search/users?q=${encodeURIComponent(githubQuery)}&per_page=15`, githubConfig);
                const items = searchRes.data.items || [];

                const globalProfiles = items.map(item => ({
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
            }
        }

        let query = 'SELECT * FROM github_profiles';
        let queryParams = [];

        if (archetype) {
            query += ' WHERE user_type = $1';
            queryParams.push(archetype);
        }

        switch (sortBy) {
            case 'followers': query += ' ORDER BY followers DESC'; break;
            case 'repos': query += ' ORDER BY public_repos DESC'; break;
            case 'stars': query += ' ORDER BY total_stars DESC'; break;
            case 'commitment': query += ' ORDER BY commitment_score DESC'; break;
            default: query += ' ORDER BY id DESC'; break;
        }

        let rows = [];
        try {
            const dbResult = await db.query(query, queryParams);
            rows = dbResult.rows || [];
        } catch (dbErr) {
            console.error("❌ Matrix Database Fetch Error:", dbErr.message);
            return res.status(500).json({ error: "Database mapping layer disconnected.", details: dbErr.message });
        }

        const formattedProfiles = rows.map(p => ({
            username: p.username,
            public_repos: p.public_repos !== undefined ? p.public_repos : 0,
            primary_language: p.primary_language || "N/A",
            followers: p.followers !== undefined ? p.followers : 0,
            user_type: p.user_type || "Passive Lurker",
            source: "Local Database"
        }));

        return res.status(200).json({ profiles: formattedProfiles });
    } catch (err) {
        console.error("Data Matrix Aggregation Ingestion Fault:", err);
        return res.status(500).json({ error: "System failed processing historical matrix listings." });
    }
});

// Serve frontend UI static files directly from root directory
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.listen(PORT, () => {
    console.log(`🚀 Premium Analytics Server active on port ${PORT}`);
});