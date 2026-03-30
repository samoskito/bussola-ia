# CLAUDE.md - Guia do Projeto Bussola IA (ExecutivIA)

## Visão Geral

**Nome:** Bussola IA / ExecutivIA
**Descrição:** SaaS para geração de scripts profissionais para reuniões de negócios usando IA
**Versão:** v1.0.7
**Idioma da UI:** Português (Brasil)
**URL de Produção:** https://bussola-ia.vercel.app

## Stack Tecnológico

| Categoria | Tecnologia |
|-----------|-----------|
| Framework | Next.js 15.3.8 (App Router) |
| Frontend | React 19.1.0, TypeScript 5.4.5 |
| Estilização | Tailwind CSS 3.4.1 (tema escuro, cor primária: `#FF6B00`) |
| Banco de Dados | Supabase (PostgreSQL) |
| Autenticação | JWT (jsonwebtoken) + bcryptjs |
| Email | Nodemailer + Brevo API (fallback) |
| Deploy | Vercel (primário), Netlify (secundário) |
| Analytics | Vercel Analytics |
| IA/Processamento | n8n Webhooks (externo) |

## Estrutura de Diretórios

```
src/
├── app/
│   ├── api/                          # API Routes (18 endpoints)
│   │   ├── admin/email-template/     # Gerenciamento de templates de email (admin)
│   │   ├── auth/                     # Login, logout, registro, forgot/reset password, session
│   │   ├── chats/                    # CRUD de chats + envio de mensagens
│   │   │   ├── create/               # Criar chat Comunicação Executiva
│   │   │   ├── create-apresentacao/  # Criar chat Apresentação
│   │   │   ├── message/              # Enviar mensagem (comunicação)
│   │   │   ├── message-apresentacao/ # Enviar mensagem (apresentação)
│   │   │   └── [chatId]/messages/    # Buscar mensagens de um chat
│   │   ├── user/                     # Profile, avatar, password
│   │   └── webhook/                  # Recebe respostas da IA via n8n
│   │
│   ├── auth/                         # Páginas de autenticação
│   │   ├── login/                    # Tela de login
│   │   ├── register/                 # Tela de registro
│   │   ├── forgot-password/          # Recuperação de senha
│   │   ├── reset-password/           # Reset de senha com token
│   │   └── update-password/          # Atualização de senha
│   │
│   ├── dashboard/                    # Área logada principal
│   │   ├── page.tsx                  # Seleção de agente
│   │   ├── apresentacao/             # Interface do agente Apresentação
│   │   ├── chat/[chatId]/            # Visualização de chat individual
│   │   ├── profile/                  # Perfil do usuário (+ admin: templates de email)
│   │   ├── help/                     # Ajuda
│   │   └── select-agent/             # Seleção de agente IA
│   │
│   └── script/                       # Páginas do agente Comunicação Executiva
│       └── chat/[chatId]/
│
├── components/
│   ├── access/                       # AccessDenied, AccessWarning, ExpiryToast
│   ├── auth/                         # LoginForm, LogoutButton, ProtectedRoute, ResetPasswordForm
│   ├── chat/                         # ChatInterface, ApresentacaoInterface, ChatDetail, EnhancedChatInterface
│   ├── layout/                       # Header, Sidebar, MobileMenu
│   ├── scripts/                      # ScriptGenerator, ScriptGeneratorChat, ScriptViewer
│   └── common/                       # AccessRestricted
│
├── contexts/
│   └── AuthContext.tsx               # Estado global de autenticação
│
├── hooks/
│   └── useAuth.ts                    # Hook de autenticação
│
├── lib/
│   ├── access-control.ts            # Lógica de controle de acesso por plano/expiração
│   ├── auth-utils.ts                # Utilitários de autenticação
│   ├── database.types.ts            # Tipos TypeScript das tabelas
│   ├── db-functions.ts              # Funções de banco (CRUD chats/scripts)
│   ├── storage-functions.ts         # Upload de arquivos (avatars)
│   ├── webhook.ts                   # Integração com n8n webhooks
│   ├── app-url.ts                   # Helper de URL da aplicação
│   ├── email/                       # Templates de email
│   └── supabase/                    # Clientes Supabase (server.ts, client.ts, server-auth.ts)
│
├── middleware.ts                     # Proteção de rotas (verifica auth_token cookie)
│
├── types/                            # Definições TypeScript
├── styles/                           # Cores customizadas Tailwind
├── utils/supabase/                   # Utilitários Supabase (client, server, middleware)
└── scripts/                          # Scripts utilitários (hash, upload imagens)

supabase/
├── setup-database.sql                # Schema principal
├── create-password-reset-tokens.sql  # Tabela de tokens de reset
├── audit-and-harden-rls.sql          # Políticas de segurança RLS
└── migrations/                       # Migrações de banco
```

## Funcionalidades Principais

### 1. Dois Agentes de IA
- **Comunicação Executiva** — Gera scripts de comunicação executiva
- **Apresentação para Reunião de Resultados** — Gera apresentações para reuniões de resultados

Cada agente possui:
- Endpoint de criação de chat separado
- Endpoint de envio de mensagens separado
- Interface de chat dedicada (ChatInterface vs ApresentacaoInterface)
- Webhook n8n diferente

