const express = require('express');
const axios = require('axios');
const db = require('./db'); 
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

function getGithubHeaders() {
    const headers = {
        'User-Agent': 'Nodejs-Assignment',
        'Accept': 'application/vnd.github.v3+json'
    };
    if (process.env.GITHUB_TOKEN) {
        headers['Authorization'] = `token ${process.env.GITHUB_TOKEN.trim()}`;
    }
    return { headers };
}

// 1. POST: Profile Processing Engine
app.post('/api/profiles/:username', async (req, res) => {
    const username = req.params.username.toLowerCase().trim();

    try {
        let existing = [];
        if (process.env.DATABASE_URL) {
            const existingResult = await db.execute('SELECT * FROM github_profiles WHERE username = $1', [username]);
            existing = existingResult.rows || [];
        }
        
        if (existing.length > 0) {
            const cached = existing[0];
            return res.status(200).json({
                insights: {
                    username: cached.username,
                    name: cached.name || cached.username,
                    public_repositories: cached.public_repos || 0,
                    followers: cached.followers || 0,
                    developer_archetype: cached.user_type || "Casual Developer",
                    primary_language: cached.primary_language || "Unknown",
                    total_stars_accumulated: cached.total_stars || 0,
                    commitment_score: cached.commitment_score || 0,
                    avatar: cached.avatar_url,
                    career_insights: { 
                        strength: "Retrieved from local database cache system safely.", 
                        weakness: "Data synced directly from persistent schema layers." 
                    },
                    recommendations: ["Maintain current production repository structures."]
                }
            });
        }

        // Live API Calls
        const config = getGithubHeaders();
        const profileRes = await axios.get(`https://api.github.com/users/${username}`, config);
        const profile = profileRes.data;

        const reposRes = await axios.get(`https://api.github.com/users/${username}/repos?per_page=100`, config);
        const repos = Array.isArray(reposRes.data) ? reposRes.data : [];

        let totalStars = 0;
        let langCounts = {};
        repos.forEach(r => {
            totalStars += r.stargazers_count || 0;
            if (r.language) langCounts[r.language] = (langCounts[r.language] || 0) + 1;
        });

        let primaryLang = 'Unknown';
        let max = 0;
        for (const [l, c] of Object.entries(langCounts)) {
            if (c > max) { max = c; primaryLang = l; }
        }

        const publicRepos = profile.public_repos || 0;
        const followers = profile.followers || 0;
        let userType = publicRepos > 20 ? "Active Creator" : "Casual Developer";
        if (publicRepos === 0) userType = "Passive Lurker";

        if (process.env.DATABASE_URL) {
            await db.execute(
                `INSERT INTO github_profiles (username, name, bio, public_repos, followers, following, avatar_url, profile_url, user_type, total_stars, primary_language, commitment_score) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                 ON CONFLICT (username) DO UPDATE SET public_repos = EXCLUDED.public_repos, followers = EXCLUDED.followers, total_stars = EXCLUDED.total_stars`,
                [username, profile.name || null, profile.bio || null, publicRepos, followers, profile.following || 0, profile.avatar_url, profile.html_url, userType, totalStars, primaryLang, 75]
            );
        }

        return res.status(201).json({
            insights: {
                username,
                name: profile.name || username,
                public_repositories: publicRepos,
                followers: followers,
                developer_archetype: userType,
                primary_language: primaryLang,
                total_stars_accumulated: totalStars,
                commitment_score: 75,
                avatar: profile.avatar_url,
                career_insights: { 
                    strength: "Strong portfolio architecture with steady distribution layouts.", 
                    weakness: "Expand public documentation indexes to improve visibility." 
                },
                recommendations: ["Deploy advanced test profiles against the application stack layout."]
            }
        });
    } catch (error) {
        return res.status(500).json({ error: "Ingestion Engine Failure", details: error.message });
    }
});

// 2. GET: Matrix Data Source Fetch
app.get('/api/profiles', async (req, res) => {
    try {
        if (!process.env.DATABASE_URL) return res.status(200).json({ profiles: [] });
        const result = await db.query('SELECT * FROM github_profiles ORDER BY id DESC');
        
        const profiles = (result.rows || []).map(p => ({
            username: p.username,
            public_repos: p.public_repos || 0,
            primary_language: p.primary_language || "N/A",
            followers: p.followers || 0,
            user_type: p.user_type || "Passive Lurker"
        }));
        return res.status(200).json({ profiles });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Static Assets Serving
app.use(express.static(path.join(__dirname, './')));

// FIX: Pass a native JavaScript Regular Expression literal to bypass string string-parsing constraints entirely
app.get(/^(?!\/api).*$/, (req, res) => {
    res.sendFile(path.join(__dirname, './index.html'));
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running smoothly on port ${PORT}`));