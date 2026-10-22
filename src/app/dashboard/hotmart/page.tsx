import Link from 'next/link';
import AdminUsersShell from '@/components/admin-users/AdminUsersShell';
import HotmartDashboard from '@/components/hotmart/HotmartDashboard';
import { AdminUsersError, getAdminUsersMode, requireAdminUsersEnabled } from '@/lib/admin-users/config';

export const dynamic = 'force-dynamic';

export default async function HotmartAdminPage() {
  let failure: { status: number; message: string } | null = null;
  try {
    requireAdminUsersEnabled();
    if (getAdminUsersMode() !== 'live') throw new AdminUsersError(503, 'hotmart_admin_requires_live', 'A tela Hotmart exige o painel administrativo em modo real.');
  } catch (err) {
    failure = err instanceof AdminUsersError ? { status: err.status, message: err.message } : { status: 503, message: 'Não foi possível verificar o acesso administrativo.' };
  }
  if (failure) return <main className="flex min-h-screen w-full items-center justify-center bg-gray-950 p-6 text-white"><div className="max-w-lg border-l-2 border-orange-500 pl-6"><p className="text-xs uppercase tracking-widest text-orange-300">Hotmart · {failure.status}</p><h1 className="mt-3 text-2xl font-semibold">Integração Hotmart indisponível</h1><p className="mt-3 text-sm leading-relaxed text-gray-400">{failure.message}</p><Link href="/dashboard" className="mt-6 inline-block rounded-lg border border-gray-700 px-4 py-2 text-sm">Voltar ao dashboard</Link></div></main>;
  // A autorização real (papel admin atual) é revalidada em cada API.
  return <AdminUsersShell mode="live" title="Hotmart" notice="Mapeamento de ofertas, eventos recebidos e revisões. Acessos manuais nunca são reduzidos sem sua decisão."><HotmartDashboard /></AdminUsersShell>;
}
