-- BÚSSOLA EXECUTIVA - SCRIPT PARA CRIAÇÃO DE BUCKETS DE ARMAZENAMENTO
-- Execute este script no Editor SQL do painel de administração do Supabase

-- =============================================
-- PARTE 1: CRIAÇÃO DOS BUCKETS DE ARMAZENAMENTO
-- =============================================

-- Criar bucket para avatares de usuários
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Criar bucket para recursos do aplicativo (logos, imagens de fundo, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-resources', 'app-resources', true)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- PARTE 2: CONFIGURAÇÃO DE POLÍTICAS DE SEGURANÇA
-- =============================================

-- Políticas para o bucket de avatares

-- Política para visualização pública de avatares
CREATE POLICY "Avatars são publicamente visíveis"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Política para permitir que usuários façam upload de seus próprios avatares
CREATE POLICY "Usuários podem fazer upload de seus próprios avatares"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para permitir que usuários atualizem seus próprios avatares
CREATE POLICY "Usuários podem atualizar seus próprios avatares"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para permitir que usuários excluam seus próprios avatares
CREATE POLICY "Usuários podem excluir seus próprios avatares"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Políticas para o bucket de recursos do aplicativo

-- Política para visualização pública de recursos do aplicativo
CREATE POLICY "Recursos do aplicativo são publicamente visíveis"
ON storage.objects FOR SELECT
USING (bucket_id = 'app-resources');

-- Política para permitir que apenas administradores façam upload de recursos do aplicativo
CREATE POLICY "Apenas administradores podem fazer upload de recursos do aplicativo"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'app-resources' AND
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.nivel = 'admin'
  )
);

-- Política para permitir que apenas administradores atualizem recursos do aplicativo
CREATE POLICY "Apenas administradores podem atualizar recursos do aplicativo"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'app-resources' AND
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.nivel = 'admin'
  )
);

-- Política para permitir que apenas administradores excluam recursos do aplicativo
CREATE POLICY "Apenas administradores podem excluir recursos do aplicativo"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'app-resources' AND
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.nivel = 'admin'
  )
);

-- =============================================
-- PARTE 3: FUNÇÕES AUXILIARES PARA GERENCIAR ARMAZENAMENTO
-- =============================================

-- Função para obter URL pública de um arquivo
CREATE OR REPLACE FUNCTION storage_public_url(bucket_id text, name text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  project_url text;
BEGIN
  SELECT current_setting('app.settings.project_url', true) INTO project_url;
  
  IF project_url IS NULL THEN
    -- URL padrão do Supabase Storage
    RETURN '/storage/v1/object/public/' || bucket_id || '/' || name;
  ELSE
    -- URL completa
    RETURN project_url || '/storage/v1/object/public/' || bucket_id || '/' || name;
  END IF;
END;
$$;
