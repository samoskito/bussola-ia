# CLAUDE.md - Guia vivo do projeto Bussola IA / ExecutivIA

Este arquivo e a memoria persistente do projeto. Em um chat novo, comece por aqui antes de propor arquitetura, corrigir bugs ou implementar novas funcionalidades.

## Estado Atual

- Projeto: Bussola IA / ExecutivIA.
- Produto: SaaS em portugues do Brasil para conversas com agentes de IA externos via n8n.
- Producao conhecida: `https://bussola-ia.vercel.app`.
- Remoto Git: `origin https://github.com/samoskito/bussola-ia.git`.
- Branch principal atual: `main`.
- Evolucoes recentes ja mergeadas/deployadas: `feature/four-ai-agents-access` e `feature/admin-only-coming-soon-agents`.
- Stack: Next.js 15.3.8 App Router, React 19.1.0, TypeScript 5.4.5, Tailwind CSS, Supabase PostgreSQL/Storage, JWT proprio em cookie httpOnly.
- IA do chat: o app envia mensagens para webhooks n8n e espera que o n8n atualize `scripts.output`. O modulo local de Insights agora tem adaptador OpenAI separado, desativado por padrao e ainda nao executado.
- Estado do codigo em 2026-07-27: quatro agentes cadastrados e liberados para usuarios com acesso valido. `postagem` saiu do modo de manutencao/admin-only.
- Ajuste publicado em 2026-07-16: o compositor do chat foi mantido visivel no celular mesmo quando o aviso de expiracao ocupa espaco. A correcao cobre conversa nova, chat existente e rotas legadas compativeis.

Antes de novas implementacoes, rode:

```bash
git fetch origin --prune
git status --short --branch
git rev-list --left-right --count HEAD...origin/main
```

## Comandos

```bash
npm run dev
npm run build
npm start
npm run lint
npx tsc --noEmit --pretty false
```

Atencao: `next.config.js` ignora erros de TypeScript e ESLint durante build. Use `npx tsc --noEmit --pretty false` para checar tipos. Em 2026-06-29 existe um erro conhecido fora do fluxo de agentes em `src/app/dashboard/profile/page.tsx:748` (`TS1382`).

## Estrutura Principal

```text
src/
  app/
    api/
      auth/                         login, logout, session, forgot/reset password
      chats/                        rotas de chat, agentes e historico
        create-agent/               criacao generica por agentType
        message-agent/              envio generico por agent_type do chat
        create/                     legado compat: comunicacao
        message/                    legado compat: comunicacao
        create-apresentacao/        legado compat: apresentacao
        message-apresentacao/       legado compat: apresentacao
      user/                         perfil, avatar, senha
      webhook/                      callback n8n por scriptId; fallback legado por webhook_id
    dashboard/
      agent/[agentType]/            entrada generica de qualquer agente
      chat/[chatId]/                conversa individual
      page.tsx                      selecao dos agentes
      select-agent/                 selecao alternativa dos agentes
      profile/                      perfil/admin email template
    script/                         entrada legada para comunicacao
  components/
    access/                         avisos/bloqueios de plano e expiracao
    chat/                           ChatInterface, ChatDetail, fluxo legado Enhanced
    layout/                         Header, Sidebar, MobileMenu
  contexts/AuthContext.tsx
  lib/
    agents.ts                       catalogo publico dos agentes
    agent-access.ts                 permissao server-side por agente
    access-control.ts               helper de UI legado/plano
    server/
      agent-webhooks.ts             webhooks n8n server-only
      webhook.ts                    processamento server-side de callbacks n8n
    supabase/

supabase/
  migrations/
    20251009_add_agent_type_to_chats.sql
    20260629000001_four_agents_access.sql
```

## Autenticacao

O app usa autenticacao propria, nao Supabase Auth como sessao principal:

1. `POST /api/auth/login` busca usuario em `users`.
2. `users.senha` precisa estar em bcrypt.
3. Login valido gera JWT `{ userId, email }`.
4. JWT fica no cookie httpOnly `auth_token`.
5. `AuthContext` chama `GET /api/auth/session`.
6. APIs server-side leem o cookie, validam JWT e usam Supabase service role.

Arquivos centrais:

- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/session/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/contexts/AuthContext.tsx`
- `src/middleware.ts`

Algumas rotas antigas fora de chat ainda tem fallback `JWT_SECRET || 'your-secret-key'`. Nas rotas novas/de chat alteradas, `JWT_SECRET` ausente falha fechado com erro 500 e token invalido retorna 401.

## Agentes de IA

O catalogo publico fica em `src/lib/agents.ts`. Ele contem metadados seguros para client components: tipo, nome, descricao e logo. Webhook URL nao fica neste arquivo.

Agentes atuais:

| agent_type | Nome visivel | Logo | Disponibilidade |
| --- | --- | --- | --- |
| `comunicacao` | Comunicacao Executiva | `/images/comunicacao-executiva-logo.png` | usuarios liberados pelo plano |
| `apresentacao` | Apresentacao para Reuniao de Resultados | `/images/apresentacao-resultados-logo.png` | usuarios liberados pelo plano |
| `conversas_dificeis` | Conversas Dificeis | `/images/conversas-dificeis-logo.jpeg` | usuarios liberados pelo plano |
| `postagem` | Postagem no Linkedin | `/images/postagem-linkedin-logo.jpeg` | usuarios liberados pelo plano |

Webhooks n8n ficam somente em `src/lib/server/agent-webhooks.ts`:

- `comunicacao`: `https://webhookbussola.palmup.com.br/webhook/ia/bussolascript`
- `apresentacao`: `https://webhookbussola.palmup.com.br/webhook/ia/bussolascriptresultado`
- `conversas_dificeis`: `https://webhookk.bussolaexecutiva.com.br/webhook/b4063e72-f560-4f98-aa4b-d34657ba2494`
- `postagem`: `https://webhookk.bussolaexecutiva.com.br/webhook/69e204cf-2b74-45f0-b522-633e60085920`

