# Four AI Agents and Access Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two new AI agents to Bussola IA while preserving the exact current n8n webhook payload contract and replacing the two-agent access model with scalable per-agent access.

**Architecture:** Introduce a central agent catalog with four hardcoded agents and webhooks, then refactor chat creation/message APIs to use that catalog instead of one endpoint pair per agent. Access control moves from `users.plano` as a single text value to a per-user/per-agent table while keeping a global "Todas" shortcut for all current and future agents.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase PostgreSQL/Storage, n8n webhooks.

---

## Non-Negotiable n8n Contract

Do not change the payload sent to n8n. All four agents must send this exact shape:

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

Only the destination webhook URL changes by agent.

## Agent Catalog

Use these four agents:

```ts
export const AGENTS = [
  {
    type: 'comunicacao',
    name: 'Comunicação Executiva',
    description: 'Gere scripts personalizados para suas necessidades',
    icon: '/images/comunicacao-executiva-logo.png',
  },
  {
    type: 'apresentacao',
    name: 'Apresentação para Reunião de Resultados',
    description: 'Crie apresentações de resultados profissionais',
    icon: '/images/apresentacao-resultados-logo.png',
  },
  {
    type: 'conversas_dificeis',
    name: 'Conversas Dificeis',
    description: 'Prepare conversas sensiveis com clareza, empatia e direção',
    icon: '/images/conversas-dificeis-logo.jpeg',
  },
  {
    type: 'postagem',
    name: 'Postagem no Linkedin',
    description: 'Crie posts profissionais para LinkedIn com apoio da IA',
    icon: '/images/postagem-linkedin-logo.jpeg',
  },
] as const;
```

Webhook URLs must live in a server-only module, not in client-shareable agent metadata. Use `src/lib/server/agent-webhooks.ts` with `getAgentWebhookUrl(agentType)` for API routes.

Use `conversas_dificeis` internally instead of `conversas dificeis` to avoid route/type issues. The visible label remains `Conversas Dificeis`.

## Future Hotmart Note

After the four-agent rollout, create a separate Hotmart integration phase:

- Add a secure webhook endpoint for Hotmart events.
- Persist webhook event IDs for idempotency.
- Map Hotmart product/offer IDs to agent permissions.
- Update `user_agent_access` and expiration dates automatically.
- Keep manual overrides possible for support/admin corrections.

---

### Task 1: Add Logos to Public Assets

**Files:**
- Copy source: `C:\Users\samue\Downloads\Logo conversas dificeis.jpeg`
- Copy source: `C:\Users\samue\Downloads\Logo postagem.jpeg`
- Create: `public/images/conversas-dificeis-logo.jpeg`
- Create: `public/images/postagem-linkedin-logo.jpeg`

- [ ] **Step 1: Copy the two logo files into public images**

Run:

```powershell
Copy-Item -LiteralPath 'C:\Users\samue\Downloads\Logo conversas dificeis.jpeg' -Destination 'public\images\conversas-dificeis-logo.jpeg'
Copy-Item -LiteralPath 'C:\Users\samue\Downloads\Logo postagem.jpeg' -Destination 'public\images\postagem-linkedin-logo.jpeg'
```

Expected: both files exist under `public/images`.

- [ ] **Step 2: Verify assets exist**

Run:

```powershell
Test-Path -LiteralPath 'public\images\conversas-dificeis-logo.jpeg'
Test-Path -LiteralPath 'public\images\postagem-linkedin-logo.jpeg'
```

Expected:

```text
True
True
```

---

### Task 2: Create the Central Agent Catalog

**Files:**
- Create: `src/lib/agents.ts`
- Create: `src/lib/server/agent-webhooks.ts`

- [ ] **Step 1: Create `src/lib/agents.ts`**

Use:

```ts
export const AGENTS = [
  {
    type: 'comunicacao',
    name: 'Comunicação Executiva',
    description: 'Gere scripts personalizados para suas necessidades',
    icon: '/images/comunicacao-executiva-logo.png',
  },
  {
    type: 'apresentacao',
    name: 'Apresentação para Reunião de Resultados',
    description: 'Crie apresentações de resultados profissionais',
    icon: '/images/apresentacao-resultados-logo.png',
  },
  {
    type: 'conversas_dificeis',
    name: 'Conversas Dificeis',
    description: 'Prepare conversas sensiveis com clareza, empatia e direção',
    icon: '/images/conversas-dificeis-logo.jpeg',
  },
  {
    type: 'postagem',
    name: 'Postagem no Linkedin',
    description: 'Crie posts profissionais para LinkedIn com apoio da IA',
    icon: '/images/postagem-linkedin-logo.jpeg',
  },
] as const;

export type AgentType = (typeof AGENTS)[number]['type'];

export function getAgentByType(type: string) {
  return AGENTS.find((agent) => agent.type === type) || null;
}

export function getAgentLabel(type: string) {
  return getAgentByType(type)?.name || type;
}
```

