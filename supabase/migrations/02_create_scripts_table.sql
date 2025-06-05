-- Create scripts table
CREATE TABLE IF NOT EXISTS scripts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    input TEXT NOT NULL,
    output TEXT,
    chatid UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_scripts_user_id ON scripts(user_id);

-- Create index on chatid for faster lookups
CREATE INDEX IF NOT EXISTS idx_scripts_chatid ON scripts(chatid);

-- Enable Row Level Security
ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view and edit their own scripts
CREATE POLICY user_scripts_access ON scripts 
    FOR ALL 
    USING (user_id = auth.uid()::integer)
    WITH CHECK (user_id = auth.uid()::integer);

-- Policy: Admins can view all scripts
CREATE POLICY admin_view_all_scripts ON scripts 
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id::text = auth.uid()::text 
            AND users.nivel = 'admin'
        )
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_scripts_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update the updated_at column
CREATE TRIGGER update_scripts_updated_at
    BEFORE UPDATE ON scripts
    FOR EACH ROW
    EXECUTE PROCEDURE update_scripts_updated_at_column();

-- Comment on table and columns
COMMENT ON TABLE scripts IS 'Tabela de scripts gerados pelos usuários';
COMMENT ON COLUMN scripts.id IS 'ID único do script (autoincrement)';
COMMENT ON COLUMN scripts.user_id IS 'ID do usuário que criou o script (referência à tabela users)';
COMMENT ON COLUMN scripts.input IS 'Pergunta ou prompt enviado pelo usuário';
COMMENT ON COLUMN scripts.output IS 'Script gerado pela IA em resposta ao input';
COMMENT ON COLUMN scripts.chatid IS 'ID único da conversa/chat onde o script foi gerado';
COMMENT ON COLUMN scripts.created_at IS 'Data de criação do registro';
COMMENT ON COLUMN scripts.updated_at IS 'Data da última atualização do registro';