Nao importe `src/lib/server/agent-webhooks.ts` em components client-side.

Regras de disponibilidade dos agentes:

- `src/lib/agents.ts` define `adminOnly`, `availabilityLabel` e `availabilityMessage`.
- `isAgentAvailableForUser(type, userNivel)` libera agente admin-only somente quando `users.nivel = 'admin'`.
- `src/lib/agent-access.ts` aplica essa regra antes de `plano` e antes de `user_agent_access`.
- Em 2026-07-27, todos os quatro agentes estao com `adminOnly: false`, `availabilityLabel: null` e `availabilityMessage: null`.
- Para reabrir um beta no futuro, marque `adminOnly: true` no agente desejado; usuarios comuns verao o selo definido em `availabilityLabel` e receberao bloqueio 403 se tentarem acessar via API.

## Contrato n8n

Este contrato nao deve ser alterado sem combinar com quem mantem as automacoes n8n. Todos os agentes enviam exatamente este payload:

```json
{
  "chatId": "uuid-do-chat",
  "message": "texto do usuario",
  "scriptId": 123,
  "user": {
    "id": "uuid-do-usuario",
    "email": "email",
    "nome": "nome",
    "telefone": "telefone"
  }
}
```

Nao adicionar `agentType`, `agent_type`, nome do agente ou campos extras no payload do n8n. A unica diferenca entre agentes e a URL de destino.

## Fluxo de Chat Ativo

Entrada principal:

- `/dashboard`: lista os quatro agentes usando `AGENTS`.
- `/dashboard/agent/[agentType]`: inicia conversa com qualquer agente.
- `/dashboard/chat/[chatId]`: conversa individual.

Rotas genericas novas:

- `POST /api/chats/create-agent`
  - Recebe `{ message, agentType }`.
  - Valida agente com `getAgentByType`.
  - Valida acesso com `userHasAgentAccess`.
  - Cria `chats` com `agent_type`.
  - Cria `scripts` com `input` e `output = null`.
  - Envia payload n8n para `getAgentWebhookUrl(agent.type)`.

- `POST /api/chats/message-agent`
  - Recebe `{ chatId, message }`.
  - Busca o chat e usa `chat.agent_type`.
  - Se `agent_type` for `null`, faz fallback para `comunicacao`.
  - Valida acesso com `userHasAgentAccess`.
  - Cria novo `scripts`.
  - Envia payload n8n para o webhook do agente do chat.

Rotas legadas mantidas por compatibilidade:

- `POST /api/chats/create` e `POST /api/chats/message`: comunicacao.
- `POST /api/chats/create-apresentacao` e `POST /api/chats/message-apresentacao`: apresentacao.

Essas rotas legadas tambem usam `userHasAgentAccess` e `src/lib/server/agent-webhooks.ts`.

Leitura:

- `GET /api/chats`: lista chats do usuario. Se `plano` for `Todas` ou `Ambas`, lista os agentes disponiveis para aquele nivel de usuario; caso contrario filtra por linhas ativas em `user_agent_access`. Agentes `adminOnly` nao aparecem para usuarios comuns.
- `GET /api/chats/[chatId]`: detalhes do chat com validacao de dono, expiracao e permissao do agente.
- `GET /api/chats/[chatId]/messages`: retorna registros de `scripts` com validacao de dono, expiracao e permissao do agente.

O frontend faz polling em `GET /api/chats/[chatId]/messages` e espera resposta em `scripts.output`. O callback `POST /api/webhook` aceita `scriptId`/`script_id` mais `output`/`response`/`resposta`/`message` e atualiza `scripts.output`.

## Controle de Acesso e Assinatura

O controle atual e interno/manual pelo banco, nao Hotmart direto.

Campos relevantes em `users`:

- `plano`: resumo comercial/manual.
- `data_expiracao`: data de fim do acesso.

Tabela nova:

```text
user_agent_access
  id uuid
  user_id mesmo tipo de users.id
  agent_type text
  enabled boolean
  expires_at date
  created_at timestamptz
  updated_at timestamptz
  unique(user_id, agent_type)
```

Regras:

- `adminOnly` em `src/lib/agents.ts` tem prioridade sobre plano e `user_agent_access`. Em 2026-07-27, todos os agentes estao publicos.
- Admins tem acesso vitalicio por regra de codigo: nao expiram por `users.data_expiracao` nem por `user_agent_access.expires_at`, e a UI nao deve mostrar aviso de vencimento para eles.
- `users.plano = 'Todas'`: acesso global aos agentes disponiveis para o nivel do usuario. Nao ignora `adminOnly`.
- `users.plano = 'Ambas'`: tratado como global legado.
- `users.plano = 'Personalizado'` ou nome de IA: permissao efetiva vem de `user_agent_access`.
- `users.plano = null`: nao deve liberar acesso automaticamente. A migracao atual normaliza usuarios existentes para `Todas`.
- `data_expiracao` expirada bloqueia acesso.
- `user_agent_access.expires_at` tambem pode limitar acesso por agente.

