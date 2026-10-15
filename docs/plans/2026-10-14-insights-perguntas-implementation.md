# Plano de implementação: insights de demandas das IAs

Data: 2026-10-14. Status: direção aprovada pelo usuário; plano proposto, com decisões e acessos pendentes. Nenhum recurso implementado ou dado de produção processado nesta etapa.

## Objetivo e decisões

Permitir que gestores e equipe identifiquem necessidades recorrentes nos pedidos enviados às quatro IAs, com painel, API de leitura e classificação por IA. A consulta poderá ocorrer também no ChatGPT ou Claude do gestor através de integração autenticada.

Decisão do usuário: seguir com painel + API + IA classificadora. A plataforma e o plano exatos usados pelo gestor ainda não foram confirmados. Não foi escolhido provedor/modelo para classificação nem autorizado gasto ou envio de conversas reais a um provedor.

Escopo aprovado em 2026-10-14: quatro IAs, últimos 30 dias e atualização diária; painel exclusivo para admins, visão global e exclusão de mensagens de contas administrativas da classificação, contexto, métricas e exemplos. Verificar nível atual no servidor; contas de teste não administrativas ainda precisam de critério explícito. Painel integrado ao aplicativo e processamento assíncrono permanecem propostas de implementação.

Modelo recomendado, ainda não contratado/executado: GPT-6 Luna, reasoning low, com comparação de até 50 casos no GPT-6.1 Sol e revisão humana. Estimativa e orçamento proposto em `docs/plans/2026-10-14-insights-modelo-custo-piloto.md`: piloto de 200 mensagens US$ 0,50–1,50; período elegível completo com comparação US$ 1–3; teto sugerido US$ 5, não aprovado para gasto.

Descoberta de dados concluída em leitura pela Data API em 2026-10-14: 1.486 mensagens, 129 pessoas e 279 conversas ativas na janela. Schema ativo e vínculos conferidos; policies/índices/constraints ainda não inspecionados. Ver `docs/audits/2026-10-14-supabase-insights-readonly.md` para período exato, qualidade e limitações. Nenhuma classificação real ou migration executada.

## Base confirmada no código

- Fonte ativa: `scripts.input`, relacionada a `chats` por `scripts.chatid = chats.id`.
- Dimensão de agente: `chats.agent_type`; período pela criação do script.
- Respostas ficam em `scripts.output`. Complementos e reformulações também são linhas de scripts.
- Autenticação própria em cookie `auth_token`; autorização deve ser verificada no servidor.
- APIs atuais de chat verificam o dono; o painel terá uma permissão de insights própria.
- Backend usa service role; não entregar essa credencial à equipe, navegador ou conectores.
- Schema SQL local tem divergências históricas e não confirma o schema real em produção.
- Migração antiga preencheu agente por heurística do título. Mostrar essa limitação quando aplicável ao histórico.
- Preservar fluxo principal, gravação das mensagens e contrato n8n, inclusive payload sem campos extras.
- Em 2026-10-14, checkout limpo e main alinhada com origin/main após fetch, commit 2248dcd.

## Arquitetura proposta

```text
Chat atual -> scripts/chats no Supabase
                         |
               processamento assíncrono
               minimização + classificação
                         |
                dados derivados salvos
                         |
                serviço de insights
                  /              \
        painel autenticado     API/MCP autenticado
                                      |
                             ChatGPT/Claude gestor
```

API é a camada de consulta e permissões. MCP é um adaptador que apresenta funções dessa camada para as IAs. O conector de consulta não precisa chamar um modelo: retorna dados salvos e agregações calculadas pelo servidor. O ChatGPT/Claude produz a interpretação dentro da conta do gestor.

A classificação automática usa um provedor no servidor, independente da IA de consulta do gestor. Como opção inicial, usar credencial API do provedor. Avaliar uso elegível de plano ChatGPT apenas após confirmar disponibilidade e adequação ao aplicativo e à execução assíncrona; não depender dessa opção para o cronograma.

## Fase 1: descoberta do banco e definição do acesso

1. Confirmar schema, tipos, relacionamentos, timestamps, policies, índices e volume por período/agente com consultas limitadas e somente leitura.
2. Verificar qualidade dos vínculos scripts/chats, conteúdo vazio, cobertura histórica e identificação de contas de teste.
3. Definir quem acessa e qual conjunto de conversas entra na análise. O código não demonstra uma estrutura multiempresa/equipe pronta.
4. Criar ambiente de validação com dados sintéticos; separar amostra real autorizada de exemplos fictícios.
5. Estimar histórico inicial e custo do piloto, sem iniciar chamadas pagas.

Entrega: inventário confirmado, escopo de acesso e estimativa revisável. Pré-requisitos: acesso autorizado de leitura ao Supabase ou exportação controlada do schema e dados necessários.

