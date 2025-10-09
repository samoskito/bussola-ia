-- Script para adicionar controle de acesso às IAs
-- Adiciona colunas para controlar expiração e planos dos usuários

-- 1. Adicionar coluna data_expiracao
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS data_expiracao DATE;

-- 2. Adicionar coluna plano com opções específicas
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS plano TEXT CHECK (plano IN ('Comunicação Executiva', 'Apresentação para Reunião de Resultados', 'Ambas'));

-- 3. Atualizar usuários existentes com data de expiração 01/10/2025 e plano "Ambas"
UPDATE users 
SET 
  data_expiracao = '2025-10-01',
  plano = 'Ambas'
WHERE data_expiracao IS NULL;

-- 4. Criar índice na coluna data_expiracao para melhor performance em consultas
CREATE INDEX IF NOT EXISTS idx_users_data_expiracao ON users(data_expiracao);

-- 5. Criar índice na coluna plano para melhor performance em consultas
CREATE INDEX IF NOT EXISTS idx_users_plano ON users(plano);

-- Comentários nas colunas para documentação
COMMENT ON COLUMN users.data_expiracao IS 'Data em que o usuário perde acesso à IA se não renovar o plano';
COMMENT ON COLUMN users.plano IS 'Define a qual IA o usuário tem acesso: Comunicação Executiva, Apresentação para Reunião de Resultados ou Ambas';