Helper server-side:

- `src/lib/agent-access.ts`
- Funcao principal: `userHasAgentAccess(supabase, userId, agentType)`.

Helper client/UI legado:

- `src/lib/access-control.ts`
- Usado por paginas antigas (`/script`, `/dashboard/apresentacao`).
- Nao deve tratar `plano = null` como acesso liberado.

## Migracao Quatro Agentes

Arquivo:

- `supabase/migrations/20260629000001_four_agents_access.sql`

Ela faz:

- Atualiza constraint de `chats.agent_type` para quatro agentes.
- Cria `user_agent_access` adaptando o tipo de `user_id` ao tipo real de `public.users.id` (`uuid`, `int4` ou `int8`).
- Cria indices de acesso.
- Habilita RLS com policy para service role.
- Atualiza constraint de `users.plano`.
- Executa `UPDATE public.users SET plano = 'Todas';`
- Cria/atualiza linhas `user_agent_access` para todos os usuarios e os quatro agentes.

Essa migracao atende ao requisito de criar permissao de banco para todos os usuarios atuais em todas as IAs. A disponibilidade final ainda passa pela regra `adminOnly` do app caso algum agente seja colocado em beta novamente.

Status de producao:

- Migracao dos quatro agentes aplicada e validada pelo usuario.
- Todos os usuarios existentes foram normalizados para `plano = 'Todas'`.
- Linhas de `user_agent_access` dos quatro agentes foram criadas/atualizadas para os usuarios existentes.
- PR da evolucao dos quatro agentes foi mergeado em `main` e deployado pela Vercel.
- Ajuste posterior `adminOnly`/`EM BREVE` para `conversas_dificeis` e `postagem` foi commitado e enviado direto para `main` em 2026-06-30.
- Em 2026-07-01, foi adicionada regra de admin vitalicio. O SQL de saneamento para admins atuais fica em `supabase/admin-lifetime-access.sql`.
- Em 2026-07-03, `conversas_dificeis` e `postagem` foram liberados para todos os usuarios com acesso valido (`adminOnly: false`). Nao ha SQL novo necessario para essa liberacao.
- Em 2026-07-13, `postagem` voltou temporariamente ao modo admin-only para manutencao. Usuarios comuns veem `EM ATUALIZACAO`; admins continuam testando. Essa mudanca e somente de codigo e nao exige SQL.
- Em 2026-07-16, a correcao do compositor mobile foi enviada para `main` no commit `19b2441`.
- Em 2026-07-27, `postagem` saiu da manutencao e voltou a ficar disponivel para todos os usuarios com plano/acesso valido. Nao exige SQL.

## Banco de Dados Principal

### `users`

Campos relevantes:

- `id`
- `email`
- `nome`
- `senha`
- `telefone`
- `avatar`
- `nivel`
- `plano`
- `data_expiracao`

Observacao do banco real em producao:

- `users.id` esta como UUID.
- Ao criar usuario por script/service role, informe `id: randomUUID()`; nao assumir autoincrement/default.
- O login usa somente `public.users` com `senha` em bcrypt; nao precisa criar usuario separado no Supabase Auth.
- Para admins, `data_expiracao` pode ficar `NULL`; o app trata `users.nivel = 'admin'` como acesso vitalicio.
- Para manter o banco limpo, rode `supabase/admin-lifetime-access.sql` apos o deploy dessa regra.

Usuario teste de producao:

- Email: `teste.usuario@bussolaexecutiva.com.br`
- Nome: `Usuario Teste`
- `nivel`: `user`
- `plano`: `Todas`
- `data_expiracao`: `2026-07-30`
- Objetivo: validar a visao de usuario comum. Em 2026-07-27, deve acessar os quatro agentes se o plano/acesso estiver valido.
- Nao registrar senha em texto claro neste arquivo.

### `chats`

- `id`
- `user_id`
- `title`
- `agent_type`: `comunicacao`, `apresentacao`, `conversas_dificeis`, `postagem`
- timestamps

### `scripts`

- `id`
- `user_id`
- `chatid`
- `input`
- `output`
- timestamps

### `user_agent_access`

Permissao por usuario/agente. Use para liberar uma, duas, tres ou todas as IAs quando o plano nao for global.

## Codigo Legado/Experimental

`src/components/chat/EnhancedChatInterface.tsx` representa um fluxo antigo por `mensagens` e `arquivos`.

`src/app/api/webhook/route.ts` e `src/lib/server/webhook.ts` atendem o fluxo ativo por `scriptId` e mantem fallback legado por `webhook_id/outputs`.

Esse nao e o fluxo principal das quatro IAs. O fluxo principal usa `chats` + `scripts` + `scriptId`.

Antes de reaproveitar o componente legado, confirme se as tabelas `mensagens` e `arquivos` existem no Supabase ativo.

## UI e Navegacao

Atualização posterior em15/10/2026: usuário aprovou inicialmente demo e priorizou terminar painel antes de Hotmart direta. Caminho live preparado (RPC/auditoria, duas migrations, convites SMTP/Brevo e senha real), mas gates reais todos desativados e nenhuma migration aplicada no Supabase. Validação SQL real passou em PostgreSQL temporário sem rede, com fixtures apenas. Auditoria GET-only atual encontrou1699 usuários,5 grupos de e-mails duplicados trim/lower e1 vazio; índice único preparado aborta se duplicados persistirem. Não resolver identidades automaticamente. Snapshot seguro em `docs/audits/2026-10-15-admin-users-readonly.json`; handoff atualizado prevalece sobre descrição original demo abaixo. ClickUp revisão de identidades `17ty0uzry32`, ativação futura `17ty0uzry33`. Sem e-mails reais, push ou deploy.

