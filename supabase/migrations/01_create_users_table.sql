-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    telefone VARCHAR(20),
    avatar TEXT,
    rua VARCHAR(255),
    numero VARCHAR(20),
    bairro VARCHAR(100),
    cep VARCHAR(20),
    cidade VARCHAR(100),
    estado VARCHAR(50),
    pais VARCHAR(100) DEFAULT 'Brasil',
    nivel VARCHAR(10) CHECK (nivel IN ('admin', 'user')) DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create RLS (Row Level Security) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view and edit their own data
CREATE POLICY user_self_access ON users 
    FOR ALL 
    USING (auth.uid()::text = id::text)
    WITH CHECK (auth.uid()::text = id::text);

-- Policy: Admins can view all users
CREATE POLICY admin_view_all ON users 
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id::text = auth.uid()::text 
            AND users.nivel = 'admin'
        )
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update the updated_at column
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Comment on table and columns
COMMENT ON TABLE users IS 'Tabela de usuários do sistema Bússola Executiva';
COMMENT ON COLUMN users.id IS 'ID único do usuário (autoincrement)';
COMMENT ON COLUMN users.nome IS 'Nome completo do usuário';
COMMENT ON COLUMN users.email IS 'Email do usuário (único)';
COMMENT ON COLUMN users.telefone IS 'Número de telefone do usuário';
COMMENT ON COLUMN users.avatar IS 'URL da imagem de perfil do usuário';
COMMENT ON COLUMN users.rua IS 'Rua do endereço do usuário';
COMMENT ON COLUMN users.numero IS 'Número do endereço do usuário';
COMMENT ON COLUMN users.bairro IS 'Bairro do endereço do usuário';
COMMENT ON COLUMN users.cep IS 'CEP do endereço do usuário';
COMMENT ON COLUMN users.cidade IS 'Cidade do endereço do usuário';
COMMENT ON COLUMN users.estado IS 'Estado do endereço do usuário';
COMMENT ON COLUMN users.pais IS 'País do endereço do usuário';
COMMENT ON COLUMN users.nivel IS 'Nível de acesso (admin ou user)';
COMMENT ON COLUMN users.created_at IS 'Data de criação do registro';
COMMENT ON COLUMN users.updated_at IS 'Data da última atualização do registro';
