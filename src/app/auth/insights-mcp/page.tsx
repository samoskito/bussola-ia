import { cookies } from 'next/headers';
import Link from 'next/link';
import ConsentForm from './ConsentForm';
import { CONSENT_COOKIE, readConsent, requireMcpSessionAdmin } from '@/lib/insights-mcp/oauth-server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Conectar insights — Bússola IA', robots: { index: false, follow: false } };

export default async function InsightsMcpConsentPage() {
  let clientName: string;
  let nonce: string;
  let redirectHost: string;
  let local: boolean;
  try {
    const userId = await requireMcpSessionAdmin();
    const jar = await cookies();
    const consent = await readConsent(jar.get(CONSENT_COOKIE)?.value, userId);
    clientName = consent.clientName;
    nonce = consent.nonce;
    const redirect = new URL(consent.request.redirectUri);
    redirectHost = redirect.host;
    local = redirect.protocol === 'http:';
  } catch {
    return <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <section className="max-w-lg rounded-2xl border border-gray-800 bg-gray-900 p-8 space-y-5">
        <h1 className="text-2xl font-semibold">Conexão indisponível</h1>
        <p className="text-gray-300">Este pedido expirou, não está habilitado ou sua conta não tem permissão. Inicie novamente a conexão pelo Claude, Claude Code ou ChatGPT com uma conta administradora da Bússola.</p>
        <Link href="/dashboard/insights" className="inline-block text-orange-400 underline">Voltar aos insights</Link>
      </section>
    </main>;
  }
  return <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
    <section className="max-w-lg rounded-2xl border border-gray-800 bg-gray-900 p-8 space-y-6" aria-labelledby="consent-title">
      <p className="text-sm font-medium text-orange-400">Bússola IA · Insights</p>
      <h1 id="consent-title" className="text-2xl font-semibold">Conectar {clientName}?</h1>
      <p className="text-gray-300">Ao autorizar, você permite que este aplicativo consulte os insights em seu nome nas conversas em que usar o conector.</p>
      <p className="text-sm text-gray-400">Após sua decisão, você será encaminhado para <span className="font-medium text-gray-200">{local ? `este computador (${redirectHost})` : redirectHost}</span>.</p>
      {local && <p className="rounded-lg border border-orange-500/40 bg-orange-500/10 p-3 text-sm text-orange-200">Conexão com um aplicativo instalado neste computador, como o Claude Code. Só autorize se você acabou de iniciar esta conexão aqui; caso contrário, clique em Cancelar.</p>}
      <ul className="list-disc pl-5 text-gray-300 space-y-2">
        <li>Ler volumes, cobertura, temas e tendências das quatro IAs.</li>
        <li>Comparar períodos e consultar os exemplos que a Bússola disponibilizar.</li>
        <li>Ler o texto integral das perguntas e mensagens enviadas pelos alunos, com data, IA, tema, cargo cadastrado e identificadores pseudônimos da pessoa e da conversa.</li>
      </ul>
      <p className="text-sm text-gray-400">Os dados consultados, inclusive o texto das perguntas dos alunos, serão enviados ao aplicativo conectado. Esse texto não é anonimizado e pode conter informações que o próprio aluno digitou; nome, e-mail e telefone do cadastro não são enviados, e mensagens de administradores ficam de fora. O conector não altera contas ou acessos e não inicia classificações.</p>
      <p className="text-sm text-gray-400">A permissão depende de sua conta continuar administradora. Você pode desconectar o aplicativo e solicitar a revogação na Bússola.</p>
      <ConsentForm nonce={nonce} />
    </section>
  </main>;
}
