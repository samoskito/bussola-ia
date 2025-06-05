-- BÚSSOLA EXECUTIVA - SCRIPT COMPLETO DE CRIAÇÃO DO BANCO DE DADOS
-- Execute este script no Editor SQL do painel de administração do Supabase

-- =============================================
-- PARTE 1: CRIAÇÃO DA TABELA DE USUÁRIOS
-- =============================================

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

-- =============================================
-- PARTE 2: CRIAÇÃO DA TABELA DE SCRIPTS
-- =============================================

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
    USING (user_id::text = auth.uid()::text)
    WITH CHECK (user_id::text = auth.uid()::text);

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

-- =============================================
-- PARTE 3: CRIAÇÃO DA TABELA DE CHATS
-- =============================================

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
    USING (user_id::text = auth.uid()::text)
    WITH CHECK (user_id::text = auth.uid()::text);

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

-- =============================================
-- PARTE 4: INSERÇÃO DE DADOS INICIAIS
-- =============================================

-- Inserir usuário administrador inicial
INSERT INTO users (nome, email, telefone, nivel)
VALUES ('Administrador', 'admin@bussola-executiva.com', '(11) 99999-9999', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Inserir usuário comum para testes
INSERT INTO users (nome, email, telefone, nivel)
VALUES ('Usuário Teste', 'usuario@bussola-executiva.com', '(11) 88888-8888', 'user')
ON CONFLICT (email) DO NOTHING;

-- Inserir um chat inicial para o administrador
INSERT INTO chats (user_id, title)
SELECT id, 'Conversa Inicial - Administrador'
FROM users
WHERE email = 'admin@bussola-executiva.com'
LIMIT 1;

-- Inserir um chat inicial para o usuário de teste
INSERT INTO chats (user_id, title)
SELECT id, 'Conversa Inicial - Usuário'
FROM users
WHERE email = 'usuario@bussola-executiva.com'
LIMIT 1;

-- Inserir um exemplo de script para o administrador
INSERT INTO scripts (user_id, input, output, chatid)
SELECT 
    u.id, 
    'Como criar um script para uma reunião de vendas?',
    'Aqui está um script para uma reunião de vendas:

1. Introdução (2 minutos)
   - Agradeça a todos por participarem
   - Apresente-se e explique o propósito da reunião

2. Apresentação do Produto (5 minutos)
   - Descreva brevemente o produto/serviço
   - Destaque os principais benefícios e diferenciais

3. Demonstração (10 minutos)
   - Mostre como o produto funciona
   - Destaque os recursos mais importantes

4. Casos de Sucesso (5 minutos)
   - Compartilhe histórias de clientes satisfeitos
   - Apresente dados e resultados concretos

5. Proposta de Valor (5 minutos)
   - Explique o preço e condições
   - Destaque o retorno sobre investimento

6. Perguntas e Respostas (10 minutos)
   - Responda às dúvidas dos participantes
   - Aborde objeções comuns

7. Próximos Passos (3 minutos)
   - Explique o processo de aquisição
   - Estabeleça um prazo para follow-up

Lembre-se de adaptar este script ao seu produto específico e ao perfil do cliente.',
    c.id
FROM 
    users u
    JOIN chats c ON u.id = c.user_id
WHERE 
    u.email = 'admin@bussola-executiva.com'
LIMIT 1;

-- Inserir um exemplo de script para o usuário de teste
INSERT INTO scripts (user_id, input, output, chatid)
SELECT 
    u.id, 
    'Como preparar uma reunião com investidores?',
    'Aqui está um script para uma reunião com investidores:

1. Introdução (3 minutos)
   - Agradeça a presença dos investidores
   - Apresente brevemente a equipe presente
   - Estabeleça a agenda da reunião

2. Visão Geral da Empresa (5 minutos)
   - Missão e visão
   - Problema que você está resolvendo
   - Solução que você oferece

3. Produto/Serviço (7 minutos)
   - Demonstração do produto
   - Diferenciais competitivos
   - Roadmap de desenvolvimento

4. Mercado e Concorrência (5 minutos)
   - Tamanho do mercado (TAM, SAM, SOM)
   - Análise da concorrência
   - Vantagens competitivas

5. Tração e Métricas (7 minutos)
   - Crescimento de usuários/clientes
   - Receita e margens
   - Outros KPIs relevantes

6. Estratégia de Marketing e Vendas (5 minutos)
   - Canais de aquisição
   - Estratégia de crescimento
   - CAC e LTV

7. Projeções Financeiras (5 minutos)
   - Projeções de receita para 3-5 anos
   - Necessidades de investimento
   - Uso dos recursos captados

8. Oferta de Investimento (3 minutos)
   - Valor buscado
   - Equity oferecido
   - Termos principais

9. Perguntas e Respostas (15 minutos)
   - Prepare-se para perguntas difíceis
   - Seja transparente e direto

10. Encerramento (2 minutos)
    - Agradeça o tempo e atenção
    - Estabeleça próximos passos
    - Defina um prazo para follow-up

Dicas adicionais:
- Ensaie sua apresentação várias vezes
- Conheça seus números de cor
- Seja conciso e vá direto ao ponto
- Demonstre paixão pelo seu negócio',
    c.id
FROM 
    users u
    JOIN chats c ON u.id = c.user_id
WHERE 
    u.email = 'usuario@bussola-executiva.com'
LIMIT 1;

-- =============================================
-- PARTE 5: CRIAÇÃO DE USUÁRIOS NO SISTEMA DE AUTENTICAÇÃO
-- =============================================

-- NOTA: Esta parte precisa ser executada manualmente no painel de administração do Supabase
-- Acesse Authentication > Users > Invite User e adicione os seguintes usuários:
-- 1. admin@bussola-executiva.com (com senha segura)
-- 2. usuario@bussola-executiva.com (com senha segura)