- [ ] **Step 2: Create server-only webhook lookup**

Create `src/lib/server/agent-webhooks.ts`, import `AgentType` from `src/lib/agents.ts`, and expose `getAgentWebhookUrl(agentType)`. Do not import this module from client components.

- [ ] **Step 3: Run TypeScript syntax check through build or editor**

Run:

```bash
npm run build
```

Expected: build completes or only reports pre-existing unrelated issues. If build fails because of the new file, fix before continuing.

---

### Task 3: Add Database Migration for Four Agents and Per-Agent Access

**Files:**
- Create: `supabase/migrations/20260629000001_four_agents_access.sql`

- [ ] **Step 1: Create migration**

Use:

```sql
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.chats
  DROP CONSTRAINT IF EXISTS chats_agent_type_check;

ALTER TABLE public.chats
  ADD CONSTRAINT chats_agent_type_check
  CHECK (agent_type IN ('comunicacao', 'apresentacao', 'conversas_dificeis', 'postagem'));

-- Detect public.users.id type and create user_agent_access.user_id to match
-- uuid, integer, or bigint deployments.
DO $$
DECLARE
  users_id_type TEXT;
  user_id_sql_type TEXT;
  access_user_id_type TEXT;
BEGIN
  SELECT udt_name
  INTO users_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'id';

  user_id_sql_type := CASE users_id_type
    WHEN 'uuid' THEN 'UUID'
    WHEN 'int4' THEN 'INTEGER'
    WHEN 'int8' THEN 'BIGINT'
    ELSE NULL
  END;

  IF user_id_sql_type IS NULL THEN
    RAISE EXCEPTION 'public.users.id type % is not supported for user_agent_access.user_id', users_id_type;
  END IF;

  IF to_regclass('public.user_agent_access') IS NULL THEN
    EXECUTE format($create_table$
      CREATE TABLE public.user_agent_access (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id %s NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        agent_type TEXT NOT NULL CHECK (agent_type IN ('comunicacao', 'apresentacao', 'conversas_dificeis', 'postagem')),
        enabled BOOLEAN NOT NULL DEFAULT true,
        expires_at DATE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE (user_id, agent_type)
      )
    $create_table$, user_id_sql_type);
  ELSE
    SELECT udt_name
    INTO access_user_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_agent_access'
      AND column_name = 'user_id';

    IF access_user_id_type IS DISTINCT FROM users_id_type THEN
      RAISE EXCEPTION 'public.user_agent_access.user_id type % does not match public.users.id type %',
        access_user_id_type,
        users_id_type;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_agent_access_user_id
  ON public.user_agent_access(user_id);

CREATE INDEX IF NOT EXISTS idx_user_agent_access_agent_type
  ON public.user_agent_access(agent_type);

CREATE INDEX IF NOT EXISTS idx_user_agent_access_enabled
  ON public.user_agent_access(enabled);

CREATE INDEX IF NOT EXISTS idx_user_agent_access_expires_at
  ON public.user_agent_access(expires_at);

ALTER TABLE public.user_agent_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_agent_access_service_role_all ON public.user_agent_access;
CREATE POLICY user_agent_access_service_role_all
  ON public.user_agent_access FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_plano_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_plano_check
  CHECK (
    plano IS NULL OR plano IN (
      'Todas',
      'Comunicação Executiva',
      'Apresentação para Reunião de Resultados',
      'Conversas Dificeis',
      'Postagem no Linkedin',
      'Personalizado',
      'Ambas'
    )
  );

-- Rollout warning: normalizing existing plans to 'Todas' must ship atomically
-- with app code that understands users.plano = 'Todas' and user_agent_access.
UPDATE public.users
SET plano = 'Todas';

INSERT INTO public.user_agent_access (user_id, agent_type, enabled, expires_at)
SELECT u.id, agent.agent_type, true, u.data_expiracao
FROM public.users u
CROSS JOIN (
  VALUES
    ('comunicacao'),
    ('apresentacao'),
    ('conversas_dificeis'),
    ('postagem')
) AS agent(agent_type)
ON CONFLICT (user_id, agent_type)
DO UPDATE SET
  enabled = EXCLUDED.enabled,
  expires_at = EXCLUDED.expires_at,
  updated_at = NOW();

COMMENT ON TABLE public.user_agent_access IS 'Permissoes por usuario e agente de IA. Tabela gerenciada principalmente pelas APIs server-side com service role.';
COMMENT ON COLUMN public.users.plano IS 'Resumo comercial/manual: Todas, Personalizado, Ambas legado ou nome de uma IA. Permissao efetiva fica em user_agent_access.';

COMMIT;
```

- [ ] **Step 2: Apply migration in Supabase SQL Editor**

