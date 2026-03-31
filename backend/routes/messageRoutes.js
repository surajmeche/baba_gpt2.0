// routes/messageRoutes.js
const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authenticateUser } = require('../middleware/authMiddleware');

// All message routes require authentication
router.use(authenticateUser);

/**
 * @route   POST /api/messages
 * @desc    Create a new message in a chat
 * @access  Private
 */
router.post('/', messageController.createMessage);

/**
 * @route   GET /api/messages
 * @desc    Get all messages for a chat
 * @access  Private
 */
router.get('/', messageController.getMessages);

module.exports = router;
