// routes/geminiRoutes.js
const express = require('express');
const router = express.Router();
const geminiController = require('../controllers/geminiController');
const { authenticateUser } = require('../middleware/authMiddleware');

// All Gemini routes require authentication (prevents anonymous abuse)
router.use(authenticateUser);

/**
 * @route   POST /api/gemini/chat
 * @desc    Proxy chat request to Gemini API (API key stays server-side)
 * @access  Private (requires authentication)
 */
router.post('/chat', geminiController.chatProxy);

module.exports = router;
