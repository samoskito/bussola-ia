'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import MobileMenu from '@/components/layout/MobileMenu';

export default function AdminUsersShell({ children, mode = 'demo' }: { children: React.ReactNode; mode?: 'demo' | 'live' }) {
  const { user, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  if (loading) return <div role="status" className="flex min-h-screen w-full items-center justify-center bg-gray-950 text-gray-300">Verificando acesso…</div>;
  if (!user || user.nivel !== 'admin') return <main className="flex min-h-screen w-full items-center justify-center bg-gray-950 p-6 text-white"><div className="max-w-lg border-l-2 border-orange-500 pl-6"><p className="text-xs uppercase tracking-widest text-orange-300">Acesso restrito</p><h1 className="mt-3 text-2xl font-semibold">Administração exclusiva para administradores</h1><p className="mt-3 text-sm text-gray-400">Entre com uma conta administrativa para abrir o painel.</p><Link href={user ? '/dashboard' : '/auth/login'} className="mt-6 inline-block rounded-lg border border-gray-700 px-4 py-2 text-sm">{user ? 'Voltar ao dashboard' : 'Entrar'}</Link></div></main>;
  return <div className="flex h-[100dvh] w-full overflow-hidden bg-gray-950 text-white">
    <div className="hidden w-64 shrink-0 lg:flex xl:w-72"><Sidebar /></div>
    <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} chats={[]} />
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <Header userName={user?.nome || user?.email || 'Administrador'} title="Usuários e acessos" onMenuToggle={() => setMenuOpen(v => !v)} />
      <div className="shrink-0 border-b border-orange-400/25 bg-orange-500/10 px-5 py-3 text-xs leading-relaxed text-orange-200" role="status"><strong className="mr-2 tracking-widest">{mode === 'demo' ? 'DEMO LOCAL' : 'ADMINISTRAÇÃO'}</strong>{mode === 'demo' ? 'Dados fictícios em memória · nenhum e-mail real enviado · nenhuma alteração em produção.' : 'Alterações de cadastro e acesso exigem revisão. Convites são emitidos somente após sua confirmação.'}</div>
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  </div>;
}
