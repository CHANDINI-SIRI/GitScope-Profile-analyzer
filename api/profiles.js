const axios = require('axios');
const db = require('./db');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    // Extract username safely from the mapped path
    const { username: rawUsername } = req.query;
    if (!rawUsername) {
        return res.status(400).json({ error: "Target parameter 'username' is missing." });
    }
    const username = rawUsername.toLowerCase().trim();

    const githubConfig = {
        headers: { 
            'User-Agent': 'Vercel-Serverless-Agent',
            'Accept': 'application/vnd.github.v3+json',
            ...(process.env.GITHUB_TOKEN && { 'Authorization': `token ${process.env.GITHUB_TOKEN.trim()}` })
        }
    };

    try {
        let existing = [];
        try {
            const existingResult = await db.execute('SELECT * FROM github_profiles WHERE username = $1', [username]);
            existing = existingResult.rows || [];
        } catch (dbErr) {
            console.warn("⚠️ Local Cache Read Warning:", dbErr.message);
        }

        if (existing.length > 0) {
            const cachedProfile = existing[0];
            const lastAnalyzedTime = new Date(cachedProfile.analyzed_at || cachedProfile.looked_up_at || new Date());
            const hoursPassed = (new Date() - lastAnalyzedTime) / (1000 * 60 * 60);

            if (hoursPassed < 24) {
                return res.status(200).json({
                    message: "Retrieved from local database cache!",
                    insights: {
                        username: cachedProfile.username,
                        name: cachedProfile.name || cachedProfile.username,
                        public_repositories: cachedProfile.public_repos || 0,
                        followers: cachedProfile.followers || 0,
                        developer_archetype: cachedProfile.user_type || "Passive Lurker",
                        primary_language: cachedProfile.primary_language || "Unknown",
                        total_stars_accumulated: cachedProfile.total_stars || 0,
                        total_forks_accumulated: cachedProfile.total_forks || 0,
                        commitment_score: cachedProfile.commitment_score || 0,
                        avatar: cachedProfile.avatar_url,
                        career_insights: { 
                            strength: "High consistency code manager.", 
                            weakness: "Can improve dynamic portfolio visibility components." 
                        },
                        recommendations: ["Maintain active database tracking metrics clusters."]
                    }
                });
            }
        }

        // Pull Live GitHub Stream Telemetry
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
            if (repo.language) languageCounts[repo.language] = (languageCounts[repo.language] || 0) + 1;
            if (repo.pushed_at && new Date(repo.pushed_at) > oneMonthAgo) recentlyUpdatedCount++;
        });

        let primaryLang = 'Unknown';
        let maxCount = 0;
        for (const [lang, count] of Object.entries(languageCounts)) {
            if (count > maxCount) { maxCount = count; primaryLang = lang; }
        }

        const totalReposChecked = repos.length || 1;
        const commitmentScore = Math.round((recentlyUpdatedCount / totalReposChecked) * 100);
        const followers = profile.followers || 0;
        const following = profile.following || 1;
        const publicRepos = profile.public_repos || 0;
        const repoRatio = (followers / following).toFixed(2);

        let userType = "Casual Developer";
        if (publicRepos > 50 && followers > 5000) userType = "Open Source Legend";
        else if (publicRepos > 20) userType = "Active Creator";
        else if (publicRepos <= 20 && followers > 1000) userType = "Influential Developer";
        else if (publicRepos >= 1 && publicRepos <= 5) userType = "Getting Started";
        else if (publicRepos === 0) userType = "Passive Lurker";

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

        return res.status(201).json({
            message: "Metrics calculated completely!",
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
                career_insights: { 
                    strength: commitmentScore > 50 ? "High consistency contributor." : "Reliable vault structural manager.", 
                    weakness: "Review repository distribution footprints." 
                },
                recommendations: ["Build structured web tools showcasing language capabilities."]
            }
        });
    } catch (error) {
        console.error("❌ Profile processing crash:", error.message);
        return res.status(500).json({ error: "System integration engine failure.", details: error.message });
    }
};