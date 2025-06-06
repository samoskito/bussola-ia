'use server';

import { serverSignUp } from '@/lib/supabase/server-auth';
import { redirect } from 'next/navigation';

export async function register(formData: FormData): Promise<void> {
  try {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;
    
    if (!email || !password || !confirmPassword) {
      console.error('Todos os campos são obrigatórios');
      return;
    }
    
    if (password !== confirmPassword) {
      console.error('As senhas não coincidem');
      return;
    }
    
    await serverSignUp(email, password);
    
    // Redirecionar para a página de login após o registro bem-sucedido
    redirect('/auth/login?registered=true');
  } catch (error) {
    console.error('Erro ao registrar:', error);
  }
}
