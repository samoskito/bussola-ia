# Hotmart direta — desenho, regras e roteiro de ativação

Estado em 22/10/2026: **implementado e testado localmente na branch `feat/hotmart-direta`; NADA aplicado/publicado.** Migration não aplicada, sem deploy, sem alteração em Vercel/Supabase/Hotmart/n8n. Substitui somente o fluxo comercial Hotmart → n8n → banco. Os webhooks n8n das quatro IAs (`src/lib/server/agent-webhooks.ts`, `/api/webhook`) e o contrato n8n dos chats não mudam.

## Visão geral

```text
Hotmart Webhook 2.0 ──POST /api/hotmart/webhook──► valida X-HOTMART-HOTTOK (tempo constante)
                                                 ► normaliza campos mínimos + SHA-256 do corpo
                                                 ► hotmart_ingest_event (idempotente) ► 200 rápido
                                                 └► after(): processHotmartEvent
                                                       claim → contexto → motor TS (puro) → commit SQL atômico
                                                       (shadow: só registra o plano; live: aplica) → convite
Admin ──/dashboard/hotmart──► sincroniza catálogo (API Hotmart) · mapeia ofertas · eventos · revisões
```

- Motor de regras: `src/lib/hotmart/rules.ts` (sem IO, determinístico, testado).
- Webhook: `src/lib/hotmart/webhook.ts` + `src/app/api/hotmart/webhook/route.ts`.
- Normalização (sem CPF/endereço/preço/payload): `src/lib/hotmart/normalize.ts`.
- Processador (reserva, retry por revisão, convite): `src/lib/hotmart/processor.ts`.
- Cliente API: `src/lib/hotmart/api.ts` (endpoints em `HOTMART_API`).
- Admin: `src/lib/hotmart/admin.ts`, `admin-access.ts`, rotas `src/app/api/admin/hotmart/**`, tela `src/app/dashboard/hotmart/page.tsx` + `src/components/hotmart/HotmartDashboard.tsx`; links no Sidebar/MobileMenu (só admin).
- SQL: `supabase/migrations/20261022000001_hotmart_direct.sql`.

## Modelo de dados (aditivo)

| Tabela | Função |
| --- | --- |
| `hotmart_offers` | Catálogo (produto ucode, oferta code, plano, preço) + mapeamento do admin: `agent_types`, `access_kind` (`single`/`subscription`/NULL = não configurada), `duration_days`, `grace_days`. Sync nunca sobrescreve o mapeamento. `source='webhook'` = stub criado por evento de oferta desconhecida. |
| `hotmart_events` | Registro durável: `event_id` único (idempotência principal) + índice único `(transaction, event_type, body_sha256)` (reenvio idêntico). Mesma transação+evento com corpo diferente é processada pelas regras de não regredir; campos mínimos (e-mail normalizado, nome, telefone, ids, status, datas), `body_sha256`, `mode` (shadow/live), `status`, `plan` (o que faria/fez), `result`. Sem hottok, CPF, endereço, preço ou corpo. |
| `hotmart_purchases` | Ledger por compra única (`tx:<transaction>`) ou assinatura (`sub:<subscriber_code>`): IAs, status (`active`, `canceled`, `delayed`, `disputed`, `revoked`), `access_until`, `next_charge`, transações já concedidas, último evento (ordem). `ON DELETE RESTRICT` no usuário. |
| `hotmart_access_state` | **Origem da concessão sem alterar `user_agent_access`**: valor que a Hotmart gravou por último (`materialized_*`) e a base manual existente quando a Hotmart assumiu a linha (`manual_*`). Linha atual = materializado → concessão Hotmart; diferente (painel, n8n, legado) → manual. |
| `hotmart_reviews` | Itens para decisão do admin (aceitar proposta / manter / descartar). |

