# Modelo e estimativa do piloto de insights

Data: 2026-10-14. Estimativa antes de implementar, sem chamadas de classificação, gasto ou envio de conversas reais a um provedor.

## Decisões aprovadas

- Painel inicialmente exclusivo para `users.nivel = 'admin'`, verificado no servidor em cada consulta.
- Visão global das quatro IAs, últimos 30 dias, atualização diária.
- Excluir mensagens de contas cujo nível atual seja `admin`, tanto da classificação quanto das métricas e dos exemplos. A condição deve valer também para o contexto encaminhado ao modelo.
- Revalidar esse critério durante consultas/processamento. Não existe histórico de nível observado nesta auditoria; nível atual não comprova o papel no momento do envio. Alterações de nível exigem reconciliação dos dados derivados.
- O desenho de permissões de equipe permanece evolução futura, substituído por admin-only no MVP. Isso não muda o acesso dos clientes às quatro IAs.

## Base usada

Snapshot encerrado em 14/10/2026 21:03:50 America/Sao_Paulo: 1.486 mensagens totais menos 30 mensagens de admins = 1.456 elegíveis, de 127 pessoas com nível atual user.

| IA | Mensagens elegíveis |
| --- | ---: |
| Comunicação | 306 |
| Apresentação | 138 |
| Conversas difíceis | 621 |
| Postagem | 391 |
| Total | 1.456 |

Os 484.877 caracteres medidos no diagnóstico incluem admins. Não assumir que esse é o comprimento exato da entrada elegível. Não foi feita nova leitura do banco para esta estimativa. Os totais são dados do snapshot, não uma contagem atualizada em tempo real.

## Recomendação inicial

`gpt-6-luna`, Responses API com saída estruturada e `reasoning.effort = low`, processamento Standard. A documentação o posiciona para tarefas delimitadas de alto volume; a adequação às nossas categorias em português precisa ser demonstrada no piloto. Não há benchmark de qualidade executado.

Cada classificação devolve tipo de mensagem, categorias permitidas, necessidade normalizada e indicadores de incerteza. Contagens serão calculadas pelo banco. Usar contexto relevante e limitado; excluir mensagens de admins e minimizar informações pessoais antes de enviar. Entrada longa precisa estratégia explícita de segmentação/seleção, sem truncamento silencioso que comprometa a interpretação.

Comparação proposta: classificar 200 mensagens distribuídas pelas quatro IAs, incluindo casos longos, curtos e refinamentos. Comparar até 50 desses casos com `gpt-6.1-sol`, reasoning low, além de revisão humana. O segundo modelo não é uma verdade de referência; divergências orientam revisão e ajustes. Não acionar fallback caro automaticamente nesta primeira fase.

Se a amostra atingir os critérios de aceitação definidos com o responsável, processar as demais mensagens. Reutilizar classificações válidas do piloto, evitando pagar novamente por elas.

## Tarifas verificadas

Preços Standard de contexto curto em USD por um milhão de tokens, consultados em 2026-10-14:

| Modelo | Entrada sem cache | Saída |
| --- | ---: | ---: |
| GPT-6 Luna | US$ 0,10 | US$ 0,50 |
| GPT-6.1 Sol | US$ 2,00 | US$ 10,00 |

Fonte: https://developers.openai.com/api/docs/pricing ; https://developers.openai.com/api/docs/models/gpt-6-luna ; https://developers.openai.com/api/docs/models/gpt-6.1-sol .

Sem desconto de cache ou Batch na conta. Sem ferramentas pagas, embeddings, busca web, residência regional premium ou processamento Fast/Ultrafast. Esses recursos não são necessários para esta proposta de classificação.

## Premissas de consumo e fórmula

- Uma chamada Luna por mensagem classificada.
- Entre 800 e 2.000 tokens de entrada por chamada, incluindo instruções, categorias, texto e contexto selecionado.
- Entre 400 e 1.000 tokens de saída faturável por chamada, incluindo reasoning, não apenas JSON visível.
- Margem de 30% para repetição e ajustes, aplicada a todos os custos abaixo.
- Essas quantidades são cenários de planejamento, não tokenização medida nem garantia de que cada entrada caberá na faixa.

Fórmula: `quantidade × (tokens_entrada × tarifa_entrada + tokens_saida × tarifa_saida) / 1.000.000 × 1,30`.

| Escopo | Custo estimado com margem |
| --- | ---: |
| Luna em 200 mensagens | US$ 0,0728 a US$ 0,1820 |
| Sol em 50 mensagens para comparação | US$ 0,3640 a US$ 0,9100 |
| Piloto: Luna 200 + Sol 50 | US$ 0,4368 a US$ 1,0920 |
| Luna em todas as 1.456 elegíveis | US$ 0,529984 a US$ 1,324960 |
| Período completo com Sol 50, reutilizando piloto | US$ 0,893984 a US$ 2,234960 |

Faixas arredondadas para planejamento: piloto US$ 0,50 a US$ 1,50; período completo com comparação US$ 1 a US$ 3. Propor teto de US$ 5 para essa validação inicial, sujeito à aprovação do usuário, sem autorização implícita de gasto. Interromper antes de extrapolar o orçamento e reportar consumo/cobertura.

Atualização diária processará apenas entradas novas ou fontes/versões alteradas; não repetir o histórico de 30 dias diariamente. Se o volume do mês continuar em aproximadamente 1.456 mensagens, classificação Luna incremental teria ordem de US$ 0,53 a US$ 1,33 por mês nessas premissas, sem novas rodadas de comparação/reprocessamento integral.

Custos excluídos: desenvolvimento, hospedagem/executor, banco e armazenamento adicionais, câmbio, impostos e possíveis valores mínimos de compra de créditos. Esta estimativa cobre consumo de modelo e não define a fatura mínima do provedor.

Antes de processamento real, confirmar credencial API segura e acesso ao modelo na organização, responsável pela cobrança, orçamento e autorização para enviar amostra minimizada. Medir `usage` das primeiras chamadas e recalibrar a projeção antes de completar o lote.
