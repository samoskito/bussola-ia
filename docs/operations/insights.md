# Operação dos Insights

O painel `/dashboard/insights` e o MCP `/api/insights-mcp` consultam os mesmos resultados derivados. Ambos exigem uma conta administradora atual. Mensagens e contexto de administradores são excluídos. O MCP oferece somente leitura de indicadores; exemplos textuais permanecem desativados por configuração independente.

Consultar o painel ou o MCP não inicia classificação. O guia de instalação para o cliente está em [guia-cliente-insights-mcp.md](../guia-cliente-insights-mcp.md).

## Processamento e orçamento

A classificação é executada no servidor com GPT-5.4 nano, reasoning low. A chave OpenAI e o acesso de serviço ao Supabase permanecem no servidor. Os executores externos recebem somente a credencial restrita do worker.

`INSIGHTS_MAX_SPEND_USD` e a reserva atômica no banco limitam o gasto acumulado do mesmo `INSIGHTS_BUDGET_SCOPE`. O limite não se renova diariamente. Preservar o scope e todas as reservas anteriores em retomadas. Reservas de chamadas com custo desconhecido permanecem retidas conservadoramente; não zerar, devolver por estimativa ou trocar o scope para contornar o teto.

Os resultados são versionados e revalidados por hash de fonte/contexto, vínculos, papel atual e versão de classificação. A retomada pula resultados válidos. Rejeições de tamanho são explícitas; nenhuma entrada é truncada silenciosamente. Falhas transitórias usam tentativas limitadas e atraso; falhas permanentes exigem revisão operacional.

## Histórico completo

O filtro **Todo o histórico** está disponível no painel, nas APIs administrativas e no MCP (`days=all`). Os relatórios mostram cobertura e pendências; consultar o histórico não significa que todas as fontes já foram classificadas. Comparação com um período anterior não se aplica ao período integral.

`INSIGHTS_BACKFILL_START` e `INSIGHTS_BACKFILL_END` definem exclusivamente no servidor a janela histórica autorizada. Não aceitar datas, modelo, orçamento ou IDs arbitrários de requisições. O endpoint original `/api/insights/process` conserva essa janela quando configurada.

O worker histórico também dispõe de oito subconjuntos fixos em `/api/insights/process/backfill/0` até `/7`. Todos exigem a mesma autenticação e gates do worker, janela histórica válida e orçamento compartilhado. Cada subconjunto seleciona `sourceId % 8`; o contexto completo da conversa continua disponível para preservar hashes e classificação. O processamento diário permanece independente dessa distribuição.

Antes de reiniciar um executor interrompido:

1. Confirmar que não há executor local antigo ativo; conferir jobs e leases no banco.
2. Conferir configuração, reservas e teto existente somente em leitura.
3. Preservar o checkpoint anterior. Um arquivo `running` antigo não comprova um processo ativo; remover lock somente após verificar que seu processo terminou.
4. Retomar com o mesmo modelo, versões, janela e scope. Drenar chamadas em curso antes de mudar executor ou concorrência.
5. Conferir resultados válidos das fontes dentro da janela. Contagem global de resultados pode incluir o diário e não comprova conclusão do histórico.

Os auxiliares privados e checkpoints locais ficam fora do Git. Não incluir credenciais, IDs de usuários, hashes de autorização ou textos de conversas em logs públicos ou no ClickUp. Uma cópia criptografada por DPAPI depende do perfil Windows que a criou; após perda desse perfil, uma credencial restrita pode precisar de rotação nos destinos autorizados.

### Coordenador histórico na nuvem

O workflow manual `.github/workflows/insights-history.yml` permite coordenar a carga inicial sem manter o computador local ligado. Executar somente na `main` revisada, depois de encerrar e drenar qualquer executor histórico local. Ele usa o segredo do worker já existente e compartilha o grupo de concorrência com o diário, evitando sobreposição dos dois workflows.

