# Reconciliação autorizada — executada e verificada

## Resultado final — 15/10/2026, 12:21 BRT

Após confirmação humana imediatamente antes da exclusão permanente, transação executada com sucesso no SQL Editor do projeto iszynegxctqdfrmizila. Seis contas removidas (cinco duplicatas e um cadastro vazio) e 24 grants dependentes removidos por cascade. Jorge e Frankicinaldo atualizados para 30/11/2026. Eduardo preservado até 06/03/2030, Úrsula até 24/07/2027 com quatro IAs e Tânia somente LinkedIn até 22/09/2027.

Auditoria independente GET-only comparou as cinco contas principais integralmente ao backup DPAPI, permitindo apenas as duas datas autorizadas e seus updated_at: perfis, hashes de senha, grants e vínculos preservados. Permanecem 26 chats e 91 scripts. Varredura completa: 1693 usuários, zero grupos duplicados trim/lower e zero e-mail vazio/nulo. Evidências sanitizadas em `docs/audits/2026-10-15-identity-reconciliation-result.json` e `docs/audits/2026-10-15-admin-users-readonly-after-reconciliation.json`. Captura privada em `.local-backups/reconciliation-completed-2026-10-15.png`.

Revisão de identidades no ClickUp concluída. Nenhuma migration aplicada, nenhum painel publicado, nenhum convite/e-mail enviado e nenhuma alteração em Hotmart/n8n/OpenAI. Editor deixado com consulta de conferência somente em leitura. Seções abaixo preservam o histórico do preparo anterior; seus estados pendentes foram superados por este resultado.

Autorização humana em15/10/2026, incluindo esclarecimentos assíncronos: preservar as cinco contas principais; prazos por grupo G1 30/11/2026, G2 06/03/2030, G3 30/11/2026, G4 24/07/2027 com quatro IAs (plano global legado já efetivo), G5 somente LinkedIn até22/09/2027. Remover cinco duplicatas sem histórico e o cadastro sem nome/e-mail/telefone após backup e vínculos. G2 inicialmente ambíguo foi explicitamente confirmado como2030; não reduzir para2026.

**Estado real: nenhuma alteração de conta executada.** Somente GETs no Supabase, preparo local e testes sintéticos. Chave atual é Data API/service role; não concede execução SQL genérica. Sessão do navegador verificada mostra apenas Bio PNA e não autoriza o projeto Bússola. Necessário acessar o editor SQL do projeto correto ou configurar conexão SQL segura, sem colar segredos no chat.

Preflight das11 contas: todas user comuns; as6 remoções têm zero chats/scripts/templates vinculados e24 linhas de permissões. Cinco primárias somam26 chats e91 scripts. Todas as FKs a users expostas pela Data API foram verificadas; transação preparada verifica também catálogo PostgreSQL completo antes de escrever e aborta se houver outra relação.

Backup completo de users e grants criptografado por Windows DPAPI CurrentUser, com roundtrip/hash verificado, em `.local-backups/`, excluído do Git. Plano com identidades e SQL privado também nesse diretório; sem credenciais ou hashes de senha brutos no SQL (apenas fingerprint). Não versionar esses arquivos nem transportar para ferramentas externas. Snapshot mais recente em11:16 BRT: `identity-reconciliation-2026-10-15T14-16-07-295Z.dpapi`; roteiro com sufixo `.sql`.

Roteiro transacional: bloqueia11 usuários e suas permissões, verifica snapshot completo, fingerprint da senha, grants/histórico, duas mudanças de validade global, seis exclusões e preservação das cinco primárias. Lock timeout5s e statement timeout30s. Não envia convites, não muda senhas, não aplica migrations nem modifica Hotmart/n8n. A execução aborta se qualquer precondição mudar; nesse caso, renovar snapshot/backup e conferir novamente, não remover guardas.

Revisão por agente identificou janela de concorrência no plano inicial REST; esse caminho de escrita foi desabilitado ANTES de qualquer execução. A alternativa SQL foi testada em postgres17-alpine temporário sem rede com dados inteiramente sintéticos: sucesso, rollback por mudança de grants, rollback por história nova e rejeição da repetição. Container removido.

Depois da execução real: repetir auditoria GET-only (`scripts/audit-admin-users-readonly.cjs --after-reconciliation`) e conferir cada conta/UUID, datas,26 chats/91 scripts preservados, zero duplicidades/zero e-mail vazio. Só então encerrar revisão e retomar a ativação do painel. Não marcar resolvido por existir um roteiro/teste sintético.

## Conferência no projeto correto — 15/10/2026, 11:55 BRT

Sessão do navegador agora acessa o projeto iszynegxctqdfrmizila. Consulta somente em leitura ao pg_catalog confirmou quatro relações distintas para public.users: chats.user_id e scripts.user_id (cada uma com duas constraints existentes), email_templates.updated_by (SET NULL) e user_agent_access.user_id (CASCADE). Único gatilho não interno observado nas duas tabelas: update_users_updated_at, que atualiza updated_at. Nenhuma relação adicional encontrada.

Novo preflight GET-only e backup DPAPI verificado: identity-reconciliation-2026-10-15T14-55-31-078Z.dpapi. Roteiro correspondente carregado no SQL Editor e texto integral conferido por comparação com o arquivo local. Ainda NÃO executado. Regra da ferramenta de navegador exige confirmação no momento da exclusão permanente mesmo com autorização prévia; pendente somente dessa confirmação antes de Run. Não houve migration nem publicação.
