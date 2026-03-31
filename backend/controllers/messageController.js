// controllers/messageController.js
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Create a new message in a chat
 * POST /api/messages
 */
const createMessage = async (req, res, next) => {
    try {
        const { chat_id, role, content } = req.body;
        const user_id = req.user.id; // From auth middleware

        // Validate required fields
        if (!chat_id || !role || !content) {
            return res.status(400).json({
                error: {
                    message: 'Missing required fields: chat_id, role, and content are required',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Validate role is 'user' or 'bot'
        if (role !== 'user' && role !== 'bot') {
            return res.status(400).json({
                error: {
                    message: 'Invalid role: must be "user" or "bot"',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Validate content structure
        if (typeof content !== 'object' || content === null) {
            return res.status(400).json({
                error: {
                    message: 'Invalid content: must be an object with text field',
                    timestamp: new Date().toISOString()
                }
            });
        }

        if (!content.hasOwnProperty('text')) {
            return res.status(400).json({
                error: {
                    message: 'Invalid content structure: must contain text field',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Verify chat exists and belongs to user
        const { data: chatExists, error: chatError } = await supabase
            .from('chats')
            .select('id')
            .eq('id', chat_id)
            .eq('user_id', user_id)
            .single();

        if (chatError || !chatExists) {
            return res.status(404).json({
                error: {
                    message: 'Chat not found or access denied',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Insert message into database
        const { data: message, error: messageError } = await supabase
            .from('messages')
            .insert([{ chat_id, role, content }])
            .select()
            .single();

        if (messageError) {
            throw messageError;
        }

        // Update parent chat's updated_at timestamp
        const { error: updateError } = await supabase
            .from('chats')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', chat_id);

        if (updateError) {
            throw updateError;
        }

        // Return created message with 201 status
        res.status(201).json({ data: message });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all messages for a chat
 * GET /api/messages
 */
const getMessages = async (req, res, next) => {
    try {
        const { chat_id } = req.query;
        const user_id = req.user.id; // From auth middleware

        // Validate required query parameter
        if (!chat_id) {
            return res.status(400).json({
                error: {
                    message: 'Missing required query parameter: chat_id',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Verify chat exists and belongs to user
        const { data: chatExists, error: chatError } = await supabase
            .from('chats')
            .select('id')
            .eq('id', chat_id)
            .eq('user_id', user_id)
            .single();

        if (chatError || !chatExists) {
            return res.status(404).json({
                error: {
                    message: 'Chat not found or access denied',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Retrieve all messages for the chat ordered by created_at ASC
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_id', chat_id)
            .order('created_at', { ascending: true });

        if (error) {
            throw error;
        }

        // Return messages with 200 status
        res.status(200).json({ data });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createMessage,
    getMessages
};
