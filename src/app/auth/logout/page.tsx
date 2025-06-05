import { logout } from './actions';
import { redirect } from 'next/navigation';

// Esta página executa o logout automaticamente e redireciona o usuário
export default async function LogoutPage() {
  // Executar a ação de logout
  await logout();
  
  // Redirecionar para a página de login (isso só será executado se o logout falhar)
  redirect('/auth/login');
}
