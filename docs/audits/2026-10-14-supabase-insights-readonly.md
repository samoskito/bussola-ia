# Diagnóstico de leitura: Supabase e insights

Data: 2026-10-14, America/Sao_Paulo. Janela: 14/09/2026 21:03:50 até 14/10/2026 21:03:50, início inclusivo e fim exclusivo. Snapshot de 30 dias corridos encerrado no início da auditoria; dados posteriores não entram nesta fotografia.

## Resultado

As credenciais em `.env.local` permitiram consultar o Supabase. `.env.production` aponta para o mesmo projeto. Nenhum valor de credencial foi exibido ou salvo nos artefatos. Todas as operações remotas foram GET na Data API; não houve RPC, escrita, migration, chamada a provedor IA ou deploy.

Fonte confirmada: `scripts` com `input`, `output`, `chatid`, `user_id` e timestamps; `chats` com `agent_type`; IDs de usuários e chats UUID, scripts integer. Foram verificadas relações entre scripts, chats e users através de consultas explícitas. A Data API retornou ambiguidade para o relacionamento scripts/chats: `fk_chat` e `scripts_chatid_fkey` apontam para as mesmas colunas. Usar uma relação explícita evita a ambiguidade; nenhuma constraint foi alterada.

### Atividade dos últimos 30 dias

| IA | Mensagens | Pessoas distintas | Conversas distintas |
| --- | ---: | ---: | ---: |
| Comunicação Executiva | 310 | 61 | 108 |
| Apresentação de Resultados | 138 | 16 | 20 |
| Conversas Difíceis | 647 | 58 | 83 |
| Postagem no LinkedIn | 391 | 45 | 68 |
| Total global | 1.486 | 129 | 279 |

Pessoas podem usar mais de uma IA, portanto as contagens de pessoas por agente não são somáveis. Mensagens não equivalem a perguntas/demandas distintas; não foi executada classificação temática.

Foram criados 273 chats na janela, enquanto 279 chats tiveram mensagens nela. São métricas diferentes. Há 17 mensagens na janela em chats criados antes dela; filtrar somente pela criação do chat perderia essa atividade.

No banco inteiro: 1.699 usuários, 1.998 chats e 9.798 scripts. São contagens de registros, não usuários ativos. A leitura paginada de 1.486 scripts coincide com a contagem exata retornada pela Data API.

### Qualidade e escopo

- Nenhum input nulo, vazio ou composto apenas por espaços na janela.
- Nenhum script com chat/usuário ausente no join ou com dono diferente do chat na janela.
- Todas as mensagens observadas se relacionam com um dos quatro agent_type esperados.
- 28 mensagens sem output registrado; não atribuir automaticamente a erro, pois o campo não distingue pendência/falha.
- 1.456 mensagens de 127 pessoas com nível atual `user`; 30 mensagens de duas pessoas com nível atual `admin`. O nível observado é o atual, não um histórico do momento do envio. Excluir admins do relatório é decisão pendente e não identifica todas as contas de teste.
- Texto de entrada: 484.877 caracteres ao todo, média 326, mediana 84, percentil 95 de 1.076 e máximo de 33.980 caracteres. Contagem de caracteres não estima tokens/custo com precisão. O classificador deve limitar contexto e tratar entradas longas explicitamente.
- Conteúdo dos inputs foi usado em memória apenas para medir tamanho/vazio; não foi armazenado nos relatórios, enviado a uma IA de classificação ou exibido no chat. Não foram lidos valores de senhas, e-mails, nomes ou telefones dos usuários.

### Metadados de schema e limites

- `users`, `chats`, `scripts` e `user_agent_access` aparecem no schema public exposto à Data API.
- `outputs` aparece, mas possui estrutura diferente da descrita pelo callback legado; não usar como fonte ativa dos insights.
- `mensagens`, `arquivos`, `script_insights`, `insight_jobs` e `insight_taxonomies` não aparecem nesse schema exposto. Isso não prova inexistência em outros schemas ou objetos não expostos.
- A leitura via service role não valida isolamento de RLS. Policies, definições de índices, triggers e CHECK constraints não foram auditados.
- Nos nomes convencionais de variáveis verificados em `.env.local`/`.env.production`, não foi encontrada conexão PostgreSQL ou token da Management API. Para inspeção completa de schema e migrations, usar acesso seguro compatível ou SQL revisado executado no SQL Editor pelo responsável.
- Não foram encontradas `OPENAI_API_KEY` nem `ANTHROPIC_API_KEY` preenchidas nesses arquivos. Isso não audita segredos configurados apenas no provedor de hospedagem ou em outros sistemas.

## O que falta antes de implementar/ativar

1. Definir pessoas autorizadas e escopo de dados: global ou por grupo. Separar leitura de agregados de acesso a exemplos; nível admin não deve ser exigido para todos.
2. Definir exclusão de contas internas/teste. Usar listas/permissões explícitas; decidir sobre as 30 mensagens de admins antes de montar o ranking final.
3. Escolher provedor e responsável pelo custo, limite do piloto e local seguro da credencial. Obter autorização para processamento da amostra real; começar com minimização e revisão humana das categorias.
4. Verificar policies/índices/constraints e disponibilizar ambiente para validar migrations aditivas. A chave atual serve para leitura pela Data API, sem permitir afirmar que todo o schema foi auditado.
5. Confirmar conta/plano/cliente ChatGPT ou Claude do gestor para provar autenticação e consulta no conector. Não bloqueia a preparação da parte interna do painel.
6. Confirmar executor diário e hospedagem efetiva. Vercel/n8n são descritos no projeto, mas limites/plano do executor não foram verificados nesta auditoria.

Defaults já aprovados: quatro IAs, 30 dias e atualização diária. A janela diária deve ser definida com fuso America/Sao_Paulo e exibida no relatório.

## Artefatos

- Dados agregados e metadados: `2026-10-14-supabase-insights-readonly.json`.
- Diagnóstico reproduzível: `scripts/audit-insights-readonly.cjs`, exclusivamente GET, com janela fixa desta auditoria e sem persistência de textos/IDs individuais. Não é o futuro job diário.
- Plano: `docs/plans/2026-10-14-insights-perguntas-implementation.md`.