## Fase 2: taxonomia e piloto de classificação

1. Definir tipos de mensagem: pedido inicial, pergunta, contexto, refinamento, confirmação e conteúdo não classificável.
2. Usar categorias estáveis de tema/necessidade e um resumo normalizado da demanda; evitar criar uma categoria livre nova por mensagem.
3. Usar contexto limitado da conversa para compreender complementos; não enviar histórico completo indiscriminadamente.
4. Minimizar dados enviados: remover identificadores diretos e avaliar risco residual de detalhes pessoais/empresariais no texto. Mascaramento automático não garante anonimização completa.
5. Validar saída estruturada e rejeitar respostas fora do contrato. Tratar texto das conversas como dados, sem executar instruções contidas nele.
6. Comparar um piloto pequeno com revisão humana; avaliar agrupamento incorreto, contexto insuficiente, custo e casos incertos.
7. Definir critérios de aceitação da classificação antes de processar todo o histórico.

Entrega: taxonomia versionada, exemplos revisados e escolha de provedor/modelo com custo observado. Hipóteses de produto/marketing serão apresentadas como interpretações, separadas das métricas.

## Fase 3: persistência e processamento confiável

Proposta de tabelas derivadas, a ajustar ao schema real:

- `insight_taxonomies`: versão e definição das categorias usadas.
- `script_insights`: referência ao script, hash da entrada/contexto relevante, versão da taxonomia/processador, tipo de mensagem, temas, demanda normalizada, confiança, estado de revisão, provedor/modelo e data de processamento. Definir cardinalidade para mensagens com mais de uma demanda.
- `insight_jobs`: lote, estado, contadores, tentativas, cursor, horários e custo/uso registrado quando disponível. Erros não devem armazenar conversas ou segredos em logs.
- MVP: acesso de leitura exclusivo para nível admin atual, verificado no servidor. Permissões específicas de equipe e escopos por grupo ficam para evolução futura; não exigir essa tabela no MVP.

Processamento fora das requisições de chat, usando executor agendado compatível com o ambiente confirmado. Escolher worker, tarefas no n8n ou outro executor após medir volume e limites de hospedagem. Não pressupor que uma função serverless processa todo o histórico de uma vez.

Idempotência por script, versão e hash do conteúdo/contexto; controlar concorrência, timeout, repetição com espera progressiva e estado terminal de falha. Reprocessar somente quando fonte ou versão mudar. Escolher explicitamente a versão ativa das classificações para que versões antigas e novas não dupliquem as métricas. Manter o conteúdo original intacto. Respeitar exclusões e mudanças da fonte; dados derivados não podem sobreviver indevidamente a exclusão ou perda de autorização.

Limitar tamanho dos lotes e consumo antes das chamadas. Interromper ao atingir o teto configurado e mostrar atraso/cobertura no painel. Limite interno e limite do provedor devem ser combinados, sem prometer precisão absoluta da cobrança.

Entrega: migrations aditivas revisáveis, piloto recuperável e execução incremental, com feature flag desligada por padrão até validação.

## Fase 4: API e painel

Rotas propostas, ainda não existentes:

- `/api/insights/summary`: volume, cobertura, pendências e última atualização.
- `/api/insights/topics`: ranking por período/agente e métricas comparáveis.
- `/api/insights/trends`: evolução e comparação com período anterior equivalente.
- `/api/insights/examples`: exemplos minimizados, limitados e com permissão específica.
- `/api/insights/export`: relatório limitado ao escopo autorizado.

Cada rota: autenticação, permissão consultada no banco, escopo fixado no servidor, filtros validados, intervalos/tamanho limitados e seleção explícita de colunas. Falhar fechado quando JWT_SECRET estiver ausente; não copiar fallback de segredo legado. Não aceitar SQL arbitrário ou escopo de usuário escolhido livremente pelo cliente. Cache deve incluir escopo e versão dos dados, evitando cruzamento de permissões.

Métricas: distinguir mensagens, demandas, conversas e pessoas distintas. Rankings devem indicar denominador, período, cobertura e critérios de exclusão; percentuais de temas podem sobrepor quando há múltiplos temas. Refinamentos não equivalem automaticamente a novas demandas. Exibir estado vazio, lote pendente, falha e cobertura parcial sem confundir ausência de classificação com ausência de procura.

Painel em rota própria dentro do dashboard existente, exclusivo para admins: filtros, ranking, tendências, exemplos e exportação. Fonte dos dados exclui mensagens de contas administrativas. Contagens virão do banco; a IA não calculará nem inventará números. Sem novo chat dentro do painel no MVP.

## Fase 5: conexão com ChatGPT/Claude

Implementar MCP remoto somente leitura sobre o mesmo serviço de insights. Ferramentas sugeridas: consultar resumo, listar temas, comparar períodos e obter exemplos permitidos. Nenhuma ferramenta de escrita, SQL livre ou listagem irrestrita de conversas.

