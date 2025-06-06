import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST() {
  const supabaseServerClient = createServerSupabaseClient();
  const cookieStore = await cookies();
  try {
    // Create a response with success status
    const response = NextResponse.json(
      { success: true },
      { status: 200 }
    );
    
    // Clear the auth cookie
    response.cookies.delete('auth_token');
    
    return response;
    
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Erro ao fazer logout' },
      { status: 500 }
    );
  }
}
