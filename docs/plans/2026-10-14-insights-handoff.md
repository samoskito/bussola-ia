# Handoff: implementação local de Insights

Status: estrutura implementada na branch local `codex/insights-demo`. Sem push, deploy, aplicação de migration, agendamento ou classificação de conversas reais. A demonstração usa dados inteiramente sintéticos.

## Entrega

- `/dashboard/insights`: painel admin com quatro IAs, período, ranking por pessoas distintas, volume por agente, gráfico acessível, exemplos mínimos e exportação CSV/JSON. Banner de demonstração persistente e layout desktop/mobile.
- GET `/api/insights/report`, `/summary`, `/topics`, `/trends`, `/examples`, `/export`: JWT HS256 com segredo obrigatório, nível atual consultado em users e respostas privadas/no-store. Não usar nível do JWT como autorização.
- Modo padrão `disabled`; `demo` funciona somente fora de produção; `live` requer ativação explícita. Uma chave OpenAI não ativa o serviço.
- Fixtures de 7/30/90 dias; default 30. Excluir admins e níveis desconhecidos antes de agregações, classificação/contexto e exemplos. A visão de clientes/chat não foi alterada.
- Classificador mock e adaptador OpenAI Responses API `gpt-6-luna`, reasoning low, JSON Schema estrito, `store:false`, limite de saída, sem ferramentas extras e sem SDK novo.
- Processamento em lotes de até 50, deduplicação por fonte/versão/hash, retomada de lotes, tentativas com espera, leases com relógio por operação, indicadores de fila restante e exclusão quando o nível do usuário muda.
- Minimização de identificadores diretos. Hash de fonte e contexto detecta mudanças mesmo quando o identificador é mascarado. Texto/contexto original não vai para logs ou tabelas derivadas. Minimização automática não garante anonimização completa.
- Contexto: até três mensagens do mesmo usuário/chat, anteriores, dentro de três dias. Worker busca 33 dias para processar fontes de 30 dias. Entradas acima de 6.000 caracteres ou contexto acima de 2.000 por mensagem recebem erro explícito; não são truncadas silenciosamente. Revisar política de entradas longas no piloto.
- Repositório Supabase preparado com hints explícitos, checagem de dono, paginação e limite de 20.000 registros, reconciliação de hashes/versões e dados derivados obsoletos omitidos da leitura.
- Orçamento global reservado de modo atômico antes da chamada, ajustado conservadoramente quando `usage` válido estiver disponível. Falhas/uso desconhecido mantêm a reserva; reasoning já está incluído nos tokens de saída.
- POST `/api/insights/process`: executor com credencial de máquina própria de pelo menos 32 caracteres e flags explícitas. Cookie admin não inicia trabalhos pagos. Nenhum cron foi adicionado ao `vercel.json`.
- Migration preparada `supabase/migrations/20261014000001_insights.sql`: quatro tabelas, RLS/revogações para acesso somente service role, taxonomia semeada, CAS e funções de orçamento. Nenhum UPDATE de usuários/chats/scripts.

## Como verificar sem chave

```powershell
npm run test:insights
npm run insights:demo
node tests/insights/typecheck.cjs
```

Para abrir o painel local com autenticação administrativa existente:

```powershell
$env:INSIGHTS_MODE = 'demo'
node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3100
```

Abrir `http://127.0.0.1:3100/dashboard/insights`. A autenticação existente faz leitura do usuário para validar a sessão; os relatórios demo não consultam scripts reais. Não há uma senha/admin de demonstração criado no banco. O servidor usado pela verificação foi encerrado após os testes.

As capturas do navegador usam uma sessão fictícia e todas as APIs interceptadas pelo teste; não provam login real. O teste aborta destinos externos e não altera o mecanismo de autenticação do produto. Prévia: `docs/audits/insights-demo-desktop.png` e `insights-demo-mobile.png`.

Para repetir a verificação visual, com o servidor local acima aberto, definir `INSIGHTS_BROWSER_MODULES` como a pasta de pacotes Node do runtime e `INSIGHTS_BROWSER_EXECUTABLE` como o executável local Chrome, depois executar `node tests/insights/browser.cjs`. Essas variáveis existem apenas no teste e não no aplicativo.

## Configuração preparada para a próxima etapa

Campos adicionados somente a `.env.example`, com padrão seguro:

