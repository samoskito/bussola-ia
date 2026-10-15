import Link from 'next/link';
import AdminUsersDashboard from '@/components/admin-users/AdminUsersDashboard';
import AdminUsersShell from '@/components/admin-users/AdminUsersShell';
import { AdminUsersError, requireAdminUsersDemo } from '@/lib/admin-users/config';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  let failure: { status: number; message: string } | null = null;
  try { requireAdminUsersDemo(); }
  catch (err) { failure = err instanceof AdminUsersError ? { status: err.status, message: err.message } : { status: 503, message: 'Não foi possível verificar o acesso administrativo.' }; }
  if (failure) return <main className="flex min-h-screen w-full items-center justify-center bg-gray-950 p-6 text-white"><div className="max-w-lg border-l-2 border-orange-500 pl-6"><p className="text-xs uppercase tracking-widest text-orange-300">Administração · {failure.status}</p><h1 className="mt-3 text-2xl font-semibold">{failure.status === 503 ? 'Demonstração indisponível' : 'Acesso restrito'}</h1><p className="mt-3 text-sm leading-relaxed text-gray-400">{failure.message}</p><p className="mt-3 text-xs text-gray-500">Módulo local simulado. Nenhuma alteração em produção ou envio de e-mail.</p><Link href={failure.status === 401 ? '/auth/login' : '/dashboard'} className="mt-6 inline-block rounded-lg border border-gray-700 px-4 py-2 text-sm">{failure.status === 401 ? 'Entrar novamente' : 'Voltar ao dashboard'}</Link></div></main>;
  return <AdminUsersShell><AdminUsersDashboard /></AdminUsersShell>;
}
