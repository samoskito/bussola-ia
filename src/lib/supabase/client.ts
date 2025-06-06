import { createBrowserClient } from '@supabase/ssr';

// Tipos para o banco de dados - ajuste conforme necessário
type Database = any;

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      cookieOptions: {
        name: 'sb-auth',
        // Não use lifetime, use maxAge em segundos
        maxAge: 60 * 60 * 24 * 30, // 30 dias
        domain: '',
        path: '/',
        sameSite: 'lax'
      }
    }
  );
}

export const supabase = createSupabaseBrowserClient();
