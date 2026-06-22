const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile'); //

// 1. This handles the History Matrix Table on page load
// It connects the frontend "fetch('/api/profiles')" to your controller
router.get('/profiles', profileController.getProfilesHistory || ((req, res) => res.json({ data: [] })));

// 2. This handles the search bar when you click "Analyze Target"
router.post('/analyze/:username', profileController.analyzeProfile);

module.exports = router;