Alterações em objetos existentes (somente aditivas): `admin_user_invitations.issued_by` passa a aceitar NULL com nova coluna `issued_by_system ('hotmart')` e CHECK exigindo um dos dois; nova RPC `admin_users_audit_read_v2` (mostra "Sistema Hotmart"; o app cai para v1 se a v2 não existir). `admin_users_mutate`/`admin_users_view` e migrations anteriores intactas. RLS habilitado em todas as tabelas novas, sem policies; grants só para `service_role`; helpers internos (`hotmart_apply_user_changes`, `hotmart_user_snapshot` etc.) não são executáveis nem pelo service role.

Ator de sistema: auditoria em `admin_user_audit` com `actor_id NULL`, ações `hotmart_user_created`/`hotmart_event_applied`/`invite_*` e `changes.actor = 'system:hotmart'`. Decisões de revisão gravam o admin real (`hotmart_review_accepted|kept|dismissed`).

## Acesso efetivo e origem

Para cada IA: `desejado = max(base manual, maior concessão Hotmart ativa)`, ordem `sem acesso < data < sem prazo`.

- Base manual = estado guardado se a Hotmart é dona da linha; senão o acesso atual efetivo (como `userHasAgentAccess` calcula: admin, plano global `Todas/Ambas` com `data_expiracao`, teto `data_expiracao` + grant).
- Concessões Hotmart ativas = compras `active|canceled|delayed` (cancelada/atrasada já têm `access_until` reduzido). Várias compras: vale a maior.
- Assim, **acesso manual nunca é reduzido automaticamente**. Quando um evento reduz a parte Hotmart e a base manual mantém acesso maior, nasce a revisão `manual_access_kept` com proposta "deixar só o que a Hotmart concede".
- Plano global/teto (`Todas`, `Ambas` ou `data_expiracao` preenchida, típico do n8n): só converte para `Personalizado` quando precisa estender; materializa as quatro IAs com o acesso efetivo atual (mesma regra do painel), tornando-se base manual das IAs envolvidas. Global sem prazo já cobre a compra → só ledger.
- Admins: ledger registrado, acesso vitalício intocado (SQL também bloqueia).
- `adminOnly`, `userHasAgentAccess`, painel admin e Insights/MCP não mudam.

## Regras por evento (máquina de estados do ledger)

| Evento | Efeito |
| --- | --- |
| `PURCHASE_APPROVED`, `PURCHASE_COMPLETE` | Oferta configurada obrigatória (senão `unmapped_offer`). Se já existe reembolso/chargeback da mesma transação (a qualquer tempo) ou reembolso/chargeback/protesto posterior desta transação/compra (reenvio atrasado da aprovação) → `grant_after_revocation`, sem liberar nem criar usuário. Compra única: exatamente N dias inclusivos — começando hoje vai até hoje+N−1; renovação soma N dias após a maior validade atual das IAs da oferta/compra. Assinatura: `date_next_charge + tolerância` (sem data: `max(hoje, atual) + duration_days ou 31`). Transação já concedida (APPROVED→COMPLETE, reenvio) não estende. `disputed` → `active`. Compra `revoked` → revisão `grant_after_revocation`. Comprador novo: cria `users` (`nivel user`, `Personalizado`, bcrypt de segredo aleatório) + convite. |
| `PURCHASE_REFUNDED`, `PURCHASE_CHARGEBACK` | `revoked` (terminal): corta na hora as IAs daquela compra. |
| `PURCHASE_PROTEST` | **Decisão:** tratado como chargeback (corta na hora), porém como `disputed`, não terminal: aprovação/complete mais recente da mesma transação restaura. Racional: contestação aberta = risco de estorno; restauração cobre disputa vencida pelo produtor. |
| `SUBSCRIPTION_CANCELLATION`, `PURCHASE_CANCELED` (assinatura) | `canceled`: `access_until = min(atual, date_next_charge)`; nunca estende. |
| `PURCHASE_CANCELED` (compra única) | Ativa → revisão `single_canceled` (proposta: revogar); senão ignorado (boleto/cartão não aprovado). |
| `PURCHASE_DELAYED` ou status de assinatura `OVERDUE`/`DELAYED` | `delayed`: `access_until = min(atual, data do evento + tolerância)`; tolerância por oferta, senão `HOTMART_GRACE_DAYS` (padrão 3). Após a data, `userHasAgentAccess` já bloqueia (sem cron). Nova cobrança aprovada reativa. |
| `UPDATE_SUBSCRIPTION_CHARGE_DATE` | Assinatura ativa e em dia: `next_charge` novo e `access_until = nova data + tolerância`. Em atraso (`delayed` ou status `OVERDUE/DELAYED` no evento): só atualiza `next_charge`; nunca estende sem pagamento. |
| `SWITCH_PLAN` | Sempre revisão `switch_plan` (mapeamento novo é decisão do admin). |
| Demais (`PURCHASE_EXPIRED`, `PURCHASE_BILLET_PRINTED`, carrinho, club…) | Registrado e ignorado. |

