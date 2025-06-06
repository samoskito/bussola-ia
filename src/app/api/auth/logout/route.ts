import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    const cookieStore = cookies();
    const supabaseServerClient = createServerSupabaseClient();
    
    // Fazer logout no Supabase
    await supabaseServerClient.auth.signOut();
    
    // Criar uma resposta com status de sucesso
    const response = NextResponse.json(
      { success: true },
      { status: 200 }
    );
    
    // Limpar todos os cookies relacionados à autenticação
    response.cookies.delete('auth_token');
    response.cookies.delete('supabase-auth-token');
    
    // Definir cabeçalhos para evitar cache
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    
    return response;
    
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Erro ao fazer logout' },
      { status: 500 }
    );
  }
}
