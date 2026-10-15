# Bússola Insights: MCP local de demonstração

Atualização 15/10/2026: este pacote continua sendo o demo local isolado. A implementação remota com fonte real e OAuth foi preparada separadamente no Next.js (`src/lib/insights-mcp` e `/api/insights-mcp`), desabilitada por padrão. Não exponha este servidor demo. Ver [design real](../../docs/plans/2026-10-15-insights-mcp-live-design.md), [ativação Claude primeiro](../../docs/plans/2026-10-15-insights-mcp-release.md) e [validação local](../../docs/audits/2026-10-15-mcp-live-validation.md). A conexão real ainda depende de aplicação da migration específica, segredos e publicação autorizada.

Servidor MCP somente leitura com os relatórios sintéticos compartilhados pelo painel. Não consulta Supabase, não lê `.env`, não importa autenticação/serviços de produção, não escreve em banco/arquivos e não chama OpenAI ou qualquer LLM. Não precisa de chave. Este pacote está separado das dependências do Next.js.

## Iniciar HTTP local

No diretório principal do projeto:

```powershell
$env:MCP_INSIGHTS_MODE = 'demo'
$env:NODE_ENV = 'development'
node mcp/insights/server.cjs --transport http
```

Endpoint: `http://127.0.0.1:8787/mcp`. Saúde: `http://127.0.0.1:8787/health`.

O endereço de escuta é fixo em `127.0.0.1`; não existe opção de bind público. Para trocar a porta, usar `--port 8788` e ajustar o cliente de teste. Sem túnel, publicação ou CORS wildcard. Requisições com Host fora da allowlist ou Origin diferente do endereço local são negadas. O modo `live` e `NODE_ENV=production` são negados.

O HTTP é Streamable HTTP stateless com respostas JSON. GET e DELETE em `/mcp` retornam 405; não há SSE de eventos espontâneos. O transporte e a negociação de protocolo são do SDK oficial, não JSON-RPC improvisado. Limite de corpo 64 KiB e timeout de 10 segundos.

## Testar sem uma IA

Com o servidor HTTP acima aberto, no diretório principal:

```powershell
node mcp/insights/demo-client.cjs
```

O cliente usa o SDK oficial, conecta, lista as cinco ferramentas e chama o resumo de 30 dias. A resposta traz `mode: demo`, janela, critérios e contagens simuladas. O cliente tem endereço loopback fixo; não aceita URL remota ou credenciais.

Suite de testes, também sem inferência/banco:

```powershell
npm run test:mcp
npm run test:insights
```

Os testes MCP usam transportes em memória, HTTP loopback e um processo STDIO. Um sandbox que bloqueia sockets locais pode exigir permissão adicional somente para o teste HTTP.

## Ferramentas

| Nome | Uso |
| --- | --- |
| `get_insight_summary` | Resumo de mensagens, cobertura, pessoas, conversas e agentes |
| `list_demand_topics` | Temas ordenados por pessoas distintas e volume |
| `get_topic_trend` | Série diária de um tema; requer `topicId` |
| `get_topic_examples` | Até 12 exemplos fictícios; padrão 5 |
| `compare_insight_periods` | Comparação com período anterior de igual duração |

Parâmetros comuns: `days` em 7/30/90 (padrão 30), `agentType` em all/comunicacao/apresentacao/conversas_dificeis/postagem (padrão all), `topicId` opcional da taxonomia. Exemplos aceitam `limit` inteiro de 1 a 12. Não há SQL, paths, URLs, IDs de usuários ou operações de escrita nos argumentos. Campos desconhecidos são rejeitados.

Todas as ferramentas declaram leitura, idempotência, ausência de destruição e ausência de efeitos externos. Conteúdo em texto JSON e `structuredContent` coincide. Dados nunca devem ser interpretados como números reais da campanha. Contagens são mensagens, incluindo refinamentos; temas se sobrepõem. Pessoas por agente não são somáveis. Cobertura continua sendo do período/agente mesmo quando um tema é filtrado.

## Configurações prontas para clientes locais

STDIO: o cliente inicia o processo e troca mensagens pela entrada/saída padrão. Não precisa iniciar servidor HTTP separadamente.

- `config-examples/claude-desktop.example.json`: trecho para integrar ao arquivo de configuração do Claude Desktop.
- `config-examples/codex.example.toml`: trecho de configuração MCP local para Codex.

Os exemplos usam os caminhos absolutos desta máquina e `C:\Program Files\nodejs\node.exe`; ajustar em outra instalação. Mesclar ao arquivo do cliente, sem sobrescrever servidores existentes. Nenhuma configuração foi instalada no Claude, ChatGPT ou Codex por esta entrega. Logs do servidor STDIO vão somente para stderr, preservando stdout para o protocolo.

O loader transpila apenas cinco fontes puras do projeto via TypeScript já instalado no diretório principal. Ele exige o checkout completo e as dependências de desenvolvimento do projeto; esta pasta sozinha não é um pacote distribuível. Uma futura distribuição deverá compilar/incluir o domínio de relatórios em vez de copiar este loader de desenvolvimento.

Instalação reproduzível das dependências isoladas, quando necessário, a partir de `mcp/insights`:

```powershell
npm ci --ignore-scripts --no-audit --no-fund
```

SDK fixado: `@modelcontextprotocol/sdk` 1.32.1; validador Zod 4.6.7. SDK instalado suporta `2025-11-25` e versões anteriores. Esta entrega verifica compatibilidade com o cliente desse SDK; não promete revisão de protocolo 2026 ou integração já testada na conta final do gestor.

## Conexão futura em ChatGPT/Claude web

O endpoint local não é alcançável por servidores na nuvem. Antes de conectar clientes web: escolher hospedagem HTTPS autorizada, implementar OAuth e autorização admin/escopo a cada chamada, testar tokens/revogação, selecionar dados reais somente após validar o pipeline e confirmar recursos/permissões da conta do gestor. Não simplesmente publicar este servidor demo sem autenticação.

O login próprio em cookie da Bússola não é um servidor OAuth e não deve ser compartilhado como token do conector. A integração futura precisará de um provedor compatível ou bridge de identidade revisada; não foi criado OAuth fictício. Nunca entregar service role, chave OpenAI ou segredo do worker ao cliente MCP.

OAuth, HTTPS, conexão na conta do gestor e mudança para fontes reais continuam fora desta demonstração. Nenhuma porta pública, túnel ou automação foi criada.

Referências verificadas:

- MCP Node oficial e conexão no ChatGPT: https://developers.openai.com/plugins/build/app-quickstart
- Autenticação MCP: https://developers.openai.com/plugins/build/auth
- Configuração MCP local no Codex: https://learn.chatgpt.com/docs/extend/mcp
- MCP local no Claude Desktop: https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop
