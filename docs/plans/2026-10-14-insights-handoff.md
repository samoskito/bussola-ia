# Handoff: implementação local de Insights

Status atual em15/10/2026: painel/API em produção com piloto REAL de200 mensagens (50porIA),GPT-5.4 nano low e tetoTOTALUS$1. Migration aplicada; produçãofbf75d4.200/1435=13,9%,62itens em revisão; usuário informou que está revisando o painel. Nenhum cron diário, histórico completo, MCP remoto ou Hotmart direta. Relatório atual: docs/audits/2026-10-15-insights-pilot-rollout.md. As decisões e restrições de14/10 abaixo são histórico; a atualização detalhada ao fim registra o estado vigente.

## Histórico do ponto de retomada — 2026-10-14

Atualização 15/10/2026: plano organizado no ClickUp, espaço Geral → pasta Bússola IA → [Plano de ação — Insights, OpenAI e MCP](https://app.clickup.com/30916694/v/l/li/1400710000001965). São 15 tarefas (4 concluídas localmente, 1 impedimento por chave/orçamento e 10 a fazer), com critérios e dependências. IDs e snapshot em `docs/plans/2026-10-15-clickup-insights.md`. Outras demandas devem usar listas separadas; consultar estado atual das tarefas antes de retomar.

**Decisão mais recente:** aguardar a chave OpenAI do cliente, prevista para amanhã. O usuário descartou o teste do ChatGPT via túnel temporário. Retomar a preparação de uma integração hospedada para testar com dados reais; essa intenção não autoriza automaticamente migrations, publicação ou chamadas pagas agora. Nenhum túnel foi criado.

**Já pronto:** painel admin com filtros/relatórios/exportação e validação manual inicial do usuário; API de consulta; pipeline e adaptador OpenAI desativados; migration aditiva preparada; MCP local somente leitura com cinco ferramentas e dados simulados. Commits locais de referência: `f3019ba` (Insights) e `9efec3e` (MCP demo). Testes locais registrados abaixo; conexão ChatGPT real e processamento real ainda não testados.

**O que falta para subir, em ordem:**

1. Receber/configurar a chave como segredo no servidor, sem colá-la no chat ou versioná-la. Confirmar organização, disponibilidade do modelo, autorização do piloto e teto de gasto; US$ 5 é sugestão ainda não aprovada.
2. Confirmar acesso e ambiente autorizado para validar a migration/RPCs, permissões, concorrência e orçamento. Aplicar em produção somente após validação e autorização específica.
3. Executar um lote real pequeno e delimitado, excluindo admins; revisar qualidade das categorias, minimização, contagens e custo antes de ampliar para 30 dias.
4. Implementar o caminho remoto do MCP: fonte real compartilhada com o painel, HTTPS, autenticação e autorização admin/escopos. O servidor demo atual rejeita produção e não deve simplesmente ser exposto com dados reais.
5. Confirmar recurso/permissões de MCP personalizado na conta ChatGPT do gestor; cadastrar o conector e validar as ferramentas após a hospedagem autorizada. Nenhuma chave OpenAI ou service role deve ser entregue ao ChatGPT.
6. Preparar publicação com configuração segura e executor diário que percorra os lotes; validar login, acesso negado a usuários comuns e consulta ponta a ponta. Publicar/ativar somente no checkpoint autorizado.

**Distinção para a retomada:** a chave OpenAI paga a classificação no backend. A consulta dos relatórios pelo ChatGPT usa o MCP e a conta do gestor, sujeita às permissões/limites dessa conta. Ter a chave não resolve, por si só, banco, hospedagem ou autenticação do MCP e não ativa nenhuma flag.

**Próxima ação:** quando o usuário trouxer a chave, revisar este handoff e o estado atual do repositório/configuração, concluir as preparações e apresentar lote, custo máximo e alterações de banco/publicação concretos antes de ativar. Até lá, manter OpenAI/processamento desligados; sem push, deploy, migrations ou agendamento. Servidores locais de demonstração são temporários e podem precisar ser reiniciados na próxima sessão.

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

Retomada real15/10/2026 concluída em piloto: migration20261014000001_insights.sql aplicada após PostgreSQL15.8 isolado;26testes passaram/TS tocado0/global14legados. Chave local cadastrada na Vercel como Secret; GPT-6 Luna404 na conta e usuário aprovou GPT-5.4 nano (models200), reasoning low. Produçãofbf75d4/deployGJ5XHaM2hMwBRXtzhiRsbHLD3Bi8 Ready.200classificações reais,50porIA,62para revisão/10não classificáveis. Painel mostra200/1435=13,9%,1235pendentes e29admins excluídos.0violações de roles/review/temas/tamanho. Custo conhecido estimadoUS$0,05393945;reserva durávelUS$0,104038 de tetoTOTALUS$1,mesmo scopeinsights-pilot-20261015-v1; reservas desconhecidas de falhas mantidas. Manifesto200IDs e segredo worker privados em.local-backups,DPAPI para credenciais. Não remover manifesto/trocar scope/renovar teto sem aprovação. Políticas conservadoras normalizam incerteza/temas contraditórios; snapshot ativo otimiza retomadas com testes de mudança/reversão. Classificação foi encerrada em200; nenhum cron diário/histórico completo/MCP remoto/Hotmart direta. API de consulta não gera custo de classificação. CSV real/filtros/JSONpayload verificados; download JSON precisa confirmação do usuário se necessário. Qualidade/anonimização não garantidas: exemplos em revisão podem conter referências residuais; revisar62 antes de ampliar/compartilhar. Aguardando aceite das categorias pelo usuário. Relatório vivo docs/audits/2026-10-15-insights-pilot-rollout.md; auditorias50/200 e resumo real sem textos de conversas. Proteções admin/reset permanecem ativas. Estado antigo sem deploy/chave neste handoff é histórico e foi substituído por esta atualização.

15/10/2026: MCP remoto REAL preparado localmente em rota Next separada do demo, com OAuth/PKCE/consentimento e role admin atual; testes SDK+SQL passaram. Ainda sem migration OAuth aplicada, segredos ou publicação. Claude na conta do Samuel primeiro, ChatGPT depois. Exemplos textuais desabilitados até revisão específica; agregados mantêm cobertura parcial do piloto200. Sem classificação nova/cron/Hotmart. Ver docs/plans/2026-10-15-insights-mcp-release.md e docs/audits/2026-10-15-mcp-live-validation.md antes de ativar.