Ordem e duplicados: idempotência por `event_id` e por `(transaction, event_type, body_sha256)`; como o id faz parte do corpo, na prática a segunda chave só absorve reenvio byte a byte idêntico — eventos repetidos com outro id são processados e as regras os tornam inofensivos (transação já concedida não estende; status terminais não voltam). Evento mais antigo que `last_event_at` (ou recorrência menor) não regride — liberação antiga é ignorada, redução antiga vira `stale_event`. As revisões `stale_event`/`single_canceled` guardam só a mudança (`purchaseChange`: status e/ou teto de validade + `last_event_at` esperado); o aceite recalcula sobre a compra atual e é recusado com 409 (`review_outdated`) se a compra evoluiu depois da revisão. Datas de instante comparadas numericamente; datas de acesso são calendário America/Sao_Paulo inclusivo (como o resto do app).

Compras anteriores à integração (sem ledger, liberadas pelo n8n): reembolso/cancelamento/atraso gera `revocation_without_ledger` com proposta de teto para as IAs da oferta.

Cadastro: identidade por e-mail `lower(btrim)` (índice único existente). Preenche só `nome`/`telefone` vazios (reconferido sob lock no SQL); valores diferentes → `profile_divergence` (aceitar sobrescreve). No máximo uma revisão aberta por usuário + campo + valor, e ela é informativa: o evento cujo acesso foi aplicado fica `applied`. Compra cujo ledger pertence a outro usuário → `identity_mismatch`. Se o e-mail mudou no app mas o ledger existe, o ledger prevalece.

Concorrência: o processador reserva o evento (`hotmart_claim_event`, `SKIP LOCKED`, recuperação após 5 min), lê o contexto, calcula o plano e confirma com revisão otimista (`hotmart_user_revision` = snapshot admin + ledger + estado). Conflito → recalcula até 3 vezes. Criação usa o mesmo advisory lock por e-mail do painel.

Convite: somente usuário **criado** pela compra. Reaproveita `admin_user_invitations`, a origem fixa `ADMIN_USERS_APP_URL` (`appOrigin`) e `sendFirstAccessEmail` (SMTP/Brevo), exigindo os gates reais de e-mail do painel. **Decisão de validade:** convite de compra vale 72 h por padrão (`HOTMART_INVITE_TTL_HOURS`, 1–168; SQL limita a 168 h), porque o comprador não está aguardando o e-mail como num atendimento; mantém uso único, hash do token, fingerprint da senha e invalidação por novo convite/e-mail. Convites do painel continuam com 1 h. O texto do e-mail informa a validade. Convite pulado (gates de e-mail desligados), falha ao emitir ou falha de envio → revisão `invite_failed` (o admin reenvia pelo painel de usuários). Em shadow nenhum hash de senha é gerado nem gravado.

