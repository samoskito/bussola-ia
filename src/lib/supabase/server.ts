import { createClient } from '@supabase/supabase-js';

// Tipos para o banco de dados - ajuste conforme necessário
type Database = any;

type CreateServerSupabaseClientOptions = {
  // Use true for API routes that must bypass RLS safely on the server.
  useServiceRole?: boolean;
};

// Cria um cliente Supabase para o servidor.
// Por padrão exige a service role key para operações de backend.
export function createServerSupabaseClient(
  options: CreateServerSupabaseClientOptions = { useServiceRole: true }
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl) {
    throw new Error('URL do Supabase não encontrada');
  }
  
  const useServiceRole = options.useServiceRole !== false;
  const apiKey = useServiceRole ? supabaseServiceKey : (supabaseAnonKey || supabaseServiceKey);
  
  if (!apiKey) {
    throw new Error(
      useServiceRole
        ? 'SUPABASE_SERVICE_ROLE_KEY não encontrada. Defina essa variável para operações de servidor.'
        : 'Nenhuma chave de API do Supabase encontrada'
    );
  }
  
  // Usar o cliente direto do supabase-js para o servidor
  // Isso evita problemas com cookies no servidor
  return createClient(supabaseUrl, apiKey);
}
