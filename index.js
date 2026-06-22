const express = require('express');
const path = require('path');
const profileRoutes = require('./routes/profile'); // Imports your routes/profile.js

const app = express();

// 1. Parse JSON payloads first
app.use(express.json());

// 2. MOUNT YOUR API ROUTES BEFORE SERVING STATIC FILES
// This ensures /api/analyze and /api/profiles are intercepted by your controller
app.use('/api', profileRoutes);

// 3. Serve your static front-end assets (index.html, styles.css)
app.use(express.static(path.join(__dirname, 'public')));

// 4. OPTIONAL: If you have a single-page-app catch-all, it MUST be at the very bottom
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`GitScope Engine actively listening on port ${PORT}`);
});