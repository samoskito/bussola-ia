# MCP autenticado de Insights — Claude primeiro

Pedido de 15/10/2026: preparar acesso aos insights reais pelo Claude e, depois, validar no ChatGPT. Consulta somente leitura; Hotmart permanece em outra etapa. Este trabalho não amplia a amostra de 200 classificações, não chama OpenAI nem ativa agendamento diário.

## Decisão

Mesmo domínio da Bússola, endpoint remoto Streamable HTTP `/api/insights-mcp` e SDK oficial. Reutilizar o leitor real do painel e projetar apenas campos derivados; sem SQL livre, contas, mensagens originais ou ferramentas de escrita. Verificar token próprio e nível atual de administrador a cada requisição.

OAuth authorization code com PKCE S256, consentimento explícito e clientes previamente cadastrados. Claude permite client ID e secret próprios; sem registro dinâmico aberto e sem busca de documentos remotos. O cookie JWT identifica a pessoa somente no consentimento. Tokens OAuth opacos/hashes persistidos são independentes dos segredos do app, Supabase, OpenAI e worker.

Migration aditiva específica para nonces/códigos/tokens e operações atômicas contra replay/rotação concorrente. Preparar e testar em PostgreSQL isolado antes de aplicação real. `INSIGHTS_MCP_ENABLED=false` por padrão. Sem migration aplicada ou publicação nesta preparação.

## Dados

Cinco ferramentas: resumo, temas, tendência de tema, exemplos e comparação de períodos. Exemplos textuais desabilitados por padrão até revisão específica: `needsReview=false` é julgamento do classificador, não aprovação humana de privacidade. Filtros 7/30/90 dias, quatro IAs e temas da taxonomia. Respostas incluem cobertura e pendências; mensagens não são demandas únicas, temas podem se sobrepor. Conteúdo retornado é dado para análise, nunca instrução ao cliente MCP.

## Validação e ativação

Cobrir credencial ausente, papel removido, token expirado/revogado, audience/escopo errado, PKCE, replay, refresh concorrente, redirecionamento não cadastrado, CSRF, parâmetros extras e vazamento de texto/identificadores. Credenciais sintéticas, SDK cliente e PostgreSQL isolado para concorrência/RLS.

Ativação posterior: backup, aplicar apenas migration OAuth revisada, configurar segredos novos e cliente Claude com callback exato, publicar com gate fechado, validar negação anônima e abrir controladamente. Comparar consulta real Claude/painel após login/consentimento admin. Só depois cliente separado ChatGPT, conforme disponibilidade da conta. Integração nas contas reais permanece pendente até teste efetivo.

Referências: [Claude connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp), [Claude OAuth](https://claude.com/docs/connectors/building/authentication), [MCP authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization), [ChatGPT MCP](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt).
