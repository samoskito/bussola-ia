-- =============================================================
-- Fix: Senha padrão em texto puro → hash bcrypt
-- Data: 2026-03-30
-- Descrição:
--   1. Atualiza o DEFAULT da coluna 'senha' para hash bcrypt
--   2. Corrige usuários existentes que têm senha em texto puro
-- =============================================================

-- 1. Alterar o DEFAULT da coluna senha para o hash bcrypt de "mudar123"
ALTER TABLE users
  ALTER COLUMN senha
  SET DEFAULT '$2b$10$UnXZjNMEFJKPqt2TpuYkWeKyBcb94fUBc0/Xgz55V8LDSi1FZjI82';

-- 2. Corrigir usuários existentes que têm senha em texto puro (não começa com $2)
UPDATE users
  SET senha = '$2b$10$UnXZjNMEFJKPqt2TpuYkWeKyBcb94fUBc0/Xgz55V8LDSi1FZjI82',
      updated_at = NOW()
  WHERE senha IS NULL
     OR senha NOT LIKE '$2%';