O coordenador chama as oito rotas fixas, com até dez novas conclusões por rota e até 200 rodadas. Modelo, janela, exclusão administrativa e teto acumulado continuam sendo definidos pelo servidor. Não recebe chave OpenAI/Supabase nem permite parâmetros arbitrários. Falhas de rede/HTTP ambíguas encerram a rodada após drenar requisições, sem repetir automaticamente a chamada; reservas desconhecidas permanecem retidas. Tentativas já registradas pelo servidor seguem sua política limitada de retry.

`source_scan_finished_requires_audit` significa que as oito partições terminaram a varredura; não comprova, sozinho, que todas as fontes foram classificadas. Conferir no banco os resultados válidos, as rejeições explícitas, as falhas permanentes e o orçamento antes do aceite final. Limites de tempo/rodadas, orçamento e falta de progresso são estados operacionais distintos de conclusão.

## Atualização diária

O workflow `.github/workflows/insights-daily.yml` usa GitHub Actions e o endpoint fixo `/api/insights/process/daily`. A janela é sempre os últimos 30 dias, com contexto adicional, mesmo durante uma carga histórica. Ele não depende do computador local permanecer ligado.

O cron está configurado para 06:17 UTC, equivalente a 03:17 de Brasília. O horário é uma configuração, não garantia de execução naquele minuto; conferir o início real no GitHub. `INSIGHTS_DAILY_ENABLED=true` habilita o job. O único segredo necessário no GitHub é `INSIGHTS_WORKER_TOKEN`, correspondente ao segredo do worker no servidor; não enviar chaves OpenAI/Supabase.

Cada execução normal tem limite de rodadas e até 400 novas conclusões. `round_limit_backlog_remaining` sinaliza que esse limite foi atingido com trabalho pendente e produz saída operacional de erro; não é, isoladamente, falha da OpenAI. Verificar os resultados e o backlog antes de diagnosticar. `mode=validate` limita o teste manual a duas chamadas e não comprova conclusão do backlog.

O painel informa que o agendamento foi configurado quando `INSIGHTS_DAILY_SCHEDULE_ENABLED=true`. Esse rótulo não comprova sucesso da última execução: conferir workflow, último processamento, cobertura e falhas.

## Pausa e recuperação

`INSIGHTS_DAILY_ENABLED=false` impede novos jobs diários. Uma execução já ativa precisa ser encerrada separadamente, drenando requisições quando possível. Os gates `INSIGHTS_OPENAI_ENABLED` e `INSIGHTS_PROCESSING_ENABLED` no servidor também controlam novas chamadas; mudanças de ambiente exigem publicação para valer.

Preservar tabelas, resultados, reservas e o fluxo de senha administrativa durante rollback. Não executar `supabase db push` genérico: o histórico de migrations da CLI precisa ser reconciliado antes de operações abrangentes. Nenhuma migration é necessária para distribuir os lotes históricos.

A integração comercial da Hotmart continua no n8n e não faz parte dessas operações.

## Instalação autônoma do MCP

O servidor anuncia registro dinâmico OAuth em `/api/insights-mcp/oauth/register`. Claude e ChatGPT cadastram automaticamente a identificação técnica de cada instalação; o administrador informa a URL, entra na Bússola e autoriza a consulta. Não distribuir Client ID ou segredo manual para novas instalações. O guia está em `docs/guia-cliente-insights-mcp.md`.

O registro aceita somente callbacks HTTPS exatos das plataformas suportadas, não busca metadados externos nem grava cadastros no banco. Os identificadores compactos são assinados e vinculados ao emissor. A troca exige PKCE S256; consentimento, escopo somente leitura, audiência, renovação/revogação e perfil administrador atual continuam obrigatórios. Clientes estáticos anteriores são preservados.

`INSIGHTS_MCP_CONSENT_SECRET` também assina os identificadores dos clientes dinâmicos. Sua rotação invalida essas instalações e exige nova conexão nas plataformas. Preservar o segredo durante publicações comuns. Não anunciar CIMD enquanto não houver implementação e validação específicas; no Claude, escolher **Registrar automaticamente**.