Recuperação de eventos parados (função encerrada após o 200; a Hotmart não reenvia): `GET /api/hotmart/reprocess` protegido por `Authorization: Bearer CRON_SECRET` (padrão Vercel Cron) ou `HOTMART_REPROCESS_SECRET` (≥ 16 caracteres, comparação em tempo constante). Reprocessa até 20 eventos `received`/`failed` com mais de 10 min e `processing` com lease vencido (5 min), até 5 tentativas, dentro de 45 s; o claim continua sendo o lease. Com `HOTMART_WEBHOOK_MODE=off` responde 200 `skipped` sem autenticar nem tocar o banco. Agendado em `vercel.json` diariamente (`0 10 * * *`, 07h BRT) porque o plano Vercel não foi confirmado e o Hobby só aceita cron diário (expressão mais frequente faz o deploy falhar); no Pro, trocar para `*/15 * * * *`. A tela mostra "eventos parados" com contagem e botão "Reprocessar parados" (mesma rotina).

## Modos (`HOTMART_WEBHOOK_MODE`)

- `off` (padrão): 503, nada lido nem registrado.
- `shadow`: valida, registra e calcula o plano; `hotmart_commit_event` grava apenas `plan` no evento (e stub de oferta desconhecida). Nenhuma escrita em `users`, `user_agent_access`, ledger, estado, revisões, auditoria ou e-mail. Eventos shadow são finais (não são reaplicados ao virar live).
- `live`: aplica.

## API Hotmart (incerteza documentada)

Constantes em `HOTMART_API`: token `POST https://api-sec-vlc.hotmart.com/security/oauth/token?grant_type=client_credentials&client_id&client_secret` com `Authorization: Basic HOTMART_BASIC`; base produção `https://developers.hotmart.com`, sandbox `https://sandbox.hotmart.com`; `GET /products/api/v1/products`, `/products/{ucode}/offers`, `/products/{ucode}/plans`; paginação `max_results`/`page_token` → `page_info.next_page_token`; 500 req/min (429 tratado). Token em cache em memória até 60 s antes de expirar; 401 renova uma vez. A documentação oficial é renderizada por JS e não pôde ser lida integralmente: o endpoint de **planos não foi confirmado** (404/400/403 = "sem planos") e nomes de campos de oferta/plano (`code`/`key`, `payment_mode`, `price.value`) são lidos de forma defensiva. Validar no sandbox antes do uso real.

Chave de mapeamento: `(product.ucode, purchase.offer.code)`. Apoios: oferta do ledger; `subscription.plan.id` quando único no produto; `product.id + offer`. Incerteza: `SUBSCRIPTION_CANCELLATION` não traz oferta (resolve pelo ledger `sub:`), `SWITCH_PLAN` usa `plans[current].offer.key`; formatos de `UPDATE_SUBSCRIPTION_CHARGE_DATE` lidos de forma tolerante (`dates.next_charge`/`date_next_charge`).

## Variáveis de ambiente (servidor)

`HOTMART_WEBHOOK_MODE=off|shadow|live`, `HOTMART_HOTTOK`, `HOTMART_CLIENT_ID`, `HOTMART_CLIENT_SECRET`, `HOTMART_BASIC`, `HOTMART_ENV=sandbox|production` (padrão sandbox), `HOTMART_GRACE_DAYS` (padrão 3), `HOTMART_INVITE_TTL_HOURS` (padrão 72), `CRON_SECRET` e/ou `HOTMART_REPROCESS_SECRET` (recuperação). A tela exige `ADMIN_USERS_MODE=live` (+ `ADMIN_USERS_WRITES_ENABLED` para sincronizar/mapear/decidir). Valores nunca saem do servidor (a tela mostra só presença booleana).

## Roteiro de ativação

