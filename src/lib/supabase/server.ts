import { createClient } from '@supabase/supabase-js';

// Tipos para o banco de dados - ajuste conforme necessário
type Database = any;

// Cria um cliente Supabase para o servidor usando a chave de serviço ou a chave anônima
export function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl) {
    throw new Error('URL do Supabase não encontrada');
  }
  
  // Usar a chave de serviço se disponível, caso contrário usar a chave anônima
  const apiKey = supabaseServiceKey || supabaseAnonKey;
  
  if (!apiKey) {
    throw new Error('Nenhuma chave de API do Supabase encontrada');
  }
  
  // Usar o cliente direto do supabase-js para o servidor
  // Isso evita problemas com cookies no servidor
  return createClient(supabaseUrl, apiKey);
}