Atualização 15/10/2026: painel admin local `/dashboard/users` implementado com fixtures e APIs em `/api/admin/users`. `ADMIN_USERS_MODE=demo` apenas fora de production, padrão disabled; sem live/banco de usuários real. Autorização consulta somente papel atual do admin, mutações são em memória. Primeiro acesso demo gera link `/auth/update-password/demo` de1h/uso único, envio simulado; não envia/salva senha. Sem migrations ou e-mails reais. Handoff e limites: `docs/plans/2026-10-15-admin-usuarios-handoff.md`. 16 testes admin +18 Insights passaram; typecheck escopado sem erros e14 legados globais. Chrome desktop/mobile com sessão sintética/APIs interceptadas passou; login real não validado nesta entrega.

- `src/app/dashboard/page.tsx`: cards dos quatro agentes com logo.
- `src/app/dashboard/select-agent/page.tsx`: selecao alternativa usando `AGENTS`.
- `src/app/dashboard/agent/[agentType]/page.tsx`: tela generica para iniciar chat.
- `src/app/dashboard/chat/[chatId]/page.tsx`: conversa individual.
- `src/components/chat/ChatInterface.tsx`: cria chat via `/api/chats/create-agent`.
- `src/components/chat/ChatDetail.tsx`: envia mensagens via `/api/chats/message-agent`.
- `src/components/layout/Sidebar.tsx`: menu desktop com quatro agentes e historico com badge.
- `src/components/layout/MobileMenu.tsx`: menu mobile com quatro agentes e historico com badge.
- `src/components/layout/Header.tsx`: mostra badge do agente atual.

Regra de layout do chat no celular:

- As paginas de chat usam `h-[100dvh]` para acompanhar a altura visivel real do navegador movel.
- O `main` e os wrappers intermediarios precisam de `min-h-0`, `flex-1` e coluna flexivel para a area de mensagens poder encolher e rolar.
- O aviso de expiracao e o compositor usam `shrink-0`; o compositor deve permanecer inteiro no rodape.
- Nao coloque um wrapper `h-full` depois de `AccessWarning`: aviso + chat com 100% de altura ultrapassa o `main`, e `overflow-hidden` corta o campo de mensagem.
- Em 2026-07-16, esse comportamento foi validado em viewports `375x812` e `360x640`, com aviso de 7 dias visivel, para conversa nova e chat existente.

Tema: escuro, Tailwind, cor primaria `#FF6B00`.

## Futuro: Hotmart Direto

Decisão posterior em 15/10/2026: confirmado fluxo Hotmart → n8n → base. Integração direta incluída no plano admin (ClickUp lista `1400710000001966`, agora 15 tarefas), com transição validada antes de desligar somente fluxo comercial substituído; preservar n8n dos chats. Regra cadastral aprovada: preencher apenas campos vazios, manter existentes e sinalizar divergências. Substitui a pendência de sobrescrita mencionada abaixo. Acesso manual segue protegido por revisão admin. Sem alterações de produção. Ver `docs/plans/2026-10-15-admin-usuarios-brainstorm.md`.

Atualização de contexto em 15/10/2026: usuário informa que a automação Hotmart já está pronta, possivelmente fora deste checkout; a seção abaixo é histórica e não comprova ausência da integração externa. Conferir fluxo real antes de modificá-lo. Nova demanda em brainstorming: painel admin para usuários/acessos, separado de Insights, lista ClickUp `1400710000001966`. Registro em `docs/plans/2026-10-15-admin-usuarios-brainstorm.md`. Decisão: Hotmart enriquece cadastro automaticamente; mudança conflitante com acesso manual exige decisão do admin. Regra de sobrescrita de campos divergentes ainda pendente. Nenhuma implementação ou alteração real nesta etapa.

Nao implementado ainda. Plano recomendado:

1. Criar endpoint seguro para webhooks Hotmart.
2. Validar assinatura/token do evento.
3. Persistir IDs de eventos para idempotencia.
4. Criar tabela de mapeamento produto/oferta Hotmart -> agentes liberados.
5. Atualizar `users.plano`, `users.data_expiracao` e `user_agent_access`.
6. Manter override manual/admin para suporte.
7. Registrar logs de mudanca de assinatura.

## Pontos de Atencao

- Nao mudar o payload n8n sem atualizar as automacoes.
- Webhook URLs devem ficar server-only.
- `SUPABASE_SERVICE_ROLE_KEY` nunca deve ir para codigo client.
- `next.config.js` ignora typecheck/lint em build.
- Ainda ha rotas antigas fora de chat com fallback `JWT_SECRET || 'your-secret-key'`.
- `/api/webhook` nao valida assinatura. Antes de expor mais automacoes, adicionar autenticacao/assinatura.
- O retorno n8n ativo deve enviar `scriptId` e uma resposta em `output`, `response`, `resposta` ou `message`.
- Existem schemas SQL divergentes (`supabase/fix-schema.sql`, `scripts/setup-database.sql`). Nao execute SQL destrutivo sem revisar o banco real.

## Planejamento de Insights de Demandas (2026-10-14)

