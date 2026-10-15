# Preflight real administrativo — 15/10/2026

Somente leitura remota. Nenhuma migration, deploy, alteração de env, restauração, convite, classificação OpenAI ou alteração Hotmart/n8n nesta rodada. Candidato funcional local: `fa635a5eb9e46f37d896ac98ddef910d9c4dcf1b`.

## Supabase conferido

Projeto `iszynegxctqdfrmizila`, organização Bussola script, ramo main/PRODUCTION. Consulta `scripts/admin-production-preflight-readonly.sql` executada em transação READ ONLY; evidência sanitizada em `2026-10-15-admin-production-db-readonly.json`. Foram consultados somente catálogo/contagens, sem senhas, hashes de senha ou linhas cadastrais.

- PostgreSQL15.8;1694 usuários;0 grupos de e-mails duplicados normalizados;0 e-mails vazios/nulos;0 correspondências para o destinatário futuro de teste.
- Schema necessário disponível: users UUID, datas globais/individuais DATE, user_agent_access com UNIQUE(user_id,agent_type) e CHECK das quatro IAs; plano Personalizado aceito pelo CHECK existente; email_templates e password_reset_tokens compatíveis.
- users.id não tem default: RPC preparada fornece UUID. Diferenças de nullability/default das fixtures foram inspecionadas; criação/edição valida dados exigidos explicitamente.
- RLS ativo nas quatro tabelas existentes auditadas. Políticas de tokens/templates negam acesso comum; grants restringem service_role; users exige auth.uid igual ao id. Privilégios SQL amplos em anon/authenticated são limitados por essas políticas; não confundir GRANT SELECT com dados efetivamente visíveis.
- Verificação Data API com chave anon, GET count-only e limit0: zero linhas visíveis em users/user_agent_access/password_reset_tokens/email_templates. Evidência `2026-10-15-admin-production-anon-readonly.json`. Não foi criada sessão Supabase Auth para testar authenticated; o produto usa JWT próprio no backend.
- service_role tem permissões necessárias nas fontes; auth.role() e sha256(bytea) existem. Novas funções/tabelas ainda precisam ter grants/RLS confirmados após aplicação.
- Único gatilho não interno observado nas fontes: update_users_updated_at. FKs de chats/scripts aparecem duplicadas (com/sem CASCADE) como já observado, sem novo bloqueio à operação do painel. Auditoria nova adicionará DELETE RESTRICT a usuários auditados: conferir fluxo externo de exclusão.
- Não existem admin_user_revisions/admin_user_audit/admin_user_invitations, índice normalizado ou funções admin_users_*: sem colisão parcial detectada e confirmação de migrations ainda pendentes.

Compatibilidade adicional: suíte SQL completa repetida em imagem oficial `postgres:15.8-alpine`, mesma versão do servidor, fixture sintética com --network none/tmpfs/sem portas ou volumes reais. As duas migrations, permissões, datas individuais/cap global, snapshots, duplicidades e concorrência de convites/reset passaram; container removido. Arquivo temporário em .local-backups, sem credenciais/dados reais. Isso não aplicou SQL ao Supabase.

## Backup e recuperação

Página de backups agendados mostra backups físicos diários de08 a15/10/2026. Mais recente observado:15/10/2026 03:53:56UTC, equivalente a00:53:56 de Brasília, anterior às operações de hoje. Botão Restore disponível, não acionado. A disponibilidade visual não comprova restauração testada.

PITR não está ativado: página informa add-on disponível e pede habilitação. Não habilitado/contratado. Backups de banco não incluem os objetos físicos do Storage, como a própria página informa.

Antes das migrations: gerar/validar cópia atual recuperável dos dados e definições afetados e planejar restauração que não descarte vendas/alterações posteriores. Backup diário antigo e backups pontuais anteriores não atendem sozinhos esse ponto. Não requer contratar PITR; exportação atual protegida é alternativa a revisar.

## Vercel conferida após troca de login pelo usuário