```dotenv
INSIGHTS_MODE=disabled
INSIGHTS_OPENAI_ENABLED=false
INSIGHTS_PROCESSING_ENABLED=false
INSIGHTS_MAX_SPEND_USD=0
INSIGHTS_BUDGET_SCOPE=insights-pilot
INSIGHTS_CRON_SECRET=
OPENAI_API_KEY=
```

Não habilitar flags só porque a chave chegou. Antes de inferência real:

1. Confirmar responsável/cobrança, orçamento e autorização de envio da amostra tratada; teto de US$ 5 continua proposta, não gasto aprovado nesta etapa.
2. Revisar a migration e validar em ambiente de teste autorizado. Provar isolamento, RPCs, concorrência, CAS, leases, rejeições e orçamento com clientes reais nesse ambiente.
3. Configurar chave e segredo do executor somente no servidor e fora do Git/chat. Confirmar disponibilidade do modelo na organização OpenAI.
4. Rodar inicialmente a amostra limitada e revisar as categorias antes de completar o histórico. A preparação por lotes não seleciona automaticamente uma amostra representativa de 200; o operador deve delimitar o piloto. Quatro invocações de até 50 trabalhos equivalem ao limite máximo de 200 trabalhos, mas chamadas com falhas/retries precisam monitoramento.
5. Configurar um executor diário autorizado que percorra os lotes, respeitando `hasMore`, orçamento, atraso de retries e limite do piloto. Um único lote de 50 não processa o backfill de 1.456 mensagens. Não há cron ativo; o POST é apenas o hook preparado. Cada invocação pode consumir até 50 chamadas, então validar tempo de execução e continuidade antes de escolher hospedagem.
6. Validar login real admin/negação user, contagens contra SQL e atualização do painel; só então planejar publicação autorizada.

Atualização posterior: MCP local demo implementado em `mcp/insights`, com cinco ferramentas somente leitura, SDK oficial, transportes STDIO e HTTP loopback e as mesmas fixtures do painel. Ver `mcp/insights/README.md`. Seis testes MCP com clientes oficiais passaram; as configurações de Claude Desktop/Codex são exemplos não instalados. OAuth/HTTPS e conexão remota na conta ChatGPT/Claude não foram implementados/publicados. Autenticação remota e conta/plano do gestor continuam etapa específica.

## Validação e limites

- 18 testes automatizados locais passaram, com rede proibida e dados sintéticos. Cobrem autorização, flags, filtros, exportação, contagens, privacidade direta, repetição, fila, falha/retry, orçamento, `usage` e mudança de nível.
- Dry run passou: mock, exclusão de admin, avanço de lote, lease vencido, fonte modificada/restaurada e zero chamadas externas.
- Verificação Chrome headless passou: desktop, 390x844 sem overflow horizontal, filtros, CSV, estado desativado e bloqueio de usuário comum. Nenhuma API real de dados foi usada.
- HTTP local sem sessão: relatório e temas retornaram 401; executor desativado retornou 503; cache privado/no-store.
- Typecheck dos insights e UI tocada: zero diagnósticos. A checagem global continua falhando em arquivos legados fora desta funcionalidade; o build ignora tipos/lint por configuração preexistente.
- Foi corrigido um único erro JSX preexistente em profile: `SMTP -> API` agora usa `&gt;`, mantendo o texto visível e permitindo o verificador analisar o restante.
- Build local aprovado após integração; warnings existentes de Supabase/Browserslist. Nenhuma dependência foi instalada/alterada. O lockfile permaneceu intacto.
- SQL foi revisado estaticamente e não executado. Não declarar banco, budget em PostgreSQL, scheduler ou caminho OpenAI end-to-end validados.
- Uma alteração da fonte entre releitura e RPC pode temporariamente gerar resultado obsoleto. A leitura recalcula o hash e o omite; garantia transacional forte de revisão de texto/contexto exige validação adicional antes da ativação.
- As simulações do painel são classificações sintéticas predefinidas; o mock do worker serve para verificar infraestrutura, não para avaliar qualidade semântica do Luna.
- Desativação: `INSIGHTS_MODE=disabled` e flags false, revogar segredo do executor/conector. Preservar conversas originais; migration aditiva não deve ser revertida apagando fontes.

## Delegação e revisão

GPT-6.1 Sol high implementou backend/migration; GPT-6 Sol high implementou classifier/processor/repository; GPT-6.1 Sol medium implementou painel e navegação. Agente principal integrou contratos, corrigiu interfaces/layout identificados em validação, criou testes, revisou gates e registrou limites de ativação.