- Controle no ClickUp criado em 15/10/2026: Geral → Bússola IA → lista Plano de ação — Insights, OpenAI e MCP (`1400710000001965`), 15 tarefas com critérios/dependências. Mapeamento em `docs/plans/2026-10-15-clickup-insights.md`. Consultar tarefas atuais antes de retomar; novas demandas ficam em listas separadas, sem misturar planos.

- Ponto de retomada mais recente: usuario decidiu aguardar a chave OpenAI do cliente e dispensou tunel temporario para testar no ChatGPT. Continuar pela integracao hospedada com dados reais somente apos preparar e autorizar piloto/custo, banco e publicacao. Chave sozinha nao ativa o pipeline; MCP remoto com fonte real, HTTPS e autenticacao/autorizacao ainda precisa ser implementado. Checklist de retomada registrado no inicio de `docs/plans/2026-10-14-insights-handoff.md`. Nenhuma nova ativacao autorizada/executada nesta pausa.
- Pedido: permitir que gestor/equipe acompanhe as principais demandas enviadas as quatro IAs e consulte relatorios no ChatGPT ou Claude que ja utiliza.
- Direcao aprovada pelo usuario: painel + API de consulta + IA para classificar mensagens. Estrutura local implementada com dados simulados na branch `codex/insights-demo`, sem push/deploy/migration aplicada.
- Plano proposto: `docs/plans/2026-10-14-insights-perguntas-implementation.md`.
- Fonte identificada no codigo: `scripts.input` ligado a `chats`, com periodo por criacao do script e agente em `chats.agent_type`. Diferenciar demanda inicial de refinamentos; medir pessoas e conversas distintas.
- Integracao proposta: classificador assincrono no backend, resultados derivados versionados e camada de insights compartilhada pelo painel e por MCP/API autenticada. Preservar contrato n8n.
- Decisao posterior do usuario em 2026-10-14 substitui proposta de acesso da equipe no MVP: painel inicialmente exclusivo para admins, com visao global das quatro IAs e exclusao das mensagens de contas administrativas. Verificar nivel atual no servidor, inclusive para excluir contexto e exemplos. Permissoes de equipe ficam evolucao futura; nunca compartilhar service role.
- Consulta no ChatGPT/Claude e classificacao no servidor sao integracoes diferentes. Sign in with ChatGPT permite uso de plano em apps elegiveis, mas elegibilidade deste SaaS nao foi confirmada; nao depender dessa opcao no MVP.
- Escopo aprovado em 2026-10-14: quatro IAs, ultimos 30 dias e atualizacao diaria.
- Auditoria do Supabase autorizada e executada somente com GET pela Data API: `docs/audits/2026-10-14-supabase-insights-readonly.md`. Credenciais locais funcionam e configuracoes local/producao apontam para o mesmo projeto. Nenhuma credencial ou texto de conversa salvo nos artefatos.
- Snapshot encerrado em 14/10/2026 21:03:50 America/Sao_Paulo: 1.486 scripts em 30 dias, 129 pessoas, 279 conversas ativas; 273 chats criados no periodo. Nenhum vinculo ausente ou dono divergente; 28 outputs nulos e 30 mensagens de admins. Contagens sao mensagens, nao demandas classificadas.
- Schema ativo confirmado por metadados e consultas: users/chats UUID, scripts integer; `scripts.chatid` relacionado a chats. Join scripts/chats exige hint explicito por duas FKs sobre as mesmas colunas. Tabelas derivadas planejadas nao aparecem no schema public exposto; nao foram inspecionados outros schemas.
- Limites: policies RLS, indices, triggers e CHECK constraints nao auditados pela credencial Data API. Service role bypassa RLS. Chaves convencionais OpenAI/Anthropic nao encontradas nos envs locais; segredos na hospedagem nao verificados.
- Recomendacao de modelo/custo, ainda nao executada: GPT-6 Luna reasoning low; piloto de 200 mensagens com comparacao de 50 no GPT-6.1 Sol e revisao humana. Das 1.486 mensagens do snapshot, 1.456 sao elegiveis apos excluir admins. Estimativa Standard com premissas/margem: piloto US$ 0,50–1,50; periodo completo com comparacao US$ 1–3; teto sugerido US$ 5 sem aprovacao de gasto. Detalhes em `docs/plans/2026-10-14-insights-modelo-custo-piloto.md`.
- Pendencias: aprovacao de provedor/modelo/orcamento e permissao para piloto real, credencial API segura, acesso para inspecao completa/migrations e ambiente de validacao, executor diario e plataforma/plano exatos do gestor. Identificar contas de teste nao administrativas se houver exclusao adicional. Nenhuma chamada paga, classificacao real, migration ou deploy executado.
- Handoff de implementacao: `docs/plans/2026-10-14-insights-handoff.md`. Painel `/dashboard/insights`, seis GETs admin e POST do executor com segredo separado, flags privadas desativadas por padrao. Demo apenas fora de producao; chave sozinha nao habilita processamento.
- Preparados classifier mock/OpenAI Luna low, processor paginado por lotes, persistencia Supabase via RPC, reserva de orçamento e migration aditiva com 4 tabelas. Nenhum cron agendado. APIs de consulta nao iniciam classificacao.
- Validacao local: 18 testes sinteticos passaram, dry-run sem rede e teste visual desktop/mobile/filtros/exportacao/estados passou. Typecheck insights/UI tocada sem erros; typecheck global tem erros legados. Corrigido somente caractere JSX preexistente em profile para destravar verificacao. Build local aprovado; SQL ainda nao executado/validado em Postgres.
- Usuario testou manualmente filtros/relatorios/exportacao do painel demo e informou que, a principio, tudo estava correto. Isso valida a interface simulada, nao a classificacao real.
- MCP local demo implementado em `mcp/insights`, SDK oficial 1.32.1 e Zod 4.6.7 em pacote/lock isolados; dependencias/lock do painel intactos. Cinco ferramentas somente leitura, mesmos relatorios sinteticos, transportes STDIO e HTTP fixo em 127.0.0.1. `MCP_INSIGHTS_MODE=demo` obrigatorio e producao negada. Nao importa servicos/Supabase/classificador nem le arquivos de credenciais.
- Guia MCP: `mcp/insights/README.md`; exemplos de configuracao Claude Desktop/Codex preparados mas nao instalados; `demo-client.cjs` conecta e consulta o servidor local sem IA. Validacao com cliente SDK oficial: 6 testes MCP passaram (memoria, HTTP local e STDIO) e 18 testes Insights continuam passando. Protocolo testado pelo SDK: 2025-11-25 e versoes suportadas; nao declarar compatibilidade 2026 ou conta externa conectada sem teste.
- Conector remoto OAuth/HTTPS e instalacao na conta ChatGPT/Claude permanecem etapa futura; nenhum tunel/publicacao/permissao externa criada. Antes de ativar dados reais: validar SQL/concorrencia em ambiente autorizado, configurar chave/segredo/orcamento e limitar amostra. Atualizacao diaria depende de executor externo percorrendo lotes; nenhuma automacao foi criada.

