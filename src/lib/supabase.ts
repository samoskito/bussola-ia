import { createClient } from '@supabase/supabase-js';

// Usar os valores das credenciais do Supabase para o projeto Bússola Executiva
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iszynegxctqdfrmizila.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzenluZWd4Y3RxZGZybWl6aWxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5MjIwODAsImV4cCI6MjA2MjQ5ODA4MH0.zkxYGj0jiGcoK_04FwHYkP_gsMnjHY8GioGEJNapBEI';

// Verificar se as URLs e chaves estão definidas
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL ou Anon Key não estão definidos');
}

// Cliente público para uso no front-end (com chave anônima)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// IMPORTANTE: Este cliente só deve ser usado em funções de servidor (Server Components, API Routes, etc.)
// NUNCA expor este cliente no front-end
export const createServerSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase URL ou Service Role Key não estão definidos');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

// Função para uso exclusivo em componentes de servidor ou API routes
export const getServerSupabaseClient = () => {
  return createServerSupabaseClient();
};

// Tipos para as tabelas
export type User = {
  id: number;
  nome: string;
  email: string;
  telefone?: string;
  avatar?: string;
  rua?: string;
  numero?: string;
  bairro?: string;
  cep?: string;
  cidade?: string;
  estado?: string;
  pais?: string;
  nivel: 'admin' | 'user';
  created_at?: string;
  updated_at?: string;
};

export type Chat = {
  id: string;
  user_id: number;
  title: string;
  created_at?: string;
  updated_at?: string;
};

export type Script = {
  id: number;
  user_id: number;
  input: string;
  output?: string;
  chatid: string;
  created_at?: string;
  updated_at?: string;
};


// Constantes para buckets de armazenamento
export const STORAGE_BUCKETS = {
  PROFILE_IMAGES: 'profile_images',
  CHAT_FILES: 'chat_files',
  IMAGES: 'images',
  ASSETS: 'assets',
  DOCUMENTS: 'documents'
};

// Funções para gerenciar o armazenamento de imagens
export const uploadImage = async (bucket: string, filePath: string, file: File) => {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao fazer upload da imagem:', error);
    throw error;
  }
};

export const getImageUrl = (bucket: string, filePath: string) => {
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
  } catch (error) {
    console.error('Erro ao obter URL da imagem:', error);
    return null;
  }
};

export const deleteImage = async (bucket: string, filePath: string) => {
  try {
    const { error } = await supabase.storage.from(bucket).remove([filePath]);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Erro ao excluir imagem:', error);
    throw error;
  }
};

export const listImages = async (bucket: string, folderPath?: string) => {
  try {
    const { data, error } = await supabase.storage.from(bucket).list(folderPath || '');
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao listar imagens:', error);
    throw error;
  }
};

// Funções de autenticação
export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) throw error;
  return data;
};

export const signUp = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

// Funções para gerenciar scripts
export const saveScript = async (userId: string, title: string, content: string) => {
  const { data, error } = await supabase
    .from('scripts')
    .insert([
      { user_id: userId, title, content, created_at: new Date() }
    ]);
  
  if (error) throw error;
  return data;
};

export const getScripts = async (userId: string) => {
  const { data, error } = await supabase
    .from('scripts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
};

export const deleteScript = async (scriptId: string) => {
  const { error } = await supabase
    .from('scripts')
    .delete()
    .eq('id', scriptId);
  
  if (error) throw error;
};
