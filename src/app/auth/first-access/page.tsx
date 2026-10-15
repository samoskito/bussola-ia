import Link from 'next/link';
import { getAdminUsersMode } from '@/lib/admin-users/config';
import FirstAccessForm from './FirstAccessForm';

export const dynamic = 'force-dynamic';

export default function FirstAccessPage() {
  if (getAdminUsersMode() !== 'live') return <main className="flex min-h-screen items-center justify-center bg-gray-950 p-6 text-white"><section className="max-w-md border-l-2 border-orange-500 pl-6"><p className="text-xs uppercase tracking-widest text-orange-300">ExecutivIA</p><h1 className="mt-3 text-2xl font-semibold">Primeiro acesso indisponível</h1><p className="mt-3 text-sm leading-relaxed text-gray-400">A definição de senha por convite ainda não está habilitada neste ambiente. Solicite orientação ao administrador.</p><Link className="mt-5 inline-block text-sm text-orange-300 underline" href="/auth/login">Ir para a entrada</Link></section></main>;
  return <FirstAccessForm />;
}