Run the SQL above manually in Supabase. Expected:

```text
Success. No rows returned
```

- [ ] **Step 3: Confirm current users have all four access rows**

Run in Supabase SQL Editor:

```sql
SELECT user_id, COUNT(*) AS access_count
FROM public.user_agent_access
WHERE enabled = true
GROUP BY user_id
ORDER BY access_count ASC;
```

Expected: every current user has `access_count = 4`.

---

### Task 4: Centralize Access Control Helpers

**Files:**
- Modify: `src/lib/access-control.ts`
- Create: `src/lib/agent-access.ts`

- [ ] **Step 1: Create server-side access helper**

Create `src/lib/agent-access.ts`:

```ts
import type { AgentType } from '@/lib/agents';

type SupabaseClient = {
  from: (table: string) => any;
};

export async function userHasAgentAccess(
  supabase: SupabaseClient,
  userId: string,
  agentType: AgentType
) {
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, data_expiracao, plano')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    return { access: false, error: 'Erro ao buscar dados do usuário' };
  }

  if (user.data_expiracao) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiration = new Date(user.data_expiracao);
    expiration.setHours(0, 0, 0, 0);
    if (today > expiration) {
      return { access: false, error: 'Seu plano expirou. Renove para continuar usando.' };
    }
  }

  if (!user.plano || user.plano === 'Todas' || user.plano === 'Ambas') {
    return { access: true, user };
  }

  const { data: accessRow, error: accessError } = await supabase
    .from('user_agent_access')
    .select('enabled, expires_at')
    .eq('user_id', userId)
    .eq('agent_type', agentType)
    .maybeSingle();

  if (accessError || !accessRow || !accessRow.enabled) {
    return { access: false, error: 'Seu plano não inclui acesso a esta IA.' };
  }

  if (accessRow.expires_at) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiration = new Date(accessRow.expires_at);
    expiration.setHours(0, 0, 0, 0);
    if (today > expiration) {
      return { access: false, error: 'Seu acesso a esta IA expirou. Renove para continuar usando.' };
    }
  }

  return { access: true, user };
}
```

- [ ] **Step 2: Update client-side types**

In `src/lib/access-control.ts`, update `TipoIA` and `Plano` to include:

```ts
export type TipoIA =
  | 'Comunicação Executiva'
  | 'Apresentação para Reunião de Resultados'
  | 'Conversas Dificeis'
  | 'Postagem no Linkedin';

export type Plano = TipoIA | 'Todas' | 'Personalizado' | 'Ambas';
```

Expected: UI helpers still support old `Ambas` users while the database migrates to `Todas`.

---

### Task 5: Replace Duplicated Chat APIs with Generic Agent APIs

**Files:**
- Create: `src/app/api/chats/create-agent/route.ts`
- Create: `src/app/api/chats/message-agent/route.ts`
- Keep compatibility: existing create/message routes may delegate to the generic routes later

- [ ] **Step 1: Create generic chat creation route**

Create `src/app/api/chats/create-agent/route.ts` that:

- Reads `{ message, agentType }`.
- Validates JWT from `auth_token`.
- Uses `getAgentByType(agentType)`.
- Uses `userHasAgentAccess(supabase, userId, agent.type)`.
- Inserts `chats` with `agent_type: agent.type`.
- Inserts `scripts` with `input: message`, `output: null`.
- Sends the exact current payload to `getAgentWebhookUrl(agent.type)`.
- Returns `{ success: true, chat }`.

The webhook payload must remain:

```ts
const webhookPayload = {
  chatId: chatData.id,
  message,
  scriptId: scriptData?.[0]?.id,
  user: {
    id: userData.id,
    email: userData.email,
    nome: userData.nome,
    telefone: userData.telefone,
  },
};
```

- [ ] **Step 2: Create generic message route**

Create `src/app/api/chats/message-agent/route.ts` that:

- Reads `{ chatId, message }`.
- Loads chat and its `agent_type`.
- Uses `getAgentByType(chat.agent_type)`.
- Uses `userHasAgentAccess(supabase, userId, agent.type)`.
- Inserts `scripts`.
- Sends exact current payload to `getAgentWebhookUrl(agent.type)`.
- Returns `{ success: true, message: 'Mensagem enviada com sucesso', scriptId }`.

Use the exact payload:

```ts
const webhookPayload = {
  chatId,
  message,
  scriptId: scriptData[0].id,
  user: {
    id: userData.id,
    email: userData.email,
    nome: userData.nome,
    telefone: userData.telefone,
  },
};
```

---

### Task 6: Add Generic Agent Pages

**Files:**
- Create: `src/app/dashboard/agent/[agentType]/page.tsx`
- Modify: `src/components/chat/ChatInterface.tsx`
- Modify: `src/components/chat/ChatDetail.tsx`