## Ordem Recomendada Para Novas Funcionalidades

1. Sincronizar com GitHub.
2. Ler este arquivo.
3. Identificar se a mudanca toca fluxo principal (`scripts/scriptId`) ou o componente legado de `mensagens/arquivos`.
4. Validar schema real antes de migracoes.
5. Preservar contrato n8n.
6. Usar `AGENTS` para metadados publicos e `agent-webhooks.ts` para URL server-only.
7. Usar `userHasAgentAccess` para permissoes server-side.
8. Atualizar este arquivo quando arquitetura, schema, fluxo ou proximos passos mudarem.

## Operações reais pontuais — atualização em 15/10/2026

A revisão de identidades foi concluída com autorização: seis exclusões sem histórico, duas validades ajustadas, cinco contas principais com 26 chats/91 scripts preservados; auditoria posterior encontrou1693 usuários, zero duplicidades e zero e-mails vazios. Também aplicada uma concessão comercial pontual P1 com validades diferentes por IA, backup privado e verificação independente. Detalhes no handoff admin e plano de reconciliação; as menções anteriores a bloqueio por duplicidades são históricas. Nenhuma migration aplicada, publicação, ativação live, e-mail, OpenAI ou alteração de fluxo n8n/Hotmart. Segundo payload comercial ainda pendente.

Atualização P2 em15/10/2026 12:35 BRT: segunda compra atendida com conta nova user/Todas válida até11/11/2026 e link de definição de senha pelo fluxo legado, aceito via SMTP. As duas compras pontuais foram atendidas. Sem migrations/publicação/ativação live; handoff admin contém evidências e pendência de revisão da chave Brevo API (401; SMTP funcionou). Não usar NEXT_PUBLIC_APP_URL local localhost em links reais. Tokens e dados pessoais permanecem somente no armazenamento privado criptografado, fora do Git.

Revisão final administrativa15/10/2026: testes locais e build isolado passaram; publicação AINDA condicionada a preservar validades individuais distintas e corrigir rollback do consumidor atômico de senha. Relatório docs/audits/2026-10-15-admin-final-review.md; roteiro docs/plans/2026-10-15-admin-publicacao.md. Sem novas operações reais, migrations ou deploy. E-mail de teste aguardado; chave OpenAI deve ser inserida localmente pelo usuário em OPENAI_API_KEY com flags desativadas, nunca enviada no chat.

Correções pré-publicação15/10/2026 concluídas localmente: edição porIA com vigências preservadas e recuperação RPC independente das flags do painel. Nova variável PASSWORD_RESET_ATOMIC_REQUIRED deve permanecertrue no rollout/rollback após instalação.66 testes Node, PostgreSQL isolado, browser mock/mobile e build isolado passaram; typecheck escopado0/global14 legados. E-mail futuro suporte@palmup.com.br registrado, sem criar/enviar nesta rodada. Chave OpenAI presente localmente e nenhum gasto/ativação; roteiros/handoff atualizados. Sem migrations remotas, push ou publicação.

Preflight remoto15/10/2026 somente leitura: schema real PostgreSQL15.8 compatível,0 duplicidades, testes SQL15.8 isolados passaram; novas migrations não aplicadas. Vercel correta samoskitos-projects/bussola-ia, produção2248dcd, domínio principal https://ia.bussolaexecutiva.com.br (alias vercel também válido). Candidato funcionalfa635a5. Faltam backup atual recuperável (diário anterior às operações; PITR inativo), envs Supabase/admin/reset na Vercel e conferência do fluxo comercial n8n. Detalhes em docs/audits/2026-10-15-admin-production-preflight.md. Nada publicado/configurado/ativado; OpenAI/Hotmart direta seguem fora desta etapa.

