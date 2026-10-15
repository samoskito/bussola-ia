# Revisão final administrativa — 15/10/2026

**Atualização após correções autorizadas: os dois achados de código foram resolvidos localmente.** Permanecem preflight do Supabase/hospedagem, autorização de migrations/publicação e teste real controlado. Nenhuma migration remota aplicada, publicação ou novo envio real nesta rodada.

## Correções verificadas

- Edição exige quatro entradas explícitas de acesso, com habilitação e validade por IA; UI preserva datas e apresenta revisão por IA. Cadastro mantém data comum. DTO materializa o menor limite global/individual; transição para Personalizado preserva vigência efetiva e não reativa outros agentes. Upsert não modifica IDs/timestamps de grants persistidos inalterados. Prazo passado só pode ser preservado quando já habilitado com a mesma validade. Backend rejeita payload legado, duplicados, datas inválidas e extras.
- Recuperação sempre prefere RPC após preflight barato e bcrypt, independente das flags do painel. `PASSWORD_RESET_ATOMIC_REQUIRED=true` proíbe fallback por ausência/cache da função; exigência também vale com painel live/escrita ativos. Antes da migration, só ausência precisa de nome/assinatura da RPC permite compatibilidade legada. Falhas de rede/permissão/RPC nunca acionam legado. Logs de erro foram sanitizados.
- Conflito409 agora fecha o editor e exige reabrir a ficha atualizada; não reaproveita draft antigo com revisão nova.
- Chave OpenAI detectada apenas como presença em .env.local; gates de processamento/IA false e orçamento0. Nenhuma chamada paga. Destinatário futuro de teste informado; não houve criação/envio para ele nesta rodada.

Os achados abaixo preservam a evidência da revisão original; seus estados de código foram superados pelas correções acima.

Escopo: painel administrativo e primeiro acesso, independentemente de Hotmart direta/OpenAI/MCP. Base funcional `675ed7c`, branch `codex/admin-users-demo`. Fetch confirmou quatro commits à frente e zero atrás de origin/main; documentação local ainda não commitada. Alterações funcionais futuras exigem nova revisão e SHA candidato.

## Achados

### P2 — edição uniformiza validades por IA

`src/components/admin-users/AdminUsersDashboard.tsx:77-87` e `src/lib/admin-users/types.ts:69-73`: formulário/contrato usam somente expiresAt comum. `supabase/migrations/20261015000001_admin_users.sql:273-277`: operação substitui todos os grants com essa data, removendo validade global. Existe aviso/confirmação para datas divergentes, mas não é possível renovar/revogar uma IA mantendo as datas diferentes das demais. A compra pontual P1, com LinkedIn2027 e demais IAs2026, demonstra o caso real que precisa ser preservado.

Resolvido na rodada autorizada seguinte: edição por IA com validação demo/repositório/SQL, preservação de vigência e auditoria, revisão de concorrência e testes ampliados. Migration preparada foi editada localmente; não aplicada em produção.

### P2 — rollback do painel reabre consumo legado de senha

`src/app/api/auth/reset-password/route.ts:61-66`: consumidor transacional depende de modo live e escrita administrativa. Desligar flags faz retornar ao trecho legado não atômico `69-96`, inclusive em cenário de versões/requisições concorrentes com convites ativos. A proteção testada atualmente cobre consumidores seguros simultâneos, não essa transição.

Resolvido na rodada autorizada seguinte: RPC independente dos gates + exigência dedicada PASSWORD_RESET_ATOMIC_REQUIRED. Teste de desligamento concorrente e convite/reset em ambas as ordens passou. O rollout ainda precisa fixar essa flag e drenar versões antigas; rollback não pode escolher artefato anterior à correção.

## Dependências operacionais

