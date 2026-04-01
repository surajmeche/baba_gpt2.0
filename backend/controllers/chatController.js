// controllers/chatController.js
const supabase = require('../config/supabaseClient');

/**
 * Create a new chat
 * POST /api/chats
 */
const createChat = async (req, res, next) => {
    try {
        const { title } = req.body;
        const user_id = req.user.id; // From auth middleware

        // Validate required fields
        if (!title) {
            return res.status(400).json({
                error: {
                    message: 'Missing required field: title is required',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Insert chat into database
        const { data, error } = await supabase
            .from('chats')
            .insert([{ user_id, title }])
            .select()
            .single();

        if (error) {
            throw error;
        }

        // Return created chat with 201 status
        res.status(201).json({ data });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all chats for authenticated user
 * GET /api/chats
 */
const getChats = async (req, res, next) => {
    try {
        const user_id = req.user.id; // From auth middleware

        // Retrieve all chats for user ordered by updated_at DESC
        const { data, error } = await supabase
            .from('chats')
            .select('*')
            .eq('user_id', user_id)
            .order('updated_at', { ascending: false });

        if (error) {
            throw error;
        }

        // Return chats with 200 status
        res.status(200).json({ data });
    } catch (error) {
        next(error);
    }
};

/**
 * Get a specific chat with all messages
 * GET /api/chats/:chatId
 */
const getChat = async (req, res, next) => {
    try {
        const { chatId } = req.params;
        const user_id = req.user.id; // From auth middleware

        // Retrieve chat metadata
        const { data: chat, error: chatError } = await supabase
            .from('chats')
            .select('*')
            .eq('id', chatId)
            .eq('user_id', user_id)
            .single();

        if (chatError) {
            if (chatError.code === 'PGRST116') {
                // No rows returned - chat not found
                return res.status(404).json({
                    error: {
                        message: 'Chat not found',
                        timestamp: new Date().toISOString()
                    }
                });
            }
            throw chatError;
        }

        // Retrieve all messages for the chat ordered by created_at ASC
        const { data: messages, error: messagesError } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_id', chatId)
            .order('created_at', { ascending: true });

        if (messagesError) {
            throw messagesError;
        }

        // Return chat with messages in the specified format
        res.status(200).json({
            data: {
                chat,
                messages
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update chat title
 * PUT /api/chats/:chatId
 */
const updateChat = async (req, res, next) => {
    try {
        const { chatId } = req.params;
        const { title } = req.body;
        const user_id = req.user.id; // From auth middleware

        // Validate required fields
        if (!title) {
            return res.status(400).json({
                error: {
                    message: 'Missing required field: title is required',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Update chat title and updated_at timestamp
        const { data, error } = await supabase
            .from('chats')
            .update({ 
                title, 
                updated_at: new Date().toISOString() 
            })
            .eq('id', chatId)
            .eq('user_id', user_id)
            .select()
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // No rows returned - chat not found
                return res.status(404).json({
                    error: {
                        message: 'Chat not found',
                        timestamp: new Date().toISOString()
                    }
                });
            }
            throw error;
        }

        // Return updated chat with 200 status
        res.status(200).json({ data });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete a chat and all associated messages
 * DELETE /api/chats/:chatId
 */
const deleteChat = async (req, res, next) => {
    try {
        const { chatId } = req.params;
        const user_id = req.user.id; // From auth middleware

        // Delete chat (messages cascade automatically due to ON DELETE CASCADE)
        const { data, error } = await supabase
            .from('chats')
            .delete()
            .eq('id', chatId)
            .eq('user_id', user_id)
            .select();

        if (error) {
            throw error;
        }

        // Check if any rows were deleted
        if (!data || data.length === 0) {
            return res.status(404).json({
                error: {
                    message: 'Chat not found',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Return 204 No Content on successful deletion
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

/**
 * Migrate localStorage data to database
 * POST /api/chats/migrate
 */
const migrateChats = async (req, res, next) => {
    try {
        const { chats } = req.body;
        const user_id = req.user.id; // From auth middleware

        if (!chats || !Array.isArray(chats)) {
            return res.status(400).json({
                error: {
                    message: 'Invalid data format: chats must be an array',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Validate chat structure
        for (let i = 0; i < chats.length; i++) {
            const chat = chats[i];
            if (!chat.id || !chat.title) {
                return res.status(400).json({
                    error: {
                        message: `Invalid chat structure at index ${i}: id and title are required`,
                        timestamp: new Date().toISOString()
                    }
                });
            }
            if (!chat.messages || !Array.isArray(chat.messages)) {
                return res.status(400).json({
                    error: {
                        message: `Invalid chat structure at index ${i}: messages must be an array`,
                        timestamp: new Date().toISOString()
                    }
                });
            }
        }

        let migratedChats = 0;
        let migratedMessages = 0;

        // Process each chat sequentially
        for (const chat of chats) {
            try {
                // Prepare chat data with preserved ID and timestamps
                const chatData = {
                    id: chat.id,
                    user_id: user_id,
                    title: chat.title,
                    created_at: chat.created_at || new Date().toISOString(),
                    updated_at: chat.updated_at || new Date().toISOString()
                };

                // Insert chat
                const { data: insertedChat, error: chatError } = await supabase
                    .from('chats')
                    .insert([chatData])
                    .select()
                    .single();

                if (chatError) {
                    throw new Error(`Failed to insert chat ${chat.id}: ${chatError.message}`);
                }

                migratedChats++;

                // Insert messages for this chat
                if (chat.messages && chat.messages.length > 0) {
                    const messagesData = chat.messages.map(msg => ({
                        chat_id: chat.id,
                        role: msg.role,
                        content: typeof msg.content === 'string' 
                            ? { text: msg.content }
                            : { text: msg.content.text || '' },
                        created_at: msg.timestamp || msg.created_at || new Date().toISOString()
                    }));

                    const { data: insertedMessages, error: messagesError } = await supabase
                        .from('messages')
                        .insert(messagesData)
                        .select();

                    if (messagesError) {
                        throw new Error(`Failed to insert messages for chat ${chat.id}: ${messagesError.message}`);
                    }

                    migratedMessages += insertedMessages.length;
                }
            } catch (chatMigrationError) {
                console.error('Migration error:', chatMigrationError);
                return res.status(500).json({
                    error: {
                        message: `Migration failed: ${chatMigrationError.message}`,
                        timestamp: new Date().toISOString()
                    }
                });
            }
        }

        // Return migration summary
        res.status(201).json({
            data: {
                migrated_chats: migratedChats,
                migrated_messages: migratedMessages
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createChat,
    getChats,
    getChat,
    updateChat,
    deleteChat,
    migrateChats
};
