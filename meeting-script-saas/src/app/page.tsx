import { redirect } from 'next/navigation';

export default function Home() {
  // Na implementação real, verificaríamos se o usuário está autenticado
  // e redirecionaríamos para o dashboard ou login
  redirect('/auth/login');
}