1. Backup atual recuperável das fontes administrativas (mesmo padrão DPAPI de 15/10).
2. Aplicar **somente** `20261022000001_hotmart_direct.sql` manualmente no Supabase (não usar `db push` genérico). Conferir 5 tabelas com RLS e RPCs.
3. Deploy com `HOTMART_WEBHOOK_MODE=off` (rota responde 503; tela funciona).
4. Dono cria credenciais em Hotmart → Ferramentas → Credenciais e digita na Vercel `HOTMART_CLIENT_ID/SECRET/BASIC`, `HOTMART_ENV`; copia o hottok da conta para `HOTMART_HOTTOK`; cria `CRON_SECRET` aleatório (≥ 16 caracteres). Confirmar o plano Vercel antes do deploy com cron (ver Recuperação). Redeploy.
5. Admin abre `/dashboard/hotmart`, **Sincronizar**, mapeia cada oferta (IAs, compra única N dias ou assinatura, tolerância).
6. Cadastrar uma **segunda** URL de webhook na Hotmart (`https://ia.bussolaexecutiva.com.br/api/hotmart/webhook`, versão 2.0, eventos de compra/assinatura), mantendo a do n8n.
7. `HOTMART_WEBHOOK_MODE=shadow`; comparar por alguns dias cada evento ("Faria") com o que o n8n gravou; ajustar mapeamentos/revisões. Testar reenvio pelo histórico da Hotmart (idempotência).
8. Janela de troca: desligar no n8n **somente** o fluxo comercial que escreve users/acessos e, em seguida, `HOTMART_WEBHOOK_MODE=live` (evita escrita/convite duplicado). Fluxos n8n dos chats permanecem.
9. Acompanhar eventos `failed`/revisões; reprocessar pela tela.

Rollback: `HOTMART_WEBHOOK_MODE=off` (ou `shadow`) e reativar o fluxo comercial do n8n. Não remover tabelas; ledger/estado continuam válidos e um retorno posterior a `live` recomeça a partir deles. Eventos recebidos em `off` não são registrados (a Hotmart reenvia por 5xx). Não reverter a migration em produção.

## Riscos

- Endpoint de planos e alguns campos da API não confirmados; o fluxo de webhook não depende deles.
- Período de transição: compras liberadas pelo n8n não estão no ledger → reduções viram revisão manual (por desenho).
- Usuários com plano `Todas` + `data_expiracao` são tratados como concessão manual; podem acumular revisões após reembolsos até o admin decidir.
- `after()` na Vercel: se a função morrer antes de processar, o evento fica `received`/`processing`; a recuperação diária e o botão da tela o retomam (atraso de até 24 h sem ação do admin no plano Hobby).
- Validação SQL feita em PostgreSQL **16.15** descartável (imagem local; 15.8 do Supabase não estava baixada e não foi feito download). Nenhum teste contra Supabase real, SMTP real ou Hotmart sandbox.
- Shadow e n8n escrevem em paralelo; o plano shadow reflete o estado no momento do processamento.

## Validação local (22/10/2026)

- `npm run test:hotmart`: 43 testes (após a revisão de 22/10: reembolso antes da aprovação, aceite de revisão desatualizada, troca de data em atraso, N dias exatos, convite 72 h/revisão de convite, recuperação/cron) (hottok, modos, idempotência, ordem, todas as regras, cadastro, CPF/endereço, cliente API com fetch mockado, processador, autorização admin, webhook route).
- `npm run test:hotmart:postgres` (Docker, sem rede): aplica migrations admin + Hotmart, verifica permissões/RLS, idempotência, shadow sem escrita, live com criação/convite/auditoria de sistema, preencher só vazios (revisão de divergência única), revisão otimista, reembolso, mesma transação com corpo diferente processada sem regredir, reembolso antes da aprovação sem criar usuário, plano global → revisão → aceite, oferta não mapeada, eventos parados/lease/limite de tentativas, convite até 168 h, helpers internos sem EXECUTE.
- Regressão: admin 42, Insights 79, MCP 58 testes; `tsc` sem diagnósticos novos (14 legados); build isolado com env sintética aprovado.
