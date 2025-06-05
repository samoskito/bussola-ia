-- Script de criação de tabelas para o projeto Bússola Executiva
-- Este script deve ser executado no SQL Editor do Supabase

-- Habilitar a extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de Usuários
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  telefone TEXT,
  data_nascimento DATE,
  linkedin TEXT,
  profissao TEXT,
  cargo TEXT,
  salario DECIMAL(10, 2),
  descricao TEXT,
  quantidade_chats INTEGER DEFAULT 0,
  imagem_perfil TEXT,
  plano_assinatura TEXT DEFAULT 'free',
  funcao TEXT DEFAULT 'usuario' CHECK (funcao IN ('administrador', 'usuario')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Imagens do Site
CREATE TABLE IF NOT EXISTS site_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  url TEXT NOT NULL,
  local_site TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Chats
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ultima_mensagem TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Mensagens (Histórico de Conversa)
CREATE TABLE IF NOT EXISTS mensagens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('usuario', 'assistente')),
  conteudo TEXT NOT NULL,
  arquivos JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Outputs (já existente, mas recriando para garantir)
CREATE TABLE IF NOT EXISTS outputs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  input TEXT NOT NULL,
  output TEXT,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'concluido', 'erro')),
  webhook_id TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Arquivos
CREATE TABLE IF NOT EXISTS arquivos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  mensagem_id UUID REFERENCES mensagens(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  tamanho INTEGER NOT NULL,
  url TEXT NOT NULL,
  bucket TEXT NOT NULL,
  path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Função para atualizar o timestamp de atualização
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar o timestamp de atualização
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_site_images_updated_at
BEFORE UPDATE ON site_images
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chats_updated_at
BEFORE UPDATE ON chats
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_outputs_updated_at
BEFORE UPDATE ON outputs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Função para atualizar a última mensagem do chat
CREATE OR REPLACE FUNCTION update_chat_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chats
  SET ultima_mensagem = NEW.created_at
  WHERE id = NEW.chat_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar a última mensagem do chat
CREATE TRIGGER update_chat_last_message_trigger
AFTER INSERT ON mensagens
FOR EACH ROW
EXECUTE FUNCTION update_chat_last_message();

-- Função para incrementar a quantidade de chats do usuário
CREATE OR REPLACE FUNCTION increment_user_chats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users
  SET quantidade_chats = quantidade_chats + 1
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para incrementar a quantidade de chats do usuário
CREATE TRIGGER increment_user_chats_trigger
AFTER INSERT ON chats
FOR EACH ROW
EXECUTE FUNCTION increment_user_chats();

-- Configurar políticas de segurança (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE arquivos ENABLE ROW LEVEL SECURITY;

-- Políticas para usuários
CREATE POLICY "Usuários podem ver seus próprios dados"
  ON users FOR SELECT
  USING (auth.uid() = auth_id OR EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND funcao = 'administrador'
  ));

CREATE POLICY "Usuários podem atualizar seus próprios dados"
  ON users FOR UPDATE
  USING (auth.uid() = auth_id);

-- Políticas para imagens do site
CREATE POLICY "Todos podem ver imagens do site"
  ON site_images FOR SELECT
  USING (true);

CREATE POLICY "Apenas administradores podem gerenciar imagens do site"
  ON site_images FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND funcao = 'administrador'
  ));

-- Políticas para chats
CREATE POLICY "Usuários podem ver seus próprios chats"
  ON chats FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND id = user_id
  ) OR EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND funcao = 'administrador'
  ));

CREATE POLICY "Usuários podem criar seus próprios chats"
  ON chats FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND id = user_id
  ));

CREATE POLICY "Usuários podem atualizar seus próprios chats"
  ON chats FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND id = user_id
  ));

CREATE POLICY "Usuários podem excluir seus próprios chats"
  ON chats FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND id = user_id
  ));

-- Políticas para mensagens
CREATE POLICY "Usuários podem ver mensagens de seus próprios chats"
  ON mensagens FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM chats
    JOIN users ON users.id = chats.user_id
    WHERE chats.id = chat_id AND users.auth_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND funcao = 'administrador'
  ));

CREATE POLICY "Usuários podem criar mensagens em seus próprios chats"
  ON mensagens FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM chats
    JOIN users ON users.id = chats.user_id
    WHERE chats.id = chat_id AND users.auth_id = auth.uid()
  ));

-- Políticas para outputs
CREATE POLICY "Usuários podem ver seus próprios outputs"
  ON outputs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND id = user_id
  ) OR EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND funcao = 'administrador'
  ));

CREATE POLICY "Usuários podem criar seus próprios outputs"
  ON outputs FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND id = user_id
  ));

CREATE POLICY "Usuários podem atualizar seus próprios outputs"
  ON outputs FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND id = user_id
  ) OR EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND funcao = 'administrador'
  ));

-- Políticas para arquivos
CREATE POLICY "Usuários podem ver seus próprios arquivos"
  ON arquivos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND id = user_id
  ) OR EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND funcao = 'administrador'
  ));

CREATE POLICY "Usuários podem criar seus próprios arquivos"
  ON arquivos FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND id = user_id
  ));

CREATE POLICY "Usuários podem excluir seus próprios arquivos"
  ON arquivos FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND id = user_id
  ));

-- Inserir imagens padrão do site
INSERT INTO site_images (url, local_site, descricao, ordem)
VALUES 
  ('auth/presenter.jpg', 'login_background', 'Imagem de fundo da página de login', 1),
  ('logo.svg', 'logo', 'Logo da Bússola Executiva', 1);
