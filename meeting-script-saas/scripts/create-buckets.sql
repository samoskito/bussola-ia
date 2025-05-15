-- Script para criar políticas de segurança para os buckets no Supabase
-- Execute este script no SQL Editor do Supabase após criar os buckets manualmente

-- Políticas para o bucket profile_images
-- Permitir SELECT para todos (bucket público)
CREATE POLICY "Permitir acesso público para imagens de perfil" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'profile_images');

-- Permitir INSERT apenas para o próprio usuário
CREATE POLICY "Permitir upload de imagens de perfil apenas para o próprio usuário" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'profile_images' AND
    auth.uid() IS NOT NULL
  );

-- Permitir UPDATE e DELETE apenas para o próprio usuário
CREATE POLICY "Permitir atualização e exclusão de imagens de perfil apenas para o próprio usuário" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'profile_images' AND
    auth.uid() = (storage.foldername(name))[1]::uuid
  );

-- Políticas para o bucket chat_files
-- Permitir SELECT para todos (bucket público)
CREATE POLICY "Permitir acesso público para arquivos de chat" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'chat_files');

-- Permitir INSERT apenas para usuários autenticados
CREATE POLICY "Permitir upload de arquivos de chat apenas para usuários autenticados" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'chat_files' AND
    auth.role() = 'authenticated'
  );

-- Permitir DELETE apenas para o próprio usuário
CREATE POLICY "Permitir exclusão de arquivos de chat apenas para o próprio usuário" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'chat_files' AND
    auth.uid() = (storage.foldername(name))[1]::uuid
  );

-- Políticas para o bucket images
-- Permitir SELECT para todos (bucket público)
CREATE POLICY "Permitir acesso público para imagens do site" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'images');

-- Permitir INSERT, UPDATE, DELETE apenas para administradores
CREATE POLICY "Permitir gerenciamento de imagens do site apenas para administradores" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'images' AND
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_id = auth.uid() AND funcao = 'administrador'
    )
  );

-- Políticas para o bucket assets
-- Permitir SELECT para todos (bucket público)
CREATE POLICY "Permitir acesso público para assets do site" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'assets');

-- Permitir INSERT, UPDATE, DELETE apenas para administradores
CREATE POLICY "Permitir gerenciamento de assets do site apenas para administradores" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'assets' AND
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_id = auth.uid() AND funcao = 'administrador'
    )
  );

-- Políticas para o bucket documents (privado)
-- Permitir SELECT apenas para o próprio usuário
CREATE POLICY "Permitir acesso a documentos apenas para o próprio usuário" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'documents' AND
    auth.uid() = (storage.foldername(name))[1]::uuid
  );

-- Permitir INSERT, UPDATE, DELETE apenas para o próprio usuário
CREATE POLICY "Permitir gerenciamento de documentos apenas para o próprio usuário" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'documents' AND
    auth.uid() = (storage.foldername(name))[1]::uuid
  );
