'use server';

import { redirect } from 'next/navigation';

export async function logout() {
  // Redirecionar para a página de login
  // O middleware vai interceptar e verificar a autenticação
  // O cookie será limpo pela API de logout que será chamada pelo cliente
  redirect('/auth/login?logged_out=true');
}
