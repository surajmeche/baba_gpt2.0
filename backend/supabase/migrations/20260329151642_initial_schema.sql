-- Supabase Database Schema for Baba GPT
-- This schema supports chat conversations with messages containing text and images

-- Create chats table
CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index on chats.user_id for efficient user queries
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'bot')),
    content JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index on messages.chat_id for efficient message retrieval
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);

-- Comments for documentation
COMMENT ON TABLE chats IS 'Stores chat conversation metadata';
COMMENT ON TABLE messages IS 'Stores individual messages within chats';
COMMENT ON COLUMN messages.content IS 'JSONB object containing text (string) and images (array of base64 strings)';
COMMENT ON COLUMN messages.role IS 'Message sender type: user or bot';

-- Enable Row Level Security on chats table
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

-- Enable Row Level Security on messages table
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CHATS TABLE RLS POLICIES
-- ============================================

-- Policy: Users can view their own chats
CREATE POLICY "Users can view own chats"
ON chats FOR SELECT
USING (user_id = current_setting('app.user_id', true));

-- Policy: Users can create chats with their user_id
CREATE POLICY "Users can create own chats"
ON chats FOR INSERT
WITH CHECK (user_id = current_setting('app.user_id', true));

-- Policy: Users can update their own chats
CREATE POLICY "Users can update own chats"
ON chats FOR UPDATE
USING (user_id = current_setting('app.user_id', true));

-- Policy: Users can delete their own chats
CREATE POLICY "Users can delete own chats"
ON chats FOR DELETE
USING (user_id = current_setting('app.user_id', true));

-- ============================================
-- MESSAGES TABLE RLS POLICIES
-- ============================================

-- Policy: Users can view messages in their chats
CREATE POLICY "Users can view messages in own chats"
ON messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM chats
        WHERE chats.id = messages.chat_id
        AND chats.user_id = current_setting('app.user_id', true)
    )
);

-- Policy: Users can create messages in their chats
CREATE POLICY "Users can create messages in own chats"
ON messages FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM chats
        WHERE chats.id = messages.chat_id
        AND chats.user_id = current_setting('app.user_id', true)
    )
);

-- Policy: Users can delete messages in their chats
CREATE POLICY "Users can delete messages in own chats"
ON messages FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM chats
        WHERE chats.id = messages.chat_id
        AND chats.user_id = current_setting('app.user_id', true)
    )
);
