# Ativação MCP — 15/10/2026

Autorização explícita: usuário respondeu “Pode seguir” ao roteiro de aplicar migration OAuth específica, configurar segredos e publicar em etapas, Claude primeiro na própria conta. Hotmart, expansão do piloto e cron fora do escopo.

## Backup e migration

Backup atual de 11 tabelas administrativas/Insights salvo em `.local-backups/mcp-current-data-2026-10-15.dpapi`, Windows DPAPI CurrentUser. Descriptografia recuperou bytes idênticos; recibo sanitizado `2026-10-15-mcp-backup-receipt.json`. Leitura REST por tabela/página, não uma transação MVCC global. Não inclui chats/scripts/Storage e não comprova restauração integral. O backup anterior com definições de quatro fontes permanece preservado. A primeira tentativa de capturar snapshot completo pela UI ficou truncada no componente (200 mil caracteres), não foi aceita como backup e não foi gravada como cópia válida. Nenhum dado pessoal foi versionado.

Preflight confirmou ausência dos quatro objetos OAuth/RPC; source counts 1695 users,2006 chats,9826 scripts,4560 grants,200 classificações. Aplicada exclusivamente `20261015000003_insights_mcp_oauth.sql` pelo SQL Editor Supabase, em transação. Resultado Success. Auditoria posterior confirma quatro tabelas RLS, RPC service role permitida, anon/authenticated negadas. Digests users/access/classificações idênticos antes/depois. Recibos `2026-10-15-mcp-before.json` e `2026-10-15-mcp-installed.json`. Histórico CLI não reconciliado; não usar db push genérico.

## Configuração e publicação

Cinco variáveis Production novas: flag `INSIGHTS_MCP_ENABLED` inicialmente false, base URL canônica, `INSIGHTS_MCP_EXAMPLES_ENABLED=false`, dois registros Secret para consentimento e clientes JSON. Segredos independentes gerados com 48 bytes aleatórios; segredo do cliente Claude preservado somente em envelope DPAPI privado para cadastro, hash SHA-256 no servidor. Nenhum valor sensível no chat, ClickUp ou Git. JWT, OpenAI, worker, Supabase e SMTP existentes preservados.

Push normal de main `fbf75d4..296a9ba`, sem força, após fetch/divergência2:0. Deploy fechado `HsRtXKeZUNZhyag6a21fMjh7oYGF` Ready (40s), domínio canônico. Smoke fechado passou: resource/discovery503, login/consent200, proteção DENY/no-store no consentimento, APIs insights/admin e worker anônimos401; quatro tabelas OAuth anon401. Evidência `2026-10-15-mcp-http-closed.json`.

Após essas verificações, somente a flag MCP foi alterada para true e redeploy da mesma versão solicitado: `Nn5THok7Bgw4ppm3L5KBQmnMBf8Z`. Exemplos permanecem false. A validação ativa e o aceite real no Claude serão registrados abaixo quando efetivamente concluídos.

## Claude

Sessão Claude encontrada conectada. UI atual moveu conectores para Personalizar. Formulário privado Bússola IA — Insights com URL canônica preparado; verificação inicial devolveu503 enquanto gate fechado, comportamento esperado. Não assumir conexão concluída nem autorizar consentimento em nome do usuário; a confirmação final de acesso aos dados deverá ocorrer na tela da Bússola.

Etapa ativa confirmada: deploy Nn5THok7Bgw4ppm3L5KBQmnMBf8Z Ready, fonte296a9ba. Smoke ativo passou: resource401/challenge Bearer, discovery200/S256, credencial de cliente inválida401/Basic, APIs admin/insights/worker anônimos401 e tabelas OAuth anon401. Recibo2026-10-15-mcp-http-active.json. Uma verificação antes do redeploy terminar ainda recebeu503, esperado; repetida após Ready e passou.

Claude: conector privado Bússola IA — Insights criado na sessão existente, com OAuth próprio e segredo exclusivo. Discovery remoto reconheceu autenticação e client ID pré-cadastrado. Login iniciado pelo Claude chegou à página /auth/insights-mcp, reconhecendo sessão administradora; consentimento mostra cliente/destino e escopo somente leitura. Nenhuma autorização final clicada pelo agente. Usuário foi solicitado a confirmar na tela, com duração access10min/refresh30dias e limites explícitos. Evidência2026-10-15-mcp-consent-ready.png. Homologação de consulta autenticada/refresh/revogação e ChatGPT continuam pendentes; não marcar conectado só por criar o conector. Aguardar ação do usuário e reler estado da aba11 antes de retomar. A tentativa de consultar capability visibility teve timeout de revisão automática; isso não indica rejeição de segurança. Tela aberta por link no painel Codex como alternativa.

Correção do consentimento após relato de acesso negado: falha reproduzida no navegador em formulário sintético. Referrer-Policy no-referrer no documento produzia Origin literal null no POST; o endpoint corretamente rejeitava. Alterado somente o documento de consentimento para same-origin, preservando Origin exato, nonce/CSRF, admin atual e ausência de Referer para destinos externos. Headers de respostas OAuth com código/tokens permanecem no-referrer. Browser atual envia Origin local correto; recibo docs/audits/2026-10-15-mcp-consent-policy-regression.json.11 testes direcionados passaram; publicação corretiva e nova validação real pendentes. Não criar grants manualmente nem relaxar aceitação de Origin null. Sem alteração de schema/segredos ou dados de negócio.
