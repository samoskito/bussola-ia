# Handoff — painel de usuários local

## Atualização posterior: preparação da persistência real

Usuário testou demo e aprovou inicialmente; prioridade confirmada: terminar painel antes de focar Hotmart direta. A seção original abaixo descreve a entrega demo, agora complementada por um caminho real PREPARADO E DESATIVADO.

- Adaptador RPC para users/acessos/auditoria e duas migrations `20261015000001_admin_users.sql` e `20261015000002_admin_invitations.sql`. Migrações não reescrevem cadastros, mas criam índice único de e-mail trim/lower; duplicidades abortam antes da criação. Em operação, as RPCs alteram fontes e auditoria na mesma transação, verificam admin atual e revisão por snapshot completo, incluindo mudanças externas/n8n.
- Flags `ADMIN_USERS_LIVE_ENABLED`, `ADMIN_USERS_WRITES_ENABLED`, `ADMIN_USERS_EMAIL_ENABLED` todas false no exemplo. Modo live só com opt-in; sem alteração nos envs existentes. Demo continua ativo localmente.
- Convites reais preparados por SMTP/Brevo: origem fixa `ADMIN_USERS_APP_URL`, token em fragmento (`/auth/first-access#token=...`), hash, 1h, reemissão/consumo único e cooldown. E-mail falho não é tratado como enviado; aceitação pelo provedor não prova entrega. Senha nova substitui anterior se houver, sem mudar acesso às IAs; UI exige motivo/revisão.
- Verificação barata do convite antes do bcrypt; fingerprint invalida convite após mudança independente de senha. Edição/reuso de e-mail invalida tokens legados. Recuperação existente passa a usar consumo atômico compartilhado somente quando live+writes ativos; resolve disputa entre convite e reset antigo. Fluxo legado original permanece quando não ativado.
- Datas inclusivas de acesso em America/Sao_Paulo alinhadas entre painel/SQL e helper dos chats. Sem mudança no contrato n8n.
- Testes SQL reais em Docker já instalado, postgres17-alpine: container temporário, sem rede, portas ou volumes; removido ao final. Duas migrations aplicadas somente ao schema sintético. Verificados permissões, duplicidades, rollback inicial, revogação global/parcial, snapshots externos, concorrência de revisão e de definição/reset de senha, uso único e auditoria sem tokens.
- Suíte administrativa expandida; typecheck de todos os caminhos tocados sem diagnósticos (14 legados globais). Regressão Insights e navegador demo desktop/mobile passaram. PostgreSQL isolado não equivale à validação do Supabase real/SMTP/produção; não declarar painel real concluído/publicado.

### Pré-requisito de identidades resolvido; ativação ainda pendente

Atualização em 15/10/2026, 12:21 BRT: reconciliação EXECUTADA e verificada após confirmação humana. Seis contas sem histórico removidas, 24 grants dependentes removidos; duas validades ajustadas. Cinco contas principais, senhas, permissões, 26 chats e 91 scripts preservados. Auditoria completa posterior: 1693 usuários, zero duplicidades trim/lower e zero e-mails vazios/nulos. Backup DPAPI privado verificado antes da execução. Evidências e datas em `docs/plans/2026-10-15-approved-identity-reconciliation.md`. Nenhuma migration, publicação, ativação live ou mensagem real nesta etapa.

Auditoria GET-only de 15/10/2026 (`scripts/audit-admin-users-readonly.cjs`, relatório `docs/audits/2026-10-15-admin-users-readonly.json`): schema UUID/date necessário existe; 1699 usuários, 5 grupos de e-mails duplicados por trim/lower e 1 e-mail vazio. Nenhuma conta alterada e nenhum e-mail/hash pessoal salvo no relatório. Políticas, triggers, constraints e privilégios não auditados via Data API. Presença de configurações SMTP/Brevo confirmada sem expor valores; entrega não testada.

Usuário não tem Supabase separado de teste. Ambiente PostgreSQL temporário resolveu validação da lógica SQL local; identidades revisadas e reconciliadas com autorização explícita. Ainda falta revisar plano de ativação/migrations, schema e permissões exigidas pelas RPCs, definir destinatário de teste autorizado, origem HTTPS e publicação. A consulta SQL real confirmou as relações e o gatilho das tabelas users/user_agent_access para esta limpeza; não substitui a revisão completa de ativação. Migração continuará abortando se novas duplicidades surgirem.

ClickUp: [preparação local concluída](https://app.clickup.com/t/17ty0uzry31), [revisão de identidades concluída](https://app.clickup.com/t/17ty0uzry32), [validação/ativação futura](https://app.clickup.com/t/17ty0uzry33). Implementação Hotmart direta espera conclusão/aceite do painel; nenhum webhook n8n/Hotmart alterado.

Comandos: `npm run test:admin-users`, `npm run test:admin-users:postgres` (requer Docker; usa somente fixture isolada), `node tests/admin-users/typecheck.cjs`. Nenhum pacote instalado nesta etapa.

Entrega em 15/10/2026: demonstração local implementada. Não há persistência/alterações reais, migrations, envio de e-mail, Hotmart direta ou publicação. Plano independente de Insights/OpenAI/MCP.

Branch local: `codex/admin-users-demo`, criada a partir da base que contém a demonstração Insights/MCP. Sem push. O plano comercial/admin e o plano OpenAI/MCP continuam em listas ClickUp separadas.

## Abrir

```powershell
$env:ADMIN_USERS_MODE = 'demo'
node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3100
```

Abrir `http://localhost:3100/dashboard/users` com sessão administrativa existente. Menu admin: Usuários e acessos. Se usar 127.0.0.1 em vez de localhost, o cookie de sessão não é compartilhado entre hosts. O servidor desta entrega foi iniciado somente em loopback. Pode precisar reiniciar em outra sessão.

O módulo usa a autenticação existente: somente a verificação de sessão/papel atual pode ler o Supabase. Usuários, acessos e auditoria deste painel são todos fictícios, em memória do processo. Nenhum usuário/senha de teste criado no banco. Reiniciar/reciclar processo perde alterações demo; não suporta persistência entre instâncias. `ADMIN_USERS_MODE` padrão disabled; demo bloqueada em NODE_ENV production; live não implementado.

## Implementado

- 12 fixtures com e-mails .example, incluindo global Todas/Ambas, individual, expirado, sem acesso e admin vitalício.
- Busca nome/e-mail/telefone, filtros IA/situação, paginação, ficha com acesso efetivo e origem/validade.
- Cadastro de usuário comum e edição nome/e-mail/telefone; revisão antes/depois, motivo e histórico, validação de duplicidade.
- Seleção das quatro IAs e validade comum. Plano global vira Personalizado ao salvar; seleção inicial preserva permissões expiradas para renovação. Datas iguais preservadas; diferenças exigem confirmação. Admin vitalício não editável pela UI/acesso.
- APIs com autorização corrente no servidor, checagem de origem, campos permitidos e revisão otimista.
- Convite: gerar/copiar link, simular e-mail e abrir `/auth/update-password/demo`. Token hash, 1h exata, reemissão invalida anterior, edição de e-mail invalida token e consumo único. Nunca chamar forgot/reset-password reais pela demo. Senhas digitadas na tela fictícia não são transmitidas/persistidas; nenhuma credencial real é criada.
- Layout de autenticação permite abrir somente a tela demo específica mesmo logado, para prévia do admin. Restante do fluxo mantém redirecionamento existente.

## Validação

- `npm run test:admin-users`: 16 testes offline passaram, incluindo rotas/papel atual/origem, gates, expiração São Paulo, revisões, acesso e convites.
- `node tests/admin-users/typecheck.cjs`: zero diagnósticos no módulo/navegação/layout tocado; 14 erros globais legados permanecem.
- 18 testes Insights passaram como regressão.
- `tests/admin-users/browser.cjs`: Chrome desktop/mobile passou, criação/edição/revisão de acesso, seleção de expirados, filtros, convite/envio simulado, página pública demo/consumo único, bloqueio user e API503. Todas APIs interceptadas com sessão sintética e domínio offline; não prova login admin real.
- HTTP real local sem sessão: GET users/audit retornaram401 com no-store, sem lookup do banco após falta de cookie.
- Capturas `docs/audits/admin-users-demo-desktop.png` e `admin-users-demo-mobile.png` revisadas. Nenhum build de produção desta nova funcionalidade realizado; renderização dev/compilação de rotas e typecheck escopado verificados.

Para repetir navegador: definir `ADMIN_BROWSER_MODULES` como diretório de pacotes do runtime e `ADMIN_BROWSER_EXECUTABLE` como Chrome instalado; iniciar servidor demo e rodar `node tests/admin-users/browser.cjs`. A sessão falsa fica só no contexto do teste. Não existe bypass de autenticação na aplicação.

## Próximos passos

Integrar banco real somente após validar schema, necessidade de migration, atomicidade/auditoria e autorizar ativação. Fluxo real de primeiro acesso deve reaproveitar suporte SMTP/Brevo existente após revisar consumo transacional único, limites de emissão/envio e origem confiável dos links. Não basta trocar a flag: nenhum modo live existe neste módulo.

Aguardar payloads e export sanitizado do n8n para planejar Hotmart direta. Regras aprovadas: preencher somente campos vazios, preservar divergentes com revisão, preservar acesso manual até decisão admin. Não desativar n8n de chats; transição comercial deve evitar escrita/convites duplicados.

ClickUp: lista `1400710000001966`; [entrega demo concluída](https://app.clickup.com/t/17ty0uzrxy1). Demais tarefas reais permanecem abertas; documentação de planejamento em `2026-10-15-admin-usuarios-brainstorm.md` e design em `2026-10-15-admin-usuarios-design.md`.

## Liberação pontual autorizada — compra P1, 15/10/2026

Primeiro payload ExecutivIA mensal analisado; não guardar payload integral, hottok, CPF ou dados pessoais no Git/ClickUp. Conta existente preservada (11 chats, 40 scripts). Usuário autorizou explicitamente manter LinkedIn até 22/09/2027 e habilitar apresentacao/comunicacao/conversas_dificeis até 05/11/2026, preenchendo somente seis campos vazios de endereço e mantendo nome divergente atual.

EXECUTADO em transação SQL protegida por snapshot, locks e checagem de credencial/permissões/histórico. Plano passa a Personalizado; data global 22/09/2027 preservada, validade por grant controla as três IAs novas e grant LinkedIn integralmente preservado. Nome, telefone, senha e demais dados existentes inalterados. Backup DPAPI com roundtrip verificado em .local-backups; verificação GET independente comparou perfis/grants/vínculos com backup e passou. Evidências privadas norberto-access-result.json e captura de permissões no mesmo diretório ignorado.

Nenhuma migration, publicação, automação Hotmart, e-mail ou nova conta. Registro operacional local desta alteração pontual; não existe ainda ledger comercial/idempotência integrado. Segundo payload pendente de recebimento; não presumir autorização de acesso/duração para outro comprador. Integração comercial n8n continua existente e poderá escrever no banco; a proteção automática de concessões manuais ainda depende da integração futura planejada.

## Cadastro e primeiro acesso autorizados — compra P2, 15/10/2026, 12:35 BRT

Usuário confirmou criar a segunda compradora com quatro IAs até 11/11/2026 e enviar link de definição de senha ao e-mail do payload. Cadastro criado em public.users como user, plano Todas e data_expiracao 2026-11-11; este plano global já libera as quatro IAs, sem necessidade de grants redundantes. ID UUID explícito e bootstrap bcrypt aleatório, sem senha conhecida/exposta. Dados cadastrais limitados às colunas existentes de nome/e-mail/telefone/endereço; CPF/complemento e payload completo não foram inseridos em colunas improvisadas. Pré/pós-varredura normalizada confirmou uma única conta para o e-mail.

Operação e dados de recuperação privados sob DPAPI CurrentUser, com roundtrip verificado, em .local-backups/andrea-approved-operation.dpapi; resultado privado em andrea-approved-result.json. Nenhum hottok/token pessoal bruto salvo em Git/ClickUp. Etapas separadas create/send/verify com proteção contra recriação e reenvio não intencional.

Link usa fluxo existente /auth/update-password?token=...&email=..., token aleatório32bytes, apenas SHA256 no banco, validade até15/10/2026 13:34 BRT. Origem pública https://bussola-ia.vercel.app verificada HTTP200; .env.local contém NEXT_PUBLIC_APP_URL localhost e não foi usado para o link real. Não alterar esse ambiente local. Template existente password_reset e helpers reaproveitados sem publicar código. API Brevo retornou401 (envio NÃO aceito); fallback SMTP com mesmo link foi aceito para o destinatário, sem rejeições. Provedor aceitou mensagem; leitura/entrega à caixa de entrada e definição efetiva de senha dependem da destinatária. Teste não consumiu token nem definiu senha por ela.

Verificação GET após envio: conta única, dados/nível/plano/validade corretos, token correspondente existente e válido, credencial bootstrap intacta. Nenhuma migration, publicação, ativação do painel, replay de webhook, n8n ou OpenAI. As duas compras solicitadas estão atendidas (P1 conta existente; P2 nova conta + envio SMTP). Integração comercial automática permanece pendente. Para futura ativação do painel, revisar credencial Brevo API (401); SMTP funcional nesta operação. Não trocar credenciais automaticamente nem expô-las no chat.

## Revisão final e roteiro — 15/10/2026

Preparação delegada concluída, sem aplicar migrations/publicar ou novos envios. Relatório docs/audits/2026-10-15-admin-final-review.md e roteiro docs/plans/2026-10-15-admin-publicacao.md. Duas pendências de código antes de ativar escrita: preservar validades diferentes por IA (contrato atual uniformiza) e desvincular segurança do consumo transacional de reset das flags de desligamento do painel. Não foram corrigidas nesta revisão somente leitura.

Checks: 30 admin,18 Insights,6 MCP passaram; PostgreSQL temporário passou e removido; typecheck administrativo0/global14 legados; build de produção passou em cópia isolada com credenciais sintéticas,38 páginas. Não substitui teste Supabase/SMTP/primeiro acesso real. Origin/main atualizado: branch4 à frente/0 atrás; nenhum push. Destinatário de teste ainda pendente. Usuário informou ter chave OpenAI; orientação de inserção local em OPENAI_API_KEY, sem recebê-la no chat e mantendo todos gates/custo desativados. Nenhuma chave configurada/validada nesta etapa. Plano admin permanece separado de Insights e Hotmart direta.

## Correções pré-publicação concluídas — 15/10/2026

Usuário autorizou implementar os dois achados e repetir checks, sem migrations remotas/publicação. Edição agora envia access com quatro entradas explícitas agentType/enabled/expiresAt, datas individuais preservadas e revisão por IA. Cadastro segue data comum. Backend/SQL rejeitam payload legado e entradas inválidas; snapshot/locks/auditoria mantidos. Conversão global e retirada de cap materializam vigência efetiva sem ampliar outras IAs; grants persistidos iguais preservam IDs/timestamps.409 descarta draft e exige reabertura.

Reset prefere RPC em todos os modos após preflight barato; PASSWORD_RESET_ATOMIC_REQUIRED=true impede fallback após migration mesmo com painel desligado. Antes da migration só ausência precisa da função/assinatura permite compatibilidade legada; demais erros falham fechado. Roteiro exige essa flag na versão nova e drenagem das antigas; não restaurar código anterior durante rollback com convites ativos. Migration00002 teve apenas comentário atualizado nesta rodada; migration00001 preparada passou a aceitar contrato granular, ainda NÃO aplicada remotamente.

Validação final:42 testes administrativos +18 Insights +6 MCP =66 passaram; PostgreSQL temporário ampliado passou e removido; browser mock desktop/mobile passou e servidor temporário3101 encerrado; typecheck escopado0/global14 legados; build final isolado passou38 páginas sem envs reais. Relatório e roteiro atualizados em docs/audits/2026-10-15-admin-final-review.md e docs/plans/2026-10-15-admin-publicacao.md. Script scripts/validate-admin-build-isolated.cjs reproduz build sem .env/segredos.

E-mail futuro de teste escolhido pelo usuário: suporte@palmup.com.br. Não criamos conta nem enviamos mensagem nesta rodada. OPENAI_API_KEY presente em .env.local, conferida só como booleano; IA/processamento desativados e orçamento0, nenhuma chamada paga. Supabase/SMTP/hospedagem reais ainda precisam preflight/autorização/validação do rollout. Hotmart direta permanece adiada; n8n atual não foi alterado. Nenhum push/deploy/migration remota.

## Preflight remoto somente leitura — 15/10/2026

Concluído em docs/audits/2026-10-15-admin-production-preflight.md. SQL BEGIN READ ONLY + metadata/contagens:1694 usuários,0 duplicidades/0vazios, teste futuro ainda sem conta. Schema/constraints/RLS/privilégios compatíveis; novas tabelas/RPC/índice não instalados. Chave anon GET count-only retornou0 linhas visíveis nas quatro fontes. PostgreSQL real15.8; testes sintéticos completos repetidos em postgres15.8-alpine passaram, container removido.

Backup diário mais recente15/10 00:53:56 BRT, anterior às operações do dia; Restore disponível mas não exercitado; PITR não ativado. Precisa cópia atual recuperável antes da aplicação. Após troca de login pelo usuário, Vercel samoskitos-projects/bussola-ia acessível; produção Ready2248dcd, main/publicação automática, domínio principal ia.bussolaexecutiva.com.br. Candidato funcional fa635a5. Nove envs persistidas de projeto, nenhuma Shared. Ausentes trio Supabase, flags admin, flag reset atômico e origem convite; segredos não revelados. EMAIL_APP_URL usa alias vercel válido; orientar domínio principal no novo convite. Cron geral habilitado mas nenhum job configurado; rotas admin/Insights ainda404 na produção.

Pendências antes de aplicar/publicar: backup atual, configurar envs explicitamente na versão nova, conferir compatibilidade do fluxo comercial n8n com índice normalizado e exclusões auditadas. Sem acesso/export do fluxo atual aqui. Migrations/publicação/alterações de env NÃO autorizadas/executadas nesta rodada. Nenhum envio real/OpenAI/Hotmart direta. Artefatos SQL/JSON não contêm dados pessoais de contas, apenas schema e agregados.