Atualização autorizada15/10/2026 16:15 BRT: backup atual das quatro fontes administrativas criado com DPAPI e recuperação local PostgreSQL15.8 verificada (1694 users,4556 grants,437 tokens,1 template; igualdade de todos os registros). Doze variáveis Production salvas na Vercel com admin/Insights/OpenAI desativados, orçamento0 e reset atômico true preparado para o próximo deploy. Service role já existia e coincide com local: preservada; inventário anterior era parcial. JWT/SMTP/Brevo preservados. Sem migrations, publicação, chamadas OpenAI, contas/e-mails de teste ou mudanças Hotmart/n8n. Evidências/limites e roteiro: docs/audits/2026-10-15-admin-backup-vercel.md. Backup inclui dados/definições das quatro fontes, não chats/scripts/Storage ou recuperação integral; depende do perfil Windows DPAPI. Hotmart direta posterior; verificar compatibilidade do fluxo atual antes do índice, sem implementar substituição agora.

Publicação autorizada15/10/2026 concluída em quatro etapas: duas migrations administrativas instaladas manualmente no Supabase (não CLI history; não usar db push genérico), commit9b9fb83 publicado em main, produção final3EQ1L3y4wj1U5EoE3rtRxX3VV2u3 Ready. Admin live/leitura/escrita/email ativos e reset atômico requerido; Insights/OpenAI desativados/teto0; nenhuma alteração n8n/Hotmart direta. Teste real apenas suporte@palmup.com.br: criado user comum com quatro IAs até22/10/2026; busca, edição, revogação/restauração, validades individuais, rejeição de data vencida, auditoria e link testados. Convite aceito pelo serviço e confirmado sent no banco, link anterior invalidado. Todos os cadastros/acessos anteriores preservados por comparação de digests excluindo teste. Aguarda destinatário confirmar recebimento, definir própria senha e testar login/quatro IAs; não houve coleta/definição de senha pelo agente. Relatório/evidências docs/audits/2026-10-15-admin-rollout.md e resultado JSON. Rollback: manter PASSWORD_RESET_ATOMIC_REQUIRED=true, desabilitar gates/republicar versão compatível; não voltar ao reset legado nem remover schema como contenção automática.

Aceite do destinatário em15/10/2026: usuário confirmou recebimento do convite, própria definição de senha e login. Conferência somente leitura posterior confirmou convite enviado consumido,1evento password_defined,1conta comum e4IAs habilitadas até22/10/2026. Ciclo administrativo de publicação/primeiro acesso validado; nenhuma senha/token consultado. Evidência docs/audits/2026-10-15-admin-recipient-acceptance.json. OpenAI/Insights continuam desativados e Hotmart direta permanece etapa futura. Mensagens/conteúdo das quatro IAs não foram exercitados nesta homologação; o foco foi gestão de usuários e acesso.

Retomada real15/10/2026 concluída em piloto: migration20261014000001_insights.sql aplicada após PostgreSQL15.8 isolado;26testes passaram/TS tocado0/global14legados. Chave local cadastrada na Vercel como Secret; GPT-6 Luna404 na conta e usuário aprovou GPT-5.4 nano (models200), reasoning low. Produçãofbf75d4/deployGJ5XHaM2hMwBRXtzhiRsbHLD3Bi8 Ready.200classificações reais,50porIA,62para revisão/10não classificáveis. Painel mostra200/1435=13,9%,1235pendentes e29admins excluídos.0violações de roles/review/temas/tamanho. Custo conhecido estimadoUS$0,05393945;reserva durávelUS$0,104038 de tetoTOTALUS$1,mesmo scopeinsights-pilot-20261015-v1; reservas desconhecidas de falhas mantidas. Manifesto200IDs e segredo worker privados em.local-backups,DPAPI para credenciais. Não remover manifesto/trocar scope/renovar teto sem aprovação. Políticas conservadoras normalizam incerteza/temas contraditórios; snapshot ativo otimiza retomadas com testes de mudança/reversão. Classificação foi encerrada em200; nenhum cron diário/histórico completo/MCP remoto/Hotmart direta. API de consulta não gera custo de classificação. CSV real/filtros/JSONpayload verificados; download JSON precisa confirmação do usuário se necessário. Qualidade/anonimização não garantidas: exemplos em revisão podem conter referências residuais; revisar62 antes de ampliar/compartilhar. Aguardando aceite das categorias pelo usuário. Relatório vivo docs/audits/2026-10-15-insights-pilot-rollout.md; auditorias50/200 e resumo real sem textos de conversas. Proteções admin/reset permanecem ativas. Estado antigo sem deploy/chave neste handoff é histórico e foi substituído por esta atualização.

## MCP real preparado em 15/10/2026 — Claude primeiro

Pedido autorizado: preparar MCP com os insights reais e autenticação, somente leitura, com agentes; testar primeiro na conta Claude do Samuel, ChatGPT depois. Hotmart permanece fora. Implementado localmente SDK HTTP stateless em /api/insights-mcp, cinco ferramentas com projeções derivadas/cobertura, OAuth confidencial pré-cadastrado com PKCE S256, consentimento admin/CSRF, tokens opacos/hash, rotação/revogação/anti-replay e role atual a cada chamada. Exemplos textuais fechados por padrão até revisão específica. Fonte reutiliza buildLiveReport; não inicia classificação nem amplia200/tetoUS$1/cron.

