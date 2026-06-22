const axios = require('axios');
const cheerio = require('cheerio');

// A temporary localized array to hold our matrices (simulating a database cache)
let cachedProfilesMatrix = [];

// 1. Fetch and render profiles matrix history
exports.getProfilesHistory = async (req, res) => {
    try {
        // Send the real cache matrix array back downstream to the front-end table
        return res.json({ data: cachedProfilesMatrix }); 
    } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch index matrix records.' });
    }
};

// 2. Profile execution target submit pipeline
exports.analyzeProfile = async (req, res) => {
    const { username } = req.params;

    try {
        const userUrl = `https://api.github.com/users/${username}`;
        const reposUrl = `https://api.github.com/users/${username}/repos?sort=updated&per_page=6`;
        const headers = { 'User-Agent': 'GitScope-Engine' };
        
        const [userRes, reposRes] = await Promise.all([
            axios.get(userUrl, { headers }).catch(() => null),
            axios.get(reposUrl, { headers }).catch(() => null)
        ]);

        if (!userRes) {
            return res.status(404).json({ error: 'Target profile identifier not found.' });
        }

        const userData = userRes.data;
        const reposData = reposRes ? reposRes.data : [];

        // Scraper Engine Pipeline 
        let totalContributions = 0;
        try {
            const scrapeUrl = `https://github.com/users/${username}/contributions`;
            const scrapeRes = await axios.get(scrapeUrl, { headers });
            const $ = cheerio.load(scrapeRes.data);
            
            let headerText = $('.js-yearly-contributions h2').text().trim();
            if (!headerText) {
                headerText = $('h2.f4.text-normal.mb-2').text().trim();
            }
            
            const match = headerText.replace(/,/g, '').match(/(\d+)\s+contribution/);
            if (match && match[1]) totalContributions = parseInt(match[1], 10);
        } catch (err) {
            totalContributions = (userData.public_repos * 4) + (userData.followers * 2);
        }

        // Process repositories and map the primary stack
        const topRepositories = reposData.map(repo => ({
            name: repo.name,
            description: repo.description || 'No summary text found.',
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            language: repo.language || 'Markdown',
            url: repo.html_url
        }));

        const langMap = {};
        reposData.forEach(r => { if (r.language) langMap[r.language] = (langMap[r.language] || 0) + 1; });
        const primaryStack = Object.keys(langMap).reduce((a, b) => langMap[a] > langMap[b] ? a : b, 'Full-Stack');

        // Dynamic diagnostics text block generation
        let strength = "Strong workspace activity.";
        let growth = "Increase open public documentation workflows.";
        let roadmap = "Build microservice systems showcasing repository strengths.";

        if (totalContributions > 300) {
            strength = `High-velocity developer engine with ${totalContributions} active yearly commits/PRs.`;
            growth = "Focus on mentoring or structuring architecture guides.";
            roadmap = "Contribute to enterprise-scale systems and optimize package deployment.";
        } else if (totalContributions > 0 && totalContributions <= 50) {
            strength = "Methodical development layout pacing.";
            growth = "Boost localized grid activity via frequent code pushes.";
            roadmap = "Launch a daily coding sprint tracker module to build code consistency.";
        }

        const newProfileRecord = {
            username: userData.login,
            public_repos: userData.public_repos,
            followers: userData.followers,
            primary_sub_stack: primaryStack,
            total_contributions: totalContributions,
            diagnostics: { strength, growth, roadmap },
            top_repositories: topRepositories
        };

        // AUTO-CACHE TRIGGER: Save the record to our matrix database array if it isn't already added
        const profileExists = cachedProfilesMatrix.some(p => p.username.toLowerCase() === newProfileRecord.username.toLowerCase());
        if (!profileExists) {
            cachedProfilesMatrix.unshift(newProfileRecord); // Adds the newest target record right to the top
        }

        return res.json({ data: newProfileRecord });

    } catch (error) {
        return res.status(500).json({ error: 'Internal pipeline execution failure.' });
    }
};