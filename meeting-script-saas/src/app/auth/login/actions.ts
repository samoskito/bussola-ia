'use server';

import { signIn } from '@/lib/supabase';
import { redirect } from 'next/navigation';

export async function login(formData: FormData): Promise<void> {
  try {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    
    if (!email || !password) {
      console.error('Email e senha são obrigatórios');
      return;
    }
    
    await signIn(email, password);
    
    // Redirecionar para o dashboard após login bem-sucedido
    redirect('/dashboard');
  } catch (error) {
    console.error('Erro ao fazer login:', error);
  }
}
