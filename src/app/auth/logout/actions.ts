'use server';

import { signOut } from '@/lib/supabase';
import { redirect } from 'next/navigation';

export async function logout() {
  try {
    await signOut();
    
    // Redirecionar para a página de login após o logout bem-sucedido
    redirect('/auth/login?logged_out=true');
  } catch (error) {
    console.error('Erro ao fazer logout:', error);
    redirect('/dashboard');
  }
}
