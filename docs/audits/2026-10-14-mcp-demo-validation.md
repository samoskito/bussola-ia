# Validação do MCP local demo

Data: 2026-10-14, America/Sao_Paulo. Nenhuma publicação, migration, consulta Supabase ou chamada LLM executada nesta etapa.

Servidor `mcp/insights/server.cjs` e cliente `demo-client.cjs` usam o SDK oficial instalado no pacote isolado, versão 1.32.1, sem alterar dependências ou lockfile do painel Next. Zod 4.6.7 valida schemas estritos. SDK suporta o protocolo 2025-11-25 e revisões anteriores; este registro não afirma conexão em ChatGPT/Claude nem compatibilidade com revisão 2026 não oferecida pelo SDK instalado.

## Evidências

- `npm run test:mcp`: 6/6 passaram, cobrindo cliente real SDK em memória, HTTP loopback e subprocesso STDIO; lista exata de 5 ferramentas, filtros 7/30/90 e quatro agentes, parâmetros inválidos/escrita, exclusão administrativa, privacidade e flags demo/produção.
- HTTP: Host externo e Origin incompatível negados; corpo acima de 64 KiB negado; GET/DELETE em `/mcp` negados; rota desconhecida negada; nenhum CORS wildcard. Somente 127.0.0.1 é endereço permitido de escuta.
- `node mcp/insights/demo-client.cjs`: conexão HTTP local em 8787, discovery e chamada de `get_insight_summary` retornaram `mode: demo`, 160 mensagens elegíveis, 139 classificadas, 13 pendentes, 8 falhas, 19 pessoas e 120 conversas, com 3 mensagens administrativas sintéticas excluídas. São números fictícios, diferentes da auditoria real.
- O cliente listou `get_insight_summary`, `list_demand_topics`, `get_topic_trend`, `get_topic_examples` e `compare_insight_periods`.
- `npm run test:insights`: 18/18 passaram depois da instalação do pacote isolado.
- `node --check` passou em server, tools e loader. Typecheck dos Insights/UI tocada: zero diagnósticos; erros legados globais permanecem.
- O teste HTTP precisou de permissão de socket loopback no sandbox. Sem essa permissão, a conexão retorna EACCES; não foi necessário conectar a nenhum serviço externo de dados.
- Dependências obtidas do registry npm; instalador rodado com scripts desativados. Root `package-lock.json` intacto. Não foi necessário reiniciar/publicar o painel.

## Limites

Loader de desenvolvimento tem lista fechada de cinco módulos puros e shim somente para a classe de erro do parser de filtros. Não importa auth, service, processor, classifier, Supabase ou `.env`. Arquivos do projeto são código confiável do checkout; o loader não é uma sandbox para código de terceiros. Uma distribuição futura precisa empacotar/compilar esse domínio.

Nenhum cliente Claude/ChatGPT/Codex recebeu configuração, permissão ou credencial nesta etapa. O servidor demo não implementa OAuth nem autoriza dados reais. Não publicar esse processo como atalho para acesso remoto; preparar autenticação e escopo admin antes da futura conexão.

Servidor HTTP demo foi iniciado somente em `127.0.0.1:8787` para verificação local. O painel existente em 3100 foi preservado. Guia e configurações de exemplo: `mcp/insights/README.md` e `config-examples/`.
