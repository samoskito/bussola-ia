-- Script para corrigir o esquema do banco de dados
-- Este script vai recriar as tabelas com os tipos corretos para compatibilidade com o Auth

-- Primeiro, vamos remover as tabelas existentes (na ordem inversa de dependência)
DROP TABLE IF EXISTS scripts;
DROP TABLE IF EXISTS chats;
DROP TABLE IF EXISTS users;

-- Agora vamos recriar a tabela users com UUID como tipo de ID
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha VARCHAR(255) DEFAULT 'mudar123',
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
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Policy: Admins can view all users
CREATE POLICY admin_view_all ON users 
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
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

-- Recriar a tabela de chats
CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Policy: Admins can view all chats
CREATE POLICY admin_view_all_chats ON chats 
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.nivel = 'admin'
        )
    );

-- Trigger to update the updated_at column
CREATE TRIGGER update_chats_updated_at
    BEFORE UPDATE ON chats
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Recriar a tabela de scripts
CREATE TABLE IF NOT EXISTS scripts (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    input TEXT NOT NULL,
    output TEXT,
    chatid UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_chat FOREIGN KEY (chatid) REFERENCES chats(id)
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
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Policy: Admins can view all scripts
CREATE POLICY admin_view_all_scripts ON scripts 
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.nivel = 'admin'
        )
    );

-- Trigger to update the updated_at column
CREATE TRIGGER update_scripts_updated_at
    BEFORE UPDATE ON scripts
    FOR EACH ROW
    EXECUTE PROCEDURE update_scripts_updated_at_column();

-- Inserir os usuários com os UUIDs corretos
INSERT INTO users (id, nome, email, telefone, nivel)
VALUES 
    ('9624b666-4b0b-4f90-9126-62a52f34f3e8', 'Administrador', 'admin@bussola-executiva.com', '(11) 99999-9999', 'admin'),
    ('6fff6c3c-b0f3-40e3-86aa-4ae760541667', 'Usuário Teste', 'usuario@bussola-executiva.com', '(11) 88888-8888', 'user');

-- Inserir chats iniciais
INSERT INTO chats (id, user_id, title)
VALUES 
    (gen_random_uuid(), '9624b666-4b0b-4f90-9126-62a52f34f3e8', 'Conversa Inicial - Administrador'),
    (gen_random_uuid(), '6fff6c3c-b0f3-40e3-86aa-4ae760541667', 'Conversa Inicial - Usuário');

-- Inserir scripts de exemplo (precisamos primeiro obter os IDs dos chats)
WITH admin_chat AS (
    SELECT id FROM chats WHERE user_id = '9624b666-4b0b-4f90-9126-62a52f34f3e8' LIMIT 1
),
user_chat AS (
    SELECT id FROM chats WHERE user_id = '6fff6c3c-b0f3-40e3-86aa-4ae760541667' LIMIT 1
)
INSERT INTO scripts (user_id, input, output, chatid)
SELECT 
    '9624b666-4b0b-4f90-9126-62a52f34f3e8', 
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
    (SELECT id FROM admin_chat);

WITH admin_chat AS (
    SELECT id FROM chats WHERE user_id = '9624b666-4b0b-4f90-9126-62a52f34f3e8' LIMIT 1
),
user_chat AS (
    SELECT id FROM chats WHERE user_id = '6fff6c3c-b0f3-40e3-86aa-4ae760541667' LIMIT 1
)
INSERT INTO scripts (user_id, input, output, chatid)
SELECT 
    '6fff6c3c-b0f3-40e3-86aa-4ae760541667', 
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
    (SELECT id FROM user_chat);
