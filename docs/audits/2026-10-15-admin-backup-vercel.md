# Backup atual e configuração Vercel — 15/10/2026

Autorização: gerar backup atual e configurar variáveis; não aplicar migrations nem publicar. Hotmart direta adiada. Operações Supabase exclusivamente de leitura nesta etapa.

## Backup e teste de recuperação

Snapshot MVCC em 15/10/2026 19:06:16 UTC (16:06:16 BRT), PostgreSQL15.8, projeto iszynegxctqdfrmizila. Escopo: quatro tabelas existentes afetadas pelo painel e suas definições, não o projeto inteiro.

| Tabela | Registros recuperados |
| --- | ---: |
| users | 1694 |
| user_agent_access | 4556 |
| password_reset_tokens | 437 |
| email_templates | 1 |

Cópia privada: `.local-backups/admin-pre-migration-2026-10-15T19-05-48-324Z.dpapi`, ignorada pelo Git, criptografada por Windows DPAPI CurrentUser; exige o mesmo perfil/chaves Windows para descriptografar. Nenhum dado pessoal, hash ou token em relatórios/versionamento. Não é cópia portátil independente deste perfil.

`scripts/admin-backup-snapshot-readonly.sql` captura dados, tipos/defaults, constraints, índices, funções de trigger/auth, triggers, policies, RLS e grants; inclui metadados de referências externas, mas não suas linhas.

`scripts/verify-admin-backup-local.cjs` descriptografou em memória e restaurou dados/definições em container oficial postgres:15.8-alpine, sem rede, portas ou volumes, com data directory em tmpfs. Contagens e igualdade JSONB de todos os registros ordenados conferiram; container removido. Digests textuais podem diferir por representação numérica após restauração dos tipos, por isso a comparação final usa igualdade de valores JSONB. Recibo sanitizado: `2026-10-15-admin-backup-recovery.json`.

Não inclui chats/scripts, demais tabelas/schemas nem objetos Storage. Não demonstra recuperação integral do Supabase. Backup físico diário permanece disponível; PITR não contratado. Repetir snapshot se novas operações precederem uma migration futura.

Restauração futura deve ser dirigida aos objetos/linhas afetados após comparar o estado corrente; não truncar nem substituir as tabelas cegamente, não descartar compras/histórico posteriores e não remover linhas com vínculos externos. Restaurar a cópia em ambiente isolado primeiro, comparar diferenças e preparar reparo transacional específico antes de qualquer escrita real. Nenhum script de restauração remota automática foi criado.

## Vercel

Projeto samoskitos-projects/bussola-ia, prj_CbCOVqWWKDl9OdNIcOCH46UDSsUz. Salvas e localizadas na UI **12 configurações novas apenas em Production**:

| Chave | Valor/origem |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | Projeto iszynegxctqdfrmizila, env local conferida |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Chave pública anon local, sem valor neste relatório |
| ADMIN_USERS_MODE | disabled |
| ADMIN_USERS_LIVE_ENABLED | false |
| ADMIN_USERS_WRITES_ENABLED | false |
| ADMIN_USERS_EMAIL_ENABLED | false |
| ADMIN_USERS_APP_URL | https://ia.bussolaexecutiva.com.br |
| PASSWORD_RESET_ATOMIC_REQUIRED | true |
| INSIGHTS_MODE | disabled |
| INSIGHTS_OPENAI_ENABLED | false |
| INSIGHTS_PROCESSING_ENABLED | false |
| INSIGHTS_MAX_SPEND_USD | 0 |

Correção do inventário anterior: SUPABASE_SERVICE_ROLE_KEY **já existe**, tipo Config, All Environments, adicionada em09/06/2025. A tentativa de adicioná-la como Secret foi recusada por duplicidade e não alterou o valor. Busca focada localizou o registro existente; comparação em memória confirmou igualdade exata com a credencial local funcional. Valor novamente ocultado e preservado. A listagem anterior era parcial; não usar sua contagem de nove como inventário completo. Migração desse registro para o tipo Secret pode ser planejada separadamente, sem rotação automática.

JWT/SMTP/Brevo/EMAIL_APP_URL existentes não alterados. Chave OpenAI não enviada à Vercel. Nenhum Redeploy acionado; a UI confirmou que novo deployment é necessário para as configurações salvas entrarem em vigor. PASSWORD_RESET_ATOMIC_REQUIRED=true exige instalar e validar a RPC antes de publicar a versão candidata; não publicar antes das duas migrations administrativas.

Evidência visual com escopo Production e OpenAI false: `2026-10-15-vercel-insights-disabled.png`.

## Pendências

Antes da aplicação: renovar diagnóstico de duplicidades, revisar versão exata e compatibilidade do índice normalizado com o fluxo comercial atual sem alterar/desligar o n8n. Integração Hotmart direta fica para depois; não é requisito implementar essa substituição para publicar o admin.

Depois de autorização específica: aplicar apenas as duas migrations admin, conferir RPC/cache/privilégios, publicar SHA revisado com gates desativados, habilitar consulta/escrita/envio em fases e testar suporte@palmup.com.br. Nenhuma conta/e-mail de teste executado nesta rodada. Insights real, classificador OpenAI, cron e MCP remoto ainda têm plano separado; configurar flags não conclui essas integrações.