Projeto correto: [bussola-ia](https://vercel.com/samoskitos-projects/bussola-ia), ID `prj_CbCOVqWWKDl9OdNIcOCH46UDSsUz`. Login anterior só mostrava outros espaços; acesso foi resolvido pelo usuário, sem criação de permissões.

Deployment Production Ready: `34Pis989Axhvnu91UbPm2HKHgLcD`, SHA `2248dcdfe3a307b64f56025e73fca5db32e184c2` (feat: release LinkedIn agent,27/07/2026), branch main. Histórico GitHub confirma o SHA; domínio de produção atual é **https://ia.bussolaexecutiva.com.br** e o alias https://bussola-ia.vercel.app também responde. Push em main dispara produção segundo a própria UI; nenhum push feito.

Build e runtime: Next.js, npm run build, output .next, npm install, raiz vazia, Node22.x. Production Overrides diferem dos settings de projeto; detalhe observado ao alternar visualização foi Development Command npm run dev; nenhum valor alterado. Ignored Build Step Automatic; sem deployment checks configurados; rolling releases desativado. Nenhuma dessas opções foi alterada.

Variáveis de projeto listadas, todas em All Environments: EMAIL_APP_URL, BREVO_API_KEY, BREVO_API_URL, BREVO_SENDER_NAME, JWT_SECRET, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS. Aba Shared confirma nenhuma variável compartilhada vinculada. Apenas EMAIL_APP_URL foi revelada (valor público https://bussola-ia.vercel.app); todos os segredos permaneceram mascarados. Presença não comprova valores/vigência nem sucesso de SMTP na hospedagem.

**Não constam nas variáveis de projeto/compartilhadas consultadas:** NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY; ADMIN_USERS_MODE/LIVE_ENABLED/WRITES_ENABLED/EMAIL_ENABLED/APP_URL; PASSWORD_RESET_ATOMIC_REQUIRED; flags Insights/OpenAI e OPENAI_API_KEY. Não inferir que o deployment antigo não tem valores embutidos/por deployment: essa inspeção é da configuração persistida para o próximo build. O servidor candidato exige service role explicitamente; configurá-la de forma segura antes de publicar.

SMTP_FROM/SMTP_SECURE não listadas; o código admite fallback de remetente para SMTP_USER e secure conforme porta. Confirmar valores na configuração futura sem expor segredos. JWT existente deve ser preservado; não rotacionar como parte automática deste rollout. O erro401 da API Brevo foi observado no uso local anterior, não se repetiu chamada com a chave mascarada da Vercel nesta auditoria. Não concluir que a credencial de produção é igual/inválida; revisar se o fallback for usado.

Cron Jobs: recurso geral está Enabled, mas a página exibe Getting Started e nenhum job cadastrado. vercel.json candidato não define crons. Não há executor Insights configurado nesta entrega; não desligamos configurações gerais alheias.

GETs sem sessão no alias atual: /api/admin/users404, /api/insights/summary404, /auth/first-access307 para login. O painel/Insights/novo primeiro acesso ainda não estão publicados. Página /auth/update-password respondeu200 no domínio customizado e no alias; nenhum token foi enviado nesses GETs.

## O que falta antes de aplicar/publicar

1. Cópia atual recuperável + plano de restauração. Não restaurar backup diário antigo como rollback automático das mudanças de hoje.
2. Preparar, sem publicar prematuramente, as três variáveis Supabase no projeto correto. A service role fica somente no servidor; não usar prefixo NEXT_PUBLIC nela. Validar projeto destino e preservar JWT.
3. Preparar flags e origem fixa do convite: ADMIN_USERS_APP_URL=https://ia.bussolaexecutiva.com.br recomendado. EMAIL_APP_URL atual aponta ao alias válido; alinhar ao domínio customizado é recomendável, mas não é erro de link quebrado. Conferir NEXT_PUBLIC_APP_URL/vercel.json ao definir domínio canônico.
4. Planejar PASSWORD_RESET_ATOMIC_REQUIRED=true para a versão nova, preservada durante desativação. Migrations/RPC precisam existir antes de ativar deploy que as exige; drenar versões anteriores antes dos convites.
5. No novo deployment, explicitar INSIGHTS_MODE=disabled, INSIGHTS_OPENAI_ENABLED=false, INSIGHTS_PROCESSING_ENABLED=false e INSIGHTS_MAX_SPEND_USD=0. A chave OpenAI local não precisa ser copiada para esta publicação. Nenhum cron/MCP remoto ou endpoint Hotmart direto deve ser ativado.
6. Conferir fluxo comercial n8n em leitura (export sanitizado ou acesso ao fluxo ainda não disponível aqui), para validar normalização do e-mail/upsert/retry diante do novo índice único e eventuais exclusões com FK de auditoria. Isso não é implementar Hotmart direta nem desativar n8n dos chats.
7. Após autorização explícita: aplicar somente as duas migrations administrativas em ordem, publicar SHA revisado inicialmente disabled e seguir etapas leitura/escrita/e-mail do roteiro. Criar conta controlada apenas se continuar ausente; destinatário define sua senha. Convite novo/SMTP no deploy e permissões RPC pós-migration ainda exigem essa validação real.

Não há autorização nesta rodada para qualquer item de escrita acima. Código testado localmente não equivale a banco migrado, variáveis configuradas ou publicação aceita.

Atualização autorizada15/10/2026 16:15 BRT: backup atual das quatro fontes administrativas criado com DPAPI e recuperação local PostgreSQL15.8 verificada (1694 users,4556 grants,437 tokens,1 template; igualdade de todos os registros). Doze variáveis Production salvas na Vercel com admin/Insights/OpenAI desativados, orçamento0 e reset atômico true preparado para o próximo deploy. Service role já existia e coincide com local: preservada; inventário anterior era parcial. JWT/SMTP/Brevo preservados. Sem migrations, publicação, chamadas OpenAI, contas/e-mails de teste ou mudanças Hotmart/n8n. Evidências/limites e roteiro: docs/audits/2026-10-15-admin-backup-vercel.md. Backup inclui dados/definições das quatro fontes, não chats/scripts/Storage ou recuperação integral; depende do perfil Windows DPAPI. Hotmart direta posterior; verificar compatibilidade do fluxo atual antes do índice, sem implementar substituição agora.
