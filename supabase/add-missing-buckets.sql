-- BÚSSOLA EXECUTIVA - SCRIPT PARA ADICIONAR BUCKETS DE ARMAZENAMENTO FALTANTES
-- Execute este script no Editor SQL do painel de administração do Supabase

-- Criar bucket para imagens gerais
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

-- Criar bucket para assets (logos, ícones, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas para o bucket de imagens
CREATE POLICY "Imagens são publicamente visíveis"
ON storage.objects FOR SELECT
USING (bucket_id = 'images');

-- Políticas para o bucket de assets
CREATE POLICY "Assets são publicamente visíveis"
ON storage.objects FOR SELECT
USING (bucket_id = 'assets');

-- Política para permitir que administradores façam upload de imagens
CREATE POLICY "Administradores podem fazer upload de imagens"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'images' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id::text = auth.uid() AND users.nivel = 'admin'
  )
);

-- Política para permitir que administradores façam upload de assets
CREATE POLICY "Administradores podem fazer upload de assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'assets' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id::text = auth.uid() AND users.nivel = 'admin'
  )
);
