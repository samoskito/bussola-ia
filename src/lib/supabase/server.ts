import { createClient } from '@supabase/supabase-js';

// Tipos para o banco de dados - ajuste conforme necessário
type Database = any;

// Cria um cliente Supabase para o servidor usando a chave de serviço
export function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Variáveis de ambiente do Supabase não encontradas');
  }
  
  // Usar o cliente direto do supabase-js para o servidor
  // Isso evita problemas com cookies no servidor
  return createClient(supabaseUrl, supabaseServiceKey);
}
