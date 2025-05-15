/**
 * Script para configurar buckets e tabelas no Supabase para o projeto Bússola Executiva
 * 
 * Este script deve ser executado manualmente no console do Supabase ou adaptado para
 * ser executado como uma migração.
 * 
 * URL do Supabase: https://iszynegxctqdfrmizila.supabase.co
 */

// SQL para criar a tabela de imagens
const createImagesTable = `
CREATE TABLE IF NOT EXISTS images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL,
  path TEXT NOT NULL,
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(bucket, path)
);

-- Adicionar políticas RLS (Row Level Security)
ALTER TABLE images ENABLE ROW LEVEL SECURITY;

-- Política para permitir que usuários vejam apenas suas próprias imagens
CREATE POLICY "Usuários podem ver suas próprias imagens" 
  ON images FOR SELECT 
  USING (auth.uid() = user_id);

-- Política para permitir que usuários insiram suas próprias imagens
CREATE POLICY "Usuários podem inserir suas próprias imagens" 
  ON images FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Política para permitir que usuários atualizem suas próprias imagens
CREATE POLICY "Usuários podem atualizar suas próprias imagens" 
  ON images FOR UPDATE 
  USING (auth.uid() = user_id);

-- Política para permitir que usuários excluam suas próprias imagens
CREATE POLICY "Usuários podem excluir suas próprias imagens" 
  ON images FOR DELETE 
  USING (auth.uid() = user_id);

-- Criar função para atualizar o timestamp de atualização
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para atualizar o timestamp de atualização
CREATE TRIGGER update_images_updated_at
BEFORE UPDATE ON images
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
`;

// SQL para criar a tabela de scripts
const createScriptsTable = `
CREATE TABLE IF NOT EXISTS scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar políticas RLS (Row Level Security)
ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;

-- Política para permitir que usuários vejam apenas seus próprios scripts
CREATE POLICY "Usuários podem ver seus próprios scripts" 
  ON scripts FOR SELECT 
  USING (auth.uid() = user_id);

-- Política para permitir que usuários insiram seus próprios scripts
CREATE POLICY "Usuários podem inserir seus próprios scripts" 
  ON scripts FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Política para permitir que usuários atualizem seus próprios scripts
CREATE POLICY "Usuários podem atualizar seus próprios scripts" 
  ON scripts FOR UPDATE 
  USING (auth.uid() = user_id);

-- Política para permitir que usuários excluam seus próprios scripts
CREATE POLICY "Usuários podem excluir seus próprios scripts" 
  ON scripts FOR DELETE 
  USING (auth.uid() = user_id);

-- Criar trigger para atualizar o timestamp de atualização
CREATE TRIGGER update_scripts_updated_at
BEFORE UPDATE ON scripts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
`;

// Instruções para criar buckets de armazenamento
const createStorageBuckets = `
-- Estas operações devem ser executadas através da interface do Supabase ou da API:

1. Criar bucket 'images':
   - Nome: images
   - Acesso público: Sim
   - Tipo de arquivo: Imagens (jpg, jpeg, png, gif, webp)
   - Tamanho máximo: 5MB

2. Criar bucket 'avatars':
   - Nome: avatars
   - Acesso público: Sim
   - Tipo de arquivo: Imagens (jpg, jpeg, png, gif, webp)
   - Tamanho máximo: 2MB

3. Criar bucket 'assets':
   - Nome: assets
   - Acesso público: Sim
   - Tipo de arquivo: Todos
   - Tamanho máximo: 10MB
`;

// Instruções para fazer upload da imagem da apresentadora
const uploadPresenterImage = `
-- Para fazer upload da imagem da apresentadora:

1. Acesse o painel de controle do Supabase: https://app.supabase.com/
2. Navegue até Storage > Buckets > images
3. Crie uma pasta chamada 'auth'
4. Faça upload da imagem da apresentadora com o nome 'presenter.jpg'
5. Certifique-se de que a imagem tenha acesso público
`;

console.log('=== SQL para criar a tabela de imagens ===');
console.log(createImagesTable);

console.log('\n=== SQL para criar a tabela de scripts ===');
console.log(createScriptsTable);

console.log('\n=== Instruções para criar buckets de armazenamento ===');
console.log(createStorageBuckets);

console.log('\n=== Instruções para fazer upload da imagem da apresentadora ===');
console.log(uploadPresenterImage);
