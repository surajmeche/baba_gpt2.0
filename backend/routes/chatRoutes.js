// routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authenticateUser } = require('../middleware/authMiddleware');

// All chat routes require authentication
router.use(authenticateUser);

/**
 * @route   POST /api/chats
 * @desc    Create a new chat
 * @access  Private
 */
router.post('/', chatController.createChat);

/**
 * @route   GET /api/chats
 * @desc    Get all chats for authenticated user
 * @access  Private
 */
router.get('/', chatController.getChats);

/**
 * @route   POST /api/chats/migrate
 * @desc    Migrate localStorage data to database
 * @access  Private
 */
router.post('/migrate', chatController.migrateChats);

/**
 * @route   GET /api/chats/:chatId
 * @desc    Get a specific chat with all messages
 * @access  Private
 */
router.get('/:chatId', chatController.getChat);

/**
 * @route   PUT /api/chats/:chatId
 * @desc    Update chat title
 * @access  Private
 */
router.put('/:chatId', chatController.updateChat);

/**
 * @route   DELETE /api/chats/:chatId
 * @desc    Delete a chat and all associated messages
 * @access  Private
 */
router.delete('/:chatId', chatController.deleteChat);

module.exports = router;