- [ ] **Step 1: Add dynamic agent start page**

Create `src/app/dashboard/agent/[agentType]/page.tsx` based on `src/app/script/page.tsx` and `src/app/dashboard/apresentacao/page.tsx`.

Behavior:

- Read `agentType` from params.
- Look up agent in `AGENTS`.
- If missing, show not found.
- Render the existing chat start UI with the selected agent name.
- On submit, call `/api/chats/create-agent` with `{ message, agentType }`.
- Redirect to `/dashboard/chat/${chat.id}?new=true&type=${agentType}`.

- [ ] **Step 2: Update `ChatInterface` for dynamic agents**

Add props:

```ts
agentType: AgentType;
agentName: string;
```

Change create call from fixed `/api/chats/create` to:

```ts
fetch('/api/chats/create-agent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: userMessage.content, agentType }),
});
```

- [ ] **Step 3: Update `ChatDetail` send endpoint**

Change message send from choosing only `/api/chats/message` or `/api/chats/message-apresentacao` to always call:

```ts
fetch('/api/chats/message-agent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chatId, message: userMessage.content }),
});
```

Expected: existing two agents and new two agents send through the same payload shape to their own webhooks.

---

### Task 7: Update Dashboard, Sidebar, Mobile Menu, and Chat Labels

**Files:**
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/MobileMenu.tsx`
- Modify: `src/app/api/chats/route.ts`
- Modify: `src/app/api/chats/[chatId]/route.ts`
- Modify: `src/app/api/chats/[chatId]/messages/route.ts`

- [ ] **Step 1: Dashboard renders from `AGENTS`**

Replace local `agents` array in `src/app/dashboard/page.tsx` with `AGENTS`. Each card path should be:

```ts
`/dashboard/agent/${agent.type}`
```

- [ ] **Step 2: Sidebar and MobileMenu use `getAgentLabel`**

Replace hardcoded `Apresentação` / `Comunicação` labels with:

```ts
getAgentLabel(chat.agent_type || 'comunicacao')
```

- [ ] **Step 3: API chat filtering supports all agents**

Update chat filtering to use `user_agent_access`:

- If `users.plano` is `Todas`, return all chats.
- Otherwise load enabled `user_agent_access` rows and return only allowed `agent_type`.

Do this in:

- `src/app/api/chats/route.ts`
- `src/app/api/chats/[chatId]/route.ts`
- `src/app/api/chats/[chatId]/messages/route.ts`

Expected: users with one, two, three, or four agents only see/access allowed chats.

---

### Task 8: Preserve Backward Compatibility During Rollout

**Files:**
- Modify: `src/app/api/chats/create/route.ts`
- Modify: `src/app/api/chats/create-apresentacao/route.ts`
- Modify: `src/app/api/chats/message/route.ts`
- Modify: `src/app/api/chats/message-apresentacao/route.ts`

- [ ] **Step 1: Keep old routes working**

For the first rollout, do not delete old endpoints. Either leave them untouched or make them delegate internally to the same helper used by generic routes.

Required compatibility:

- `/api/chats/create` still creates `comunicacao`.
- `/api/chats/create-apresentacao` still creates `apresentacao`.
- `/api/chats/message` still sends only `comunicacao`.
- `/api/chats/message-apresentacao` still sends only `apresentacao`.

Expected: existing frontend paths do not break while dynamic pages are introduced.

---

### Task 9: Verification

**Files:**
- Test through app runtime and Supabase data.

- [ ] **Step 1: Run build**

Run:

```bash
npm run build
```

Expected: build completes. If build fails for pre-existing unrelated type/lint issues, document exact output and verify touched paths manually.

- [ ] **Step 2: Start local dev server**

Run:

```bash
npm run dev
```

Expected: app starts on `localhost:3000`.

- [ ] **Step 3: Manual browser checks**

Verify:

- Dashboard shows 4 agent cards.
- Existing Comunicação card starts chat and sends to old webhook URL.
- Existing Apresentação card starts chat and sends to old webhook URL.
- Conversas Dificeis starts chat and sends unchanged payload to its webhook URL.
- Postagem no Linkedin starts chat and sends unchanged payload to its webhook URL.
- Chat history labels show all four agent names correctly.
- User with `plano = 'Todas'` sees all four agents and chats.
- User with only one `user_agent_access` row sees/uses only that agent.

---

### Task 10: Update Living Handoff

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update architecture notes**

Record:

- There are now 4 agents.
- Agent definitions live in `src/lib/agents.ts`.
- Payload to n8n remains unchanged.
- Access control uses `user_agent_access`.
- `users.plano = 'Todas'` means all available agents.
- Hotmart integration is planned as a later phase.

- [ ] **Step 2: Verify doc diff**

Run:

```bash
git diff --check
```

Expected: no whitespace errors.
