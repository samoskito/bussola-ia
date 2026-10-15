# Ativação do MCP de Insights

Preparação local de 15/10/2026. Claude na conta do Samuel primeiro; cliente ChatGPT separado depois. Endpoint planejado: `https://ia.bussolaexecutiva.com.br/api/insights-mcp`. Este endereço não deve ser cadastrado antes da publicação/ativação. Não há conexão real concluída nesta preparação.

## O que será publicado

SDK MCP oficial em HTTP stateless, cinco ferramentas de consulta, leitor real compartilhado com painel, OAuth confidencial authorization code + S256 e consentimento explícito. Um token dá apenas `insights:read` para o resource exato. Cada chamada confirma que o titular continua admin. Não aceita cookie/JWT do app como bearer MCP.

Migration nova: `supabase/migrations/20261015000003_insights_mcp_oauth.sql`. Cria quatro tabelas operacionais OAuth e uma RPC transacional; RLS e acesso apenas service role. Armazena hashes de códigos/tokens, nonces consumidos e grants. Não altera `users`, `chats`, `scripts`, classificações ou acessos comerciais. As referências a `users` impedem apagar um titular com grants sem tratar esses vínculos explicitamente. Não rodar `supabase db push` genérico: migrations anteriores foram aplicadas manualmente e o histórico CLI não foi reconciliado.

## Configuração após aprovação da ativação

1. Conferir commit, estado do banco e backup atual. Salvar fotografia das configurações sem expor valores de segredos.
2. Aplicar apenas a migration OAuth revisada, em transação; conferir quatro RLS e RPC exclusiva da service role. Nenhuma outra migration pendente entra por conveniência.
3. Gerar um segredo aleatório independente para consentimento e outro para cada cliente OAuth, pelo menos 32 bytes aleatórios. Nunca colar no chat/ClickUp/Git. Registrar valores somente em gerenciador/secret Vercel; guardar a credencial do cliente para cadastro privado no Claude.
4. Definir `INSIGHTS_MCP_BASE_URL=https://ia.bussolaexecutiva.com.br`; `INSIGHTS_MCP_CONSENT_SECRET=<segredo novo>`; `INSIGHTS_MCP_CLIENTS_JSON` com `{clientId,name,clientSecretHash,redirectUris}`. O hash é SHA-256 hex minúsculo do segredo do cliente, não bcrypt. Cliente Claude usa redirect exato `https://claude.ai/api/mcp/auth_callback`. Nome exibido no consentimento deve identificar claramente Claude/Samuel. Sem coringas.
5. Publicar com `INSIGHTS_MCP_ENABLED=false` e `INSIGHTS_MCP_EXAMPLES_ENABLED=false`. Testar rotas novas negadas, login e painel existentes. Não modificar chave/modelo/orçamento/manifesto de 200 mensagens nem cron/Hotmart.
6. Habilitar somente MCP e publicar a configuração. Discovery deve responder metadados, e o resource anônimo 401 com `WWW-Authenticate` apontando ao protected-resource metadata. Não deve retornar relatórios sem bearer válido.

## Teste no Claude

Samuel abre Configurações → Conectores → adicionar conector personalizado, informa o endpoint HTTPS e escolhe usar cliente OAuth próprio, com ID e segredo cadastrados. A nomenclatura pode mudar conforme versão/plano. A documentação permite pré-cadastro, sem DCR. Não usar o serviço Supabase ou a chave OpenAI no formulário.

Samuel entra na Bússola com sua própria conta administradora e confirma a tela de somente leitura; senha digitada somente no site. Validar cancelar primeiro, depois reconectar/autorizar. Comparar os resultados com mesmos filtros do painel. Prompts sugeridos:

- “Consulte a Bússola: qual é a cobertura das classificações dos últimos 30 dias?”
- “Quais temas mais aparecem nas quatro IAs? Informe pessoas, mensagens e limitações da amostra.”
- “Compare os temas dos últimos 7 dias com o período anterior.”
- “Mostre exemplos de perguntas.” Deve informar que exemplos estão desabilitados, sem inventar textos.
- “Altere o acesso de um usuário.” Não há ferramenta de escrita para executar isso.

Conferir refresh após expiração do access token (10 minutos), desconexão, revogação efetiva e reconexão. Refresh expira em 30 dias absolutos e rotaciona a cada uso; reuso de código/refresh revoga toda a família. Chamadas simultâneas de refresh pelo cliente podem exigir reconectar, em vez de enfraquecer proteção. Desconectar a UI do Claude não deve ser presumido como revogação no servidor sem teste; desabilitar/remover cliente ou revogar o grant garante o bloqueio.

O MCP não chama a OpenAI. Conversar no Claude continua sujeito ao plano/limites do Claude. A classificação separada mantém o limite autorizado de 200 mensagens e teto total US$ 1. Cobertura parcial acompanha todas as respostas.

## Operação, interrupção e ChatGPT

Desativar `INSIGHTS_MCP_ENABLED` e publicar a configuração interrompe o resource sem afetar o painel; remover o cliente da configuração invalida chamadas/renovações dele. Para revogação pontual, identificar o grant por consulta admin e atualizar somente seu `revoked_at` no banco após autorização operacional; não apagar contas ou mensagens. Endpoint OAuth `/revoke` aceita token e credencial do cliente e revoga a família inteira. Não existe ainda uma tela de gerenciamento de grants. Registros expirados não têm limpeza agendada nesta versão.

Depois do aceite no Claude, confirmar plano/permissões da conta ChatGPT, cadastrar um segundo cliente/segredo/callback exato indicado pela plataforma e repetir discovery, consentimento, leitura, refresh e revogação. Não reutilizar o segredo Claude nem presumir callback/plano. Nenhuma necessidade de chave Anthropic para a conversa pelo conector. A conta Bússola que autoriza permanece admin nesta versão.

Referências de compatibilidade: [Claude OAuth](https://claude.com/docs/connectors/building/authentication), [conector remoto Claude](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp), [ChatGPT MCP](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt).
