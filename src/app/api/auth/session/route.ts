import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { user: null },
        { status: 200 }
      );
    }
    
    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as { userId: string; email: string };
    
    if (!decoded || !decoded.userId) {
      // Clear invalid token
      const response = NextResponse.json(
        { user: null },
        { status: 200 }
      );
      
      response.cookies.delete('auth_token');
      return response;
    }
    
    // Initialize Supabase client
    const supabase = createServerSupabaseClient();
    
    // Get user data from the database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, nome, telefone, avatar, created_at, updated_at')
      .eq('id', decoded.userId)
      .single();
    
    if (userError || !user) {
      // Clear invalid user token
      const response = NextResponse.json(
        { user: null },
        { status: 200 }
      );
      
      response.cookies.delete('auth_token');
      return response;
    }
    
    return NextResponse.json(
      { user },
      { status: 200 }
    );
    
  } catch (error) {
    console.error('Session error:', error);
    
    // Clear invalid token on error
    const response = NextResponse.json(
      { user: null },
      { status: 200 }
    );
    
    response.cookies.delete('auth_token');
    return response;
  }
}
