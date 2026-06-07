const express = require('express');
const axios = require('axios');
const db = require('./db'); 
const cors = require('cors');
const path = require('path');

const app = express();

// Enable wide open CORS policies for routing transitions
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Helper function to build headers dynamically without hard crashing if token is missing
function getGithubHeaders() {
    const headers = {
        'User-Agent': 'Nodejs-Intern-Assignment',
        'Accept': 'application/vnd.github.v3+json'
    };
    if (process.env.GITHUB_TOKEN) {
        headers['Authorization'] = `token ${process.env.GITHUB_TOKEN.trim()}`;
    }
    return { headers };
}

// 1. POST: Profile Metrics Aggregation Engine
app.post('/api/profiles/:username', async (req, requireRes) => {
    const username = req.params.username.toLowerCase().trim();

    try {
        let existing = [];
        if (process.env.DATABASE_URL) {
            try {
                const existingResult = await db.execute('SELECT * FROM github_profiles WHERE username = $1', [username]);
                existing = existingResult.rows || [];
            } catch (dbErr) {
                console.error("⚠️ Local DB Read warning:", dbErr.message);
            }
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
                        recommendations: ["Optimize stack configurations and scale cloud workflows architecture."]
                    }
                });
            }
        }

        // Live API Execution Calls
        const config = getGithubHeaders();
        const profileRes = await axios.get(`https://api.github.com/users/${username}`, config);
        const profile = profileRes.data;

        const reposRes = await axios.get(`https://api.github.com/users/${username}/repos?per_page=100`, config);
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

        let userType = "Casual Developer";
        if (publicRepos > 50 && followers > 5000) {
            userType = "Open Source Legend";
        } else if (publicRepos > 20) {
            userType = "Active Creator";
        } else if (publicRepos <= 20 && followers > 1000) {
            userType = "Influential Developer";
        } else if (publicRepos >= 1 && publicRepos <= 5) {
            userType = "Getting Started";
        } else if (publicRepos === 0) {
            userType = "Passive Lurker";
        }

        // Safe DB Upsert Action Blocks
        if (process.env.DATABASE_URL) {
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
                recommendations: ["Build production software apps showcasing stack capabilities."]
            }
        });
    } catch (error) {
        console.error("❌ API Core Exception Handler Output:", error.message);
        const codeErr = error.response ? error.response.status : 500;
        return requireRes.status(codeErr).json({ 
            error: "Ingestion Engine Failure", 
            details: error.response && error.response.data ? JSON.stringify(error.response.data) : error.message 
        });
    }
});

// 2. GET: Unified Profiles Query Index
app.get('/api/profiles', async (req, res) => {
    try {
        if (!process.env.DATABASE_URL) {
            return res.status(200).json({ profiles: [], warning: "DATABASE_URL variable environment missing entirely." });
        }

        let query = 'SELECT * FROM github_profiles ORDER BY id DESC';
        let rows = [];
        
        try {
            const dbResult = await db.query(query);
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
            user_type: p.user_type || "Passive Lurker"
        }));

        return res.status(200).json({ profiles: formattedProfiles });
    } catch (err) {
        return res.status(500).json({ error: "System failed processing historical matrix listings." });
    }
});

// 3. Static File Server Handler for Railway Containers
// Serves index.html directly from your root directory
app.use(express.static(path.join(__dirname, './')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, './index.html'));
});

// 4. Live Server Port Orchestrator
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Continuous architecture engine live on port ${PORT}`);
});