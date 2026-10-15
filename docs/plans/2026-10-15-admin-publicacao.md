# Painel administrativo — revisão e roteiro de publicação

Estado em 15/10/2026: preparação e duas correções locais autorizadas; implementadas com testes repetidos. Migrations remotas, publicação, ativação e novos envios reais NÃO autorizados nesta etapa. Documento não executa operações. Hotmart direta e Insights/OpenAI/MCP ficam fora deste lançamento.

Preflight remoto posterior somente em leitura concluído: `docs/audits/2026-10-15-admin-production-preflight.md`. Schema compatível e sem duplicidades; teste adicional PostgreSQL15.8 passou. Projeto Vercel correto samoskitos-projects/bussola-ia, domínio ia.bussolaexecutiva.com.br, produção ainda2248dcd. Antes da aplicação faltam backup atual recuperável, configuração explícita das envs do próximo build e verificação do fluxo comercial n8n para o novo índice. Nenhuma configuração foi alterada nessa auditoria.

## Escopo e origem da revisão

Usuário quer publicar busca/cadastro/edição de usuários, gestão das quatro IAs, auditoria e primeiro acesso por link, exclusivamente para administradores. Destinatário de teste informado: suporte@palmup.com.br; pode ser conta nova, mas pesquisar novamente antes de criar na etapa autorizada de integração real. Não criar/enviar nesta rodada de correções. Não usar compradores reais para testes de alteração/revogação/senha.

Revisão delegada: GPT-6 Astra/high para backend/SQL/segurança; GPT-6.1 Sol/high para interface/convites e para execução de testes locais. Orquestrador consolida e decide os critérios de liberação. Relatório: `docs/audits/2026-10-15-admin-final-review.md`.

Base funcional original: commit `675ed7c`, branch `codex/admin-users-demo`; no fetch de preparação estava quatro commits à frente de origin/main e zero atrás. Correções seguintes e documentação compõem novo candidato local; registrar SHA exato do commit final antes de qualquer rollout. Não houve push. Não publicar uma branch móvel sem revisão do diff final. A branch contém Insights/MCP preparados: suas flags continuam desativadas, sem cron ou MCP remoto.

## Condições antes de autorizar publicação

1. Validar a correção autorizada de edição por IA: contrato agora exige quatro permissões com suas datas, sem uniformizar automaticamente. Grants inalterados e limites globais anteriores devem ser preservados nos testes; aceitar somente após validação integrada.
2. Validar a correção autorizada do reset independente das flags administrativas. A RPC passa a ser preferida em todos os modos. `PASSWORD_RESET_ATOMIC_REQUIRED=true` é obrigatório no rollout e permanece true ao desligar o painel; ausência/cache/erro da RPC não pode reabrir o legado. Antes da migration, fallback só para ausência explícita e assinatura exata. Drenar versões antigas antes de ativar convites.
3. Fechar resultados de testes e build isolado; conferir erros globais legados separadamente. Build ignora TypeScript/ESLint no next.config.js, portanto sucesso do build não substitui typecheck.
4. Revisar schema completo, privilégios, constraints e triggers exigidos pelas migrations no projeto correto; renovar diagnóstico de duplicidade antes da criação do índice. A limpeza anterior não impede surgimento de novos conflitos.
5. Verificar compatibilidade do n8n comercial atual com índice normalizado e semântica de acessos. Fluxo atual ainda pode sobrescrever concessões manuais; não prometer proteção automática que ainda não existe. Não desligar nem alterar n8n dos chats.
6. Confirmar destinatário e roteiro de teste controlado, conta administrativa disponível e acesso à hospedagem. As autorizações pontuais anteriores dos compradores não autorizam novos testes neles.

## Configuração prevista, sem valores secretos

Conferir variáveis no ambiente Production da hospedagem; presença local não comprova configuração na Vercel. Nenhuma chave service role/SMTP/OpenAI deve ser NEXT_PUBLIC, enviada ao navegador ou versionada.

| Variável | Publicação inicial | Consulta real | Escrita controlada | Convite real |
| --- | --- | --- | --- | --- |
| ADMIN_USERS_MODE | disabled | live | live | live |
| ADMIN_USERS_LIVE_ENABLED | false | true | true | true |
| ADMIN_USERS_WRITES_ENABLED | false | false | true | true |
| ADMIN_USERS_EMAIL_ENABLED | false | false | false | true |
| PASSWORD_RESET_ATOMIC_REQUIRED | true | true | true | true |

`PASSWORD_RESET_ATOMIC_REQUIRED=true` deve ser preparado para a versão nova antes da instalação/ativação e permanecer independente do painel. Não habilitar um deploy que exige RPC antes de sua instalação validada, para não interromper recuperação de senha. Coordenar ordem de migration e versão, sem alterar/desligar essa exigência para contornar falha de schema/cache.

Configurações adicionais:

- `ADMIN_USERS_APP_URL=https://ia.bussolaexecutiva.com.br`, origem fixa recomendada do convite novo, domínio principal conferido na Vercel.
- EMAIL_APP_URL existente na Vercel usa https://bussola-ia.vercel.app e o alias é válido. Recomenda-se alinhar para https://ia.bussolaexecutiva.com.br; revisar também APP_URL/NEXT_PUBLIC_APP_URL e a configuração de build em vercel.json (que ainda define alias). Não usar o localhost existente no .env.local para links reais.
- Configurar explicitamente NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no projeto correto, pois não aparecem no inventário de projeto/Shared consultado. A service role é somente servidor, sem prefixo NEXT_PUBLIC. JWT já presente: preservar valor para não interromper sessões.
- SMTP_HOST/PORT/SECURE/USER/PASS/FROM: revisar valores sem expô-los. SMTP aceitou mensagem pontual P2; ainda falta teste do convite novo na hospedagem. Brevo API recusou401: corrigir a credencial ou não configurar esse fallback; não declarar fallback funcional.
- `INSIGHTS_MODE=disabled`, `INSIGHTS_OPENAI_ENABLED=false`, `INSIGHTS_PROCESSING_ENABLED=false`, `INSIGHTS_MAX_SPEND_USD=0`. Chave OpenAI não é pré-requisito do painel admin. Não configurar executor/cron nem publicar MCP remoto nesta entrega.

Na hospedagem, mudança de env normalmente exige nova versão/deploy; não presumir desligamento instantâneo do processo em execução. Conferir comportamento real antes da janela de ativação.

## Execução futura, após aprovação explícita

### 1. Congelar versão e proteger recuperação

- Registrar SHA anterior em produção, SHA candidato, configurações anteriores e responsável pela janela. Definir versão de contenção compatível com reset atômico; o artefato antigo sem essa correção não é alvo seguro de rollback com convites ativos.
- Exportar backup completo recuperável dos objetos/dados afetados, incluindo usuários, grants, tokens existentes e definições de funções/constraints/policies. Os backups privados pontuais de11 contas/P1/P2 NÃO substituem backup completo para migrations.
- Backup físico diário mais recente conferido em15/10/2026 00:53:56 BRT, anterior às mudanças de hoje; Restore está disponível, mas não foi testado. PITR não está habilitado e não deve ser contratado automaticamente. Preparar cópia atual recuperável e plano de restauração antes das migrations; não presumir backup recente só pelo plano.
- Rodar auditoria somente leitura de identidades e revisar SQL das duas migrations em sua versão exata.
- Conferir privilégios de anon/authenticated/service_role, RLS e grants das novas RPCs; confirmar que não existe objeto parcial/conflitante de tentativa anterior. Preparar PASSWORD_RESET_ATOMIC_REQUIRED=true na configuração da versão nova sem iniciar deploy prematuro.

### 2. Aplicar apenas as migrations administrativas

Ordem explícita:

1. `supabase/migrations/20261015000001_admin_users.sql`
2. `supabase/migrations/20261015000002_admin_invitations.sql`

Cada arquivo tem sua própria transação. Se a segunda falhar, a primeira pode já estar aplicada: não repetir cegamente nem ativar o painel. Inspecionar estado parcial, corrigir causa e decidir retomada com backup. Nenhum script combinado/setup/fix-schema/deploy-database genérico deve ser usado. Nenhuma migration Insights/Hotmart faz parte desta etapa.

Índice único normaliza trim/lower; conflitos abortam. Não fazer merge/exclusão automática de contas para contornar falha. Aplicação não deve reescrever usuários/grants existentes. Comparar contagens e snapshots antes/depois e confirmar schema cache/RPCs disponíveis.

### 3. Publicar com funcionalidades desativadas

- Publicar SHA revisado somente após autorização, sem push/merge que possa disparar deploy automático antes dela.
- Manter admin disabled e todos gates de escrita/envio false; Insights/OpenAI continuam desativados. PASSWORD_RESET_ATOMIC_REQUIRED=true permanece e a RPC instalada deve responder antes de testar recuperação.
- Conferir login normal, chats, quatro agentes, recuperação existente e ausência de regressão no contrato n8n. Usar verificações de leitura; mensagens reais aos agentes exigem escopo de teste autorizado.
- Inspecionar erros e confirmar que bundles/client responses não contêm service role, segredo JWT, chave OpenAI, credenciais SMTP ou tokens em logs.

### 4. Habilitar consulta real

- Modo live + LIVE_ENABLED true; escrita/envio continuam false.
- Com admin: buscar por nome/e-mail/telefone, filtrar por IA/validade, conferir ficha e histórico de auditoria sem hashes/senhas.
- Com usuário comum e sem sessão: APIs negam acesso e não retornam dados de terceiros; verificar também revogação do papel admin com sessão ainda aberta em fixture/conta controlada.
- Escrita bloqueada deve retornar erro controlado, sem alterações no banco.

### 5. Habilitar escrita apenas para janela de teste coordenada

As flags atuais são globais: não existe allowlist automática de destinatários/testadores. Coordenar com os demais administradores antes de liberar escrita. Restrição ao usuário de teste é operacional, não uma proteção implementada.

- Confirmar e-mail fornecido e pesquisar de novo antes de criar. Se houver conta existente, não substituir senha/perfil/acesso: revisar alternativa.
- Criar user comum, conferir UUID, dados, plano, grants, validade e registro com ator/motivo; nenhum privilégio admin concedido.
- Buscar com variações de caixa e espaços; tentativa duplicada deve falhar sem registros parciais.
- Editar perfil com revisão antes/depois; simular revisão desatualizada e confirmar conflito sem sobrescrita.
- Conceder/revogar/renovar acesso, conferir vigência individual/global, bloqueio por expiração e preservação das demais IAs. Caso de validades diferentes deve passar após correção de pré-requisito.
- Checar auditoria de todas operações e proteção de contas administrativas.

### 6. Validar convite e senha

- Primeiro gerar link sem enviar, verificar domínio fixo/expiração/ausência de token em logs; gerar novamente deve invalidar anterior.
- Após autorização do destinatário, habilitar EMAIL_ENABLED e enviar somente à conta de teste; conferir aceitação pelo provedor e recebimento com o usuário.
- O próprio destinatário abre o link e define sua senha. Não criar/coletar senha dele no chat; o agente não consome o link para provar que funciona.
- Conferir token usado, rejeição da repetição, login e acesso às quatro IAs. Validar expiração/reemissão sem esperar horas no banco real (cenários de tempo já têm fixtures locais).
- Recuperação existente e convite concorrentes precisam manter consumo transacional único; não usar solicitações de envio em compradores reais para testar concorrência.

### 7. Aceite e observação

- Registrar versão, migrations aplicadas, evidências sanitizadas, envs apenas por nome/estado e resultado do destinatário de teste.
- Observar erros de RPC/autorização, conflitos, envios recusados e falhas do n8n comercial após índice. Não salvar senhas, hashes de senha, tokens ou payloads pessoais em auditoria Git/ClickUp.
- Só declarar painel publicado e validado após deploy, teste real de integração e aceite. Hotmart direta segue tarefa separada.

## Desativação e recuperação

Publicar apenas após testes da correção do consumidor atômico. Manter PASSWORD_RESET_ATOMIC_REQUIRED=true durante contenção, modo leitura e painel desativado; não executar rollback que reative código legado enquanto há tokens/requisições em voo.

Depois de corrigido e testado: bloquear novos envios/escritas, publicar configuração de contenção e verificar instâncias/solicitações em voo; se necessário desabilitar UI/leitura. Manter banco, auditoria, convites e índice; desativar painel não desfaz cadastros/acessos já autorizados. Invalidar convites de teste apenas com procedimento revisado quando necessário.

Não fazer DROP de tabelas/funções/índice como rollback automático. Restaurar dados pontuais somente com evidência e autorização; preservar alterações legítimas de compradores/n8n. Reverter código apenas para versão compatível com as migrations e com o tratamento seguro de tokens. Se houver conflito de schema, manter gates desativados e investigar antes de reenviar ou repetir migrations.

## Chave OpenAI: preparo separado

Não enviar a chave no chat. Usuário já definiu `OPENAI_API_KEY` em .env.local; presença conferida como booleano, gates OpenAI/processamento false e orçamento0. Arquivo ignorado pelo Git; nenhuma chave exibida, copiada ao build ou testada na API. Não mostrar valor em logs, prints ou relatórios. Na futura publicação Insights, configurar segredo no servidor da hospedagem, revisar modelo/orçamento e autorizar piloto separadamente.

Referência oficial consultada em15/10/2026: [OpenAI Developer quickstart — variável OPENAI_API_KEY](https://developers.openai.com/api/docs/quickstart). Nenhuma chamada paga foi feita para verificar a chave.

Atualização autorizada15/10/2026 16:15 BRT: backup atual das quatro fontes administrativas criado com DPAPI e recuperação local PostgreSQL15.8 verificada (1694 users,4556 grants,437 tokens,1 template; igualdade de todos os registros). Doze variáveis Production salvas na Vercel com admin/Insights/OpenAI desativados, orçamento0 e reset atômico true preparado para o próximo deploy. Service role já existia e coincide com local: preservada; inventário anterior era parcial. JWT/SMTP/Brevo preservados. Sem migrations, publicação, chamadas OpenAI, contas/e-mails de teste ou mudanças Hotmart/n8n. Evidências/limites e roteiro: docs/audits/2026-10-15-admin-backup-vercel.md. Backup inclui dados/definições das quatro fontes, não chats/scripts/Storage ou recuperação integral; depende do perfil Windows DPAPI. Hotmart direta posterior; verificar compatibilidade do fluxo atual antes do índice, sem implementar substituição agora.