### 2. Sistema de Planos e Acesso
- **Planos:** `'Comunicação Executiva'` | `'Apresentação para Reunião de Resultados'` | `'Ambas'` | `null`
- **Expiração:** Campo `data_expiracao` na tabela users
- **Lógica:** Se `plano` é null → acesso total (retrocompatibilidade)
- **Avisos:** 7 dias antes (warning), 3 dias antes (crítico), 0 dias (bloqueio)
- **Verificação:** Feita em cada request aos endpoints de chat
- **Arquivo:** `src/lib/access-control.ts`

### 3. Autenticação
- Login com email/senha → bcrypt.compare → JWT (30 dias) → cookie httpOnly `auth_token`
- Middleware (`src/middleware.ts`) protege todas as rotas exceto `/auth/*`, `/api/*`, assets
- Níveis: `admin` (gerencia templates de email) e `user`
- Reset de senha via token seguro (crypto.randomBytes) com expiração de 1 hora

### 4. Fluxo de Chat com IA (via n8n)
```
1. Cliente envia mensagem → POST /api/chats/create ou /message
2. API cria registro em chats + scripts (output=null)
3. API envia payload ao webhook n8n (assíncrono)
4. n8n processa com IA
5. n8n chama POST /api/webhook com a resposta
6. API atualiza scripts.output + tabela outputs
7. Frontend faz polling para buscar a resposta
```

**Webhooks n8n:**
- Comunicação: `https://webhookbussola.palmup.com.br/webhook/ia/bussolascript`
- Apresentação: `https://webhookbussola.palmup.com.br/webhook/ia/bussolascriptresultado`

### 5. Gerenciamento de Perfil
- Editar nome, email, telefone
- Upload de avatar (Supabase Storage, buckets: `avatars` / `app-resources`)
- Alterar senha (requer senha atual)

### 6. Sistema de Email
- Envio via SMTP (Brevo) com fallback para API HTTP
- Templates customizáveis pelo admin (tabela `email_templates`)
- Variáveis de template: `{{reset_url}}`, `{{email}}`, `{{support_email}}`, `{{app_name}}`

## Schema do Banco de Dados

### Tabela `users`
- `id` (UUID), `email`, `nome`, `senha` (bcrypt hash)
- `telefone`, `avatar`, campos de endereço (rua, numero, bairro, cep, cidade, estado, pais)
- `nivel` ('admin' | 'user'), `plano`, `data_expiracao`
- `created_at`, `updated_at`

### Tabela `chats`
- `id` (UUID), `user_id` (FK), `title`, `agent_type` ('comunicacao' | 'apresentacao')
- `created_at`, `updated_at`

### Tabela `scripts`
- `id`, `user_id` (FK), `chatid` (FK), `input`, `output` (nullable)
- `created_at`, `updated_at`

### Tabela `outputs`
- `webhook_id`, `user_id`, `chat_id`, `input`, `output`
- `status` ('pendente' | 'processando' | 'concluido' | 'erro')

### Tabela `password_reset_tokens`
- `email`, `token_hash`, `expires_at`, `used_at`

### Tabela `email_templates`
- `template_key`, `subject`, `html_content`

## Variáveis de Ambiente Necessárias

```env
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Autenticação
JWT_SECRET=

# Email (SMTP)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
SMTP_SECURE=false

# Email (Brevo API - fallback)
BREVO_API_KEY=
BREVO_API_URL=https://api.brevo.com/v3/smtp/email
BREVO_SENDER_NAME=Bussola IA

# Storage
NEXT_PUBLIC_AVATAR_BUCKET=avatars

# Ambiente
NODE_ENV=development
```

## Comandos de Desenvolvimento

```bash
npm run dev        # Servidor de desenvolvimento (localhost:3000)
npm run build      # Build de produção
npm start          # Servidor de produção
npm run lint       # ESLint
```

## Convenções do Projeto

- **Idioma do código:** Variáveis e funções em português (ex: `verificarAcessoIA`, `getMensagemAviso`, `data_expiracao`)
- **Path alias:** `@/*` → `./src/*`
- **Tema:** Dark mode com cor primária laranja (#FF6B00)
- **Estado global:** React Context (AuthContext) — não usa Redux/Zustand
- **Estilização:** Tailwind CSS + classes customizadas em `globals.css` (.btn-primary, .btn-secondary, .input-field)
- **Notificações:** react-hot-toast
- **Ícones:** react-icons
- **Database client:** Supabase JS client direto (sem ORM)
- **Commits:** Versionamento no formato `bussola-ia-v1.0.X`

## Arquitetura de Segurança

- JWT em cookies httpOnly (proteção contra XSS)
- Senhas com bcrypt (10 salt rounds)
- Service role key apenas no servidor
- RLS (Row Level Security) no Supabase
- Tokens de reset com hash + expiração
- Middleware de proteção de rotas

## Pontos de Atenção

- Não há rate limiting nos endpoints (login, forgot-password, webhook)
- Não há verificação de assinatura nos webhooks recebidos
- Não há integração com gateway de pagamento (planos gerenciados manualmente)
- O processamento de IA é totalmente externo (n8n) — o código não contém chamadas diretas a LLMs
- Polling para respostas de chat (não usa WebSocket)
