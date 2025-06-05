-- Create chats table
CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL DEFAULT 'Nova Conversa',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);

-- Enable Row Level Security
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view and edit their own chats
CREATE POLICY user_chats_access ON chats 
    FOR ALL 
    USING (user_id = auth.uid()::integer)
    WITH CHECK (user_id = auth.uid()::integer);

-- Policy: Admins can view all chats
CREATE POLICY admin_view_all_chats ON chats 
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id::text = auth.uid()::text 
            AND users.nivel = 'admin'
        )
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_chats_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update the updated_at column
CREATE TRIGGER update_chats_updated_at
    BEFORE UPDATE ON chats
    FOR EACH ROW
    EXECUTE PROCEDURE update_chats_updated_at_column();

-- Comment on table and columns
COMMENT ON TABLE chats IS 'Tabela de conversas/chats dos usuários';
COMMENT ON COLUMN chats.id IS 'ID único do chat (UUID)';
COMMENT ON COLUMN chats.user_id IS 'ID do usuário dono do chat (referência à tabela users)';
COMMENT ON COLUMN chats.title IS 'Título da conversa';
COMMENT ON COLUMN chats.created_at IS 'Data de criação do chat';
COMMENT ON COLUMN chats.updated_at IS 'Data da última atualização do chat';