- Índice normalizado em `20261015000001_admin_users.sql:14` afeta escritores externos. Conferir inserts/upserts/retries do n8n com variações de caixa/espaços; conflito pode retornar23505 mesmo se writer só tratar unicidade literal.
- Auditoria nova usa FK `admin_user_audit.user_id ON DELETE RESTRICT` (`...admin_users.sql:24`), afetando exclusões externas futuras de usuários auditados. Não é defeito por si só; verificar compatibilidade e retenção.
- Revisão otimista protege contra mudanças externas anteriores ao salvamento, mas não impede n8n de sobrescrever acesso posteriormente. Integração direta e proteção de origem/manual continuam fora desta entrega.
- Novas roles/default grants/policies, schema completo e compatibilidade Supabase real precisam conferência antes das migrations; fixture isolada não comprova esses aspectos do projeto remoto.
- Novo convite live ainda exige teste completo conta nova → convite → senha definida pelo destinatário → login → auditoria. Envio SMTP pontual P2 usou fluxo legado e não comprova esse caminho novo.
- URLs de convite (`ADMIN_USERS_APP_URL`) e recuperação (`EMAIL_APP_URL`/APP_URL/NEXT_PUBLIC_APP_URL) são distintas. Revisar ambas; .env.local tem localhost. SMTP aceitou envio pontual anterior; Brevo API retornou401 e não deve ser presumida funcional.
- Build ignora erros TypeScript/ESLint por configuração existente; usar resultado do typecheck independente e tratar14 diagnósticos globais legados de forma explícita.

## Verificações realizadas nesta revisão

| Verificação local | Resultado |
| --- | --- |
| npm run test:admin-users | 42/42 passaram após correções (inclui8 regressões de reset) |
| npm run test:insights | 18/18 passaram |
| npm run test:mcp | 6/6 passaram; primeira tentativa HTTP bloqueada pelo sandbox, repetição autorizada passou |
| node tests/admin-users/typecheck.cjs | 0 diagnósticos escopados; 14 globais legados |
| npm run test:admin-users:postgres | passou novamente, duas migrations somente na fixture temporária, cenários mistos/globais/cap residual e concorrência; cleanup concluído |
| Build de produção isolado | passou novamente (exit0), 38/38 páginas; via scripts/validate-admin-build-isolated.cjs |
| Navegador administrativo após correções | passou, zero pageerrors; dados sintéticos/APIs interceptadas, desktop/mobile, datas mistas, renovação/revogação individual e409 |

Build final após a última mudança UI repetido em `.local-backups/admin-release-build-2026-10-15T16-22-07-905Z`, sem copiar .env/.git/.next original/backups; ambiente filho em whitelist, Supabase loopback e credenciais sintéticas, módulos desativados e telemetria desligada. Dependências locais reaproveitadas por junction; fonte pública Google permitida. Não alterou o .next da demonstração. Warnings existentes: caniuse-lite desatualizado, dependência dinâmica @supabase/realtime-js via api/chats e aviso de edge runtime sem geração estática. Typecheck/lint continuam ignorados no build por configuração, conforme ressalva acima.

Navegador executado em cópia dev temporária sem .env, porta3101/loopback com sessão sintética e todas as APIs interceptadas. Servidor temporário encerrado. Evidências em `.local-backups/admin-fixes-browser/`; revisão mobile inspecionada visualmente. Essas imagens não contêm usuários reais. As18 verificações de domínio/repositório e8 de reset são subconjuntos dos42 administrativos; total de suítes Node:66, sem duplicar contagens.

Revisores não encontraram bypass concreto de autorização no escopo examinado. Foram conferidos JWT/papel atual, revalidação SQL, campos permitidos/origem, RLS e revogações, proteção de contas admin, snapshots/locks, tokens hash/uso único/fingerprint. Isso é revisão estática e testes locais, não certificação do ambiente remoto.

Delegação: GPT-6 Astra/high backend/SQL; GPT-6.1 Sol/high interface/convites; GPT-6.1 Sol/high validação local. Agente de interface também executou10 testes específicos (já incluídos nos30 administrativos, não somar novamente).

## Próximos passos e limites

Roteiro completo: `docs/plans/2026-10-15-admin-publicacao.md`. Dois achados corrigidos e checks repetidos; destinatário informado, confirmar sua inexistência novamente antes de criar em etapa real. Ainda falta revisão operacional real, backup completo e autorização. Apresentar SHA, diff, migrations e etapas de ativação para autorização explícita. Nenhum push/merge/deploy feito; chave inserida pelo usuário e conferida apenas por presença, sem chamada paga.