URL HTTPS alcançável pelos clientes, com dados protegidos por autenticação. Propor OAuth com escopo `insights:read`, tokens de curta duração, revogação e autorização individual; avaliar provedor de identidade compatível com login próprio. Evitar criar OAuth improvisado. Não usar cookie do navegador como credencial do conector externo.

Fluxo esperado: gestor instala/conecta a integração -> autentica na Bússola -> autoriza leitura -> pergunta no ChatGPT/Claude -> ferramenta consulta dados autorizados -> IA responde com período, números e evidências. Instalação final depende de plano, cliente e controles do workspace confirmados.

Se ele usa um GPT personalizado com Actions, adaptar nossa API ao schema e autenticação suportados pode ser uma alternativa inicial. Não presumir que Actions e MCP são intercambiáveis. Testar exatamente o produto que ele usa antes de decidir o pacote de distribuição.

Sign in with ChatGPT é uma integração separada. Login/identidade não concede leitura dos nossos relatórios por si só nem libera inferência automaticamente. Uso do plano exige elegibilidade e permissões específicas. Não existe confirmação de elegibilidade deste SaaS nesta análise.

## Fase 6: validação e entrega

- Autorização: usuário comum negado, gestor permitido somente no escopo, token revogado/expirado negado e nenhuma informação privada no retorno indevido.
- Métricas: confrontar contagens com conjunto pequeno conhecido, usuários/conversas distintos, limites de data/fuso America/Sao_Paulo e temas com múltiplas etiquetas.
- Classificador: validar schema, incerteza, reformulações, conteúdo adversarial, idempotência, correções/exclusões e recuperação de falhas.
- Processamento: provar que falha do classificador não interrompe o chat/n8n; testar consumo limitado e lotes interrompidos/repetidos.
- Painel: validar desktop/celular, filtros, dados parciais, ausência de dados e exportação.
- Integração: consulta real em conta autorizada do gestor, incluindo login, escopo e revogação; não declarar integração concluída só por responder no servidor.
- Código: typecheck explícito, pois o build ignora tipos/lint; registrar erros preexistentes separados das regressões. Build e verificações adequadas às partes alteradas.
- Implantação: revisar SQL e executar em ambiente de validação antes de produção; apresentar mudanças e resultado dos testes antes de deploy e processamento real.
- Reversão: desligar worker/painel/conector por feature flag e revogar credenciais. Não apagar chats/scripts nem remover histórico original.

## Orquestração proposta

- Principal: decisões, integração, revisão e comunicação com usuário.
- GPT-6.1 Sol, reasoning high: arquitetura, dados derivados, classificador e API.
- GPT-6 Sol, reasoning high: revisão independente de permissões e integração MCP quando houver implementação.
- GPT-6 Luna, reasoning medium: inventários e verificações limitadas com critérios claros.
- GPT-6 Astra: reservar para uma questão arquitetural difícil que permaneça sem solução, sem uso obrigatório.

Agentes não devem editar os mesmos arquivos simultaneamente. Delegações de implementação começarão após as decisões pertinentes; nesta etapa foi delegada apenas revisão do plano.

## O que precisamos do usuário

Descoberta pela Data API concluída e acesso do MVP definido: admins com visão das quatro IAs, sem mensagens administrativas. Ainda conferir policies/índices/constraints e preparar validação de migrations.

Para piloto real: autorização para processar a amostra com o provedor escolhido; credencial em ambiente seguro, nunca colada no chat; responsável pela conta/cobrança e teto do piloto. Provedor/modelo pode ser recomendado após conhecer volume e requisitos.

Para consulta externa: confirmar ChatGPT/Claude, tipo/plano da conta, uso de GPT personalizado ou chat comum e existência de restrições de workspace. Validar a instalação na conta do gestor.

Decisões aprovadas: quatro IAs, últimos 30 dias, atualização diária, painel exclusivo para admins, visão global e exclusão de mensagens de contas administrativas. Minimização de exemplos continua requisito de implementação; provedor/modelo e orçamento recomendado ainda aguardam decisão antes de processamento real.

## Fontes verificadas para integrações em 2026-10-14

- Sign in with ChatGPT: https://developers.openai.com/siwc/quickstart
- Guia de uso elegível do plano: https://developers.openai.com/cookbook/articles/sign-in-with-chatgpt
- MCP em ChatGPT/Codex: https://learn.chatgpt.com/docs/extend/mcp
- Actions em GPT personalizado: https://developers.openai.com/api/docs/actions/introduction
- Claude MCP remoto: https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp

Disponibilidade deve ser reconferida na integração. O projeto não foi registrado como cliente Sign in with ChatGPT e nenhum conector foi publicado/configurado.
