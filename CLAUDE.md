# CLAUDE.md - Guia vivo do projeto Bussola IA / ExecutivIA

Este arquivo e a memoria persistente do projeto. Em um chat novo, comece por aqui antes de propor arquitetura, corrigir bugs ou implementar novas funcionalidades.

## Estado Atual

- Projeto: Bussola IA / ExecutivIA.
- Produto: SaaS em portugues do Brasil para conversas com agentes de IA externos via n8n.
- Producao conhecida: `https://bussola-ia.vercel.app`.
- Remoto Git: `origin https://github.com/samoskito/bussola-ia.git`.
- Branch de trabalho atual desta evolucao: `feature/four-ai-agents-access`.
- Stack: Next.js 15.3.8 App Router, React 19.1.0, TypeScript 5.4.5, Tailwind CSS, Supabase PostgreSQL/Storage, JWT proprio em cookie httpOnly.
- IA: nao ha chamada direta a LLM no codigo. O app envia mensagens para webhooks n8n e espera que o n8n atualize `scripts.output`.

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

| agent_type | Nome visivel | Logo |
| --- | --- | --- |
| `comunicacao` | Comunicacao Executiva | `/images/comunicacao-executiva-logo.png` |
| `apresentacao` | Apresentacao para Reuniao de Resultados | `/images/apresentacao-resultados-logo.png` |
| `conversas_dificeis` | Conversas Dificeis | `/images/conversas-dificeis-logo.jpeg` |
| `postagem` | Postagem no Linkedin | `/images/postagem-linkedin-logo.jpeg` |

Webhooks n8n ficam somente em `src/lib/server/agent-webhooks.ts`:

- `comunicacao`: `https://webhookbussola.palmup.com.br/webhook/ia/bussolascript`
- `apresentacao`: `https://webhookbussola.palmup.com.br/webhook/ia/bussolascriptresultado`
- `conversas_dificeis`: `https://webhookk.bussolaexecutiva.com.br/webhook/b4063e72-f560-4f98-aa4b-d34657ba2494`
- `postagem`: `https://webhookk.bussolaexecutiva.com.br/webhook/69e204cf-2b74-45f0-b522-633e60085920`

Nao importe `src/lib/server/agent-webhooks.ts` em components client-side.

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

- `GET /api/chats`: lista chats do usuario. Se `plano` for `Todas` ou `Ambas`, lista tudo; caso contrario filtra por linhas ativas em `user_agent_access`.
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

- `users.plano = 'Todas'`: acesso global a todos os agentes atuais.
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

Essa migracao atende ao requisito de liberar todos os usuarios atuais para todas as IAs antes do controle individual futuro.

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

- `src/app/dashboard/page.tsx`: cards dos quatro agentes com logo.
- `src/app/dashboard/select-agent/page.tsx`: selecao alternativa usando `AGENTS`.
- `src/app/dashboard/agent/[agentType]/page.tsx`: tela generica para iniciar chat.
- `src/app/dashboard/chat/[chatId]/page.tsx`: conversa individual.
- `src/components/chat/ChatInterface.tsx`: cria chat via `/api/chats/create-agent`.
- `src/components/chat/ChatDetail.tsx`: envia mensagens via `/api/chats/message-agent`.
- `src/components/layout/Sidebar.tsx`: menu desktop com quatro agentes e historico com badge.
- `src/components/layout/MobileMenu.tsx`: menu mobile com quatro agentes e historico com badge.
- `src/components/layout/Header.tsx`: mostra badge do agente atual.

Tema: escuro, Tailwind, cor primaria `#FF6B00`.

## Futuro: Hotmart Direto

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

## Ordem Recomendada Para Novas Funcionalidades

1. Sincronizar com GitHub.
2. Ler este arquivo.
3. Identificar se a mudanca toca fluxo principal (`scripts/scriptId`) ou o componente legado de `mensagens/arquivos`.
4. Validar schema real antes de migracoes.
5. Preservar contrato n8n.
6. Usar `AGENTS` para metadados publicos e `agent-webhooks.ts` para URL server-only.
7. Usar `userHasAgentAccess` para permissoes server-side.
8. Atualizar este arquivo quando arquitetura, schema, fluxo ou proximos passos mudarem.
