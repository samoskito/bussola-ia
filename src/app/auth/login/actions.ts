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
    
    const authData = await signIn(email, password);
    
    if (authData.user) {
      // Redirecionar para a página de chats após login bem-sucedido
      redirect('/dashboard/chat');
    } else {
      throw new Error('Falha na autenticação');
    }
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    throw error; // Propagar o erro para que o componente de UI possa tratá-lo
  }
}
