import { cookies } from 'next/headers';
import Link from 'next/link';
import { CONSENT_COOKIE, readConsent, requireMcpSessionAdmin } from '@/lib/insights-mcp/oauth-server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Conectar insights — Bússola IA', robots: { index: false, follow: false } };

export default async function InsightsMcpConsentPage() {
  let clientName: string;
  let nonce: string;
  let redirectHost: string;
  try {
    const userId = await requireMcpSessionAdmin();
    const jar = await cookies();
    const consent = await readConsent(jar.get(CONSENT_COOKIE)?.value, userId);
    clientName = consent.clientName;
    nonce = consent.nonce;
    redirectHost = new URL(consent.request.redirectUri).host;
  } catch {
    return <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <section className="max-w-lg rounded-2xl border border-gray-800 bg-gray-900 p-8 space-y-5">
        <h1 className="text-2xl font-semibold">Conexão indisponível</h1>
        <p className="text-gray-300">Este pedido expirou, não está habilitado ou sua conta não tem permissão. Inicie novamente a conexão pelo Claude ou ChatGPT com uma conta administradora da Bússola.</p>
        <Link href="/dashboard/insights" className="inline-block text-orange-400 underline">Voltar aos insights</Link>
      </section>
    </main>;
  }
  return <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
    <section className="max-w-lg rounded-2xl border border-gray-800 bg-gray-900 p-8 space-y-6" aria-labelledby="consent-title">
      <p className="text-sm font-medium text-orange-400">Bússola IA · Insights</p>
      <h1 id="consent-title" className="text-2xl font-semibold">Conectar {clientName}?</h1>
      <p className="text-gray-300">Ao autorizar, você permite que este aplicativo consulte os insights em seu nome nas conversas em que usar o conector.</p>
      <p className="text-sm text-gray-400">Após sua decisão, você será encaminhado para <span className="font-medium text-gray-200">{redirectHost}</span>.</p>
      <ul className="list-disc pl-5 text-gray-300 space-y-2">
        <li>Ler volumes, cobertura, temas e tendências das quatro IAs.</li>
        <li>Comparar períodos e consultar os exemplos que a Bússola disponibilizar.</li>
      </ul>
      <p className="text-sm text-gray-400">Os dados consultados serão enviados ao aplicativo conectado. Exemplos ficam desabilitados até uma revisão específica para compartilhamento. O conector não altera contas ou acessos, não lê conversas completas e não inicia classificações.</p>
      <p className="text-sm text-gray-400">A permissão depende de sua conta continuar administradora. Você pode desconectar o aplicativo e solicitar a revogação na Bússola.</p>
      <form action="/api/insights-mcp/oauth/authorize" method="post" className="flex flex-wrap gap-3">
        <input type="hidden" name="csrf" value={nonce} />
        <button type="submit" name="decision" value="approve" className="rounded-lg bg-orange-500 px-5 py-3 font-semibold text-black hover:bg-orange-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-300">Autorizar somente leitura</button>
        <button type="submit" name="decision" value="deny" className="rounded-lg border border-gray-600 px-5 py-3 hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">Cancelar</button>
      </form>
    </section>
  </main>;
}