Nova migration preparada e testada SOMENTE em PostgreSQL15.8 isolado: 20261015000003_insights_mcp_oauth.sql (4 tabelas operacionais OAuth,1RPC,RLS/service role). Não aplicada em produção. Não usar db push genérico: histórico CLI de migrations anteriores não reconciliado. Env flags novas INSIGHTS_MCP_ENABLED=false, BASE_URL, CONSENT_SECRET separado, CLIENTS_JSON com hashes e redirects exatos, EXAMPLES_ENABLED=false. Nenhum segredo real gerado/divulgado; nenhuma publicação ou alteração Vercel/Supabase nesta preparação. Demo mcp/insights continua isolado, não expor.

Validação:22 testes MCP,26 Insights e42 admin passaram; PostgreSQL real isolado validou concorrência/RLS/expiração/replay/revogação e foi removido. Dois builds isolados passaram (último inclui navegação/login; posterior alteração somente remoção de form-action CSP). Typecheck sem diagnósticos novos,14 legados fora do escopo. Astra revisou segurança; Sol implementou OAuth e protocolo. Roteiro em docs/plans/2026-10-15-insights-mcp-release.md; evidências em docs/audits/2026-10-15-mcp-live-validation.md e revisão independente. Falta ativação controlada: backup/aplicar só migration OAuth/configurar segredos/deploy fechado/abrir gate e homologar HTTPS+consentimento+leitura+refresh+revogação na conta Claude real; depois cliente separado ChatGPT. Não existe ainda tela de grants nem limpeza automática; operações documentadas. Conexão real não comprovada. Tarefa ClickUp11 em andamento/aguardando ativação, sem marcar integração concluída.

Ativação autorizada MCP15/10/2026: backup DPAPI atual11 tabelas (recuperação de bytes verificada, leituras REST por tabela sem MVCC global), migrationOAuth03 instalada com4RLS e RPCserviceonly, digestsusers/access/classificações preservados. Publicação fechadaHsRtXKeZUNZhyag6a21fMjh7oYGF e ativaNn5THok7Bgw4ppm3L5KBQmnMBf8Z Ready, commit296a9ba emmain. Segredos exclusivos novos naVercel Production; gateMCPtrue, exemplosfalse; JWT/SMTP/OpenAI/worker existentes preservados. Smokes fechado/ativo passaram; resourceanônimo401/discovery200/S256, tokensinválidos401, tabelasOAuthanon401. Nenhuma classificação adicional/cron/Hotmart. Claude privado criado na contaSamuel, discovery reconhecido e fluxo chegou a/auth/insights-mcp comadmin atual. Aguardando usuário clicarAutorizar somenteleitura; não afirmar conexão/consulta real concluída, refresh ou revogação homologados. Retomar aba11/Claude e conferir antesde prosseguir. Roteiro/evidências docs/audits/2026-10-15-mcp-rollout.md e recibos. PersistênciaCLI migrationscontinua não reconciliada: não usar dbpush genérico.

Relato posterior de acesso negado no POST de consentimento: reproduzido bug Referrer-Policy no-referrer -> Origin:null em formulário nativo. Correção pontual same-origin no documento, mantendo validaçãoOriginexato+CSRF+admin; teste navegador sintético confirmou Origin válido. Não relaxar Origin null, não criar grants manualmente. Ver recibo mcp-consent-policy-regression.json e rollout para publicação corretiva/retomada.

## MCP: Claude Code e perguntas dos alunos — 21/10/2026 (branch local, não publicada)

Branch `feat/mcp-claude-code-perguntas` (base origin/main 334fe2f). Sem push, deploy, migration, env real ou acesso ao banco.

- DCR loopback (RFC 8252): novo client ID assinado `dcr3` para `http://localhost|127.0.0.1|[::1]:<porta>/<path>`; sempre público (`none`, método secreto pedido é substituído), PKCE S256. Autorização ignora só a porta; esquema/host/path exatos. dcr1/dcr2/estáticos, callbacks HTTPS exatos, consentimento Origin+CSRF, refresh/revogação inalterados. Código em `src/lib/insights-mcp/oauth-registration.ts` (`parseLoopbackRedirect`, `redirectMatches`).
- Ferramentas `list_student_questions` e `get_student_question` (`src/lib/insights/questions.ts`): texto integral sem anonimização (decisão do dono), somente admins, mensagens de admins excluídas, sem nome/e-mail/telefone, pseudônimos `p_`/`c_` por HMAC do `INSIGHTS_MCP_CONSENT_SECRET` (domínio separado; rotacionar muda pseudônimos), cargo atual de `users.cargo`. Gate `INSIGHTS_MCP_QUESTIONS_ENABLED` padrão false: desligado, as duas ferramentas nem aparecem em tools/list (e cada chamada revalida). Cursor fixa a janela da 1ª página. Leitura de chat longo pagina só por id inteiro (sem interpolar valores em `.or()`).
- ATENÇÃO: rotacionar `INSIGHTS_MCP_CONSENT_SECRET` muda TODOS os pseudônimos `p_`/`c_` (acervos antigos deixam de casar) e invalida as instalações DCR (reconexão obrigatória).
- `buildLiveReport` refatorado em `openLiveInsightSource` + `deriveSourceStatus` (mesma regra de status).
- Escopo mantido `insights:read` (CHECK no banco; grants existentes seguem válidos). Consentimento e guia atualizados.
- Publicar: deploy + `INSIGHTS_MCP_QUESTIONS_ENABLED=true` + atualizar catálogo de ferramentas nas plataformas. Homologação real pendente.
