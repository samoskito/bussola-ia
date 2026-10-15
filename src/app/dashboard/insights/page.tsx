'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import MobileMenu from '@/components/layout/MobileMenu';
import InsightsDashboard from '@/components/insights/InsightsDashboard';

export default function InsightsPage() {
  const { user, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (loading) return <div role="status" className="flex min-h-screen items-center justify-center bg-gray-950 text-gray-300">Verificando acesso…</div>;
  if (!user || user.nivel !== 'admin') return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 p-6 text-white">
      <div className="max-w-md border-l-2 border-orange-500 pl-6">
        <p className="mb-3 text-xs uppercase tracking-widest text-orange-300">Acesso restrito</p>
        <h1 className="text-2xl font-semibold">Insights exclusivos para administradores</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-400">Esta visão reúne as demandas enviadas às quatro IAs. Entre com uma conta administrativa para consultar o painel.</p>
        <Link href={user ? '/dashboard' : '/auth/login'} className="mt-6 inline-block rounded-md border border-gray-600 px-4 py-2 text-sm hover:border-orange-400">{user ? 'Voltar ao dashboard' : 'Entrar'}</Link>
      </div>
    </main>
  );

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-gray-950 text-white">
      <div className="hidden lg:flex lg:w-64 xl:w-72 shrink-0"><Sidebar /></div>
      <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} chats={[]} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header userName={user.nome || user.email} title="Insights" onMenuToggle={() => setMenuOpen(value => !value)} />
        <main className="min-h-0 flex-1 overflow-y-auto"><InsightsDashboard /></main>
      </div>
    </div>
  );
}
