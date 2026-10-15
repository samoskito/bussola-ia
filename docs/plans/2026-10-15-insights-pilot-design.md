# Piloto real de Insights — escopo aprovado

Usuário autorizou em15/10/2026 migration, configuração e piloto de até200 mensagens, iniciando50, teto agregadoUS$1. GPT-6 Luna low, quatro IAs, últimos30dias, exclusão de admins, contexto limitado e minimização. Sem Hotmart/MCP remoto, cron diário ou ampliação ao histórico completo nesta rodada.

Amostra fixa de até50 IDs por agente, sem texto/identidades no manifesto de configuração; selecionar mensagens elegíveis dentro da janela. Worker recebe INSIGHTS_PILOT_SOURCE_IDS e orçamento imutável compartilhado INSIGHTS_BUDGET_SCOPE; toda retomada usa os mesmos IDs/escopo. Primeiro configurar50IDs e validar resultado/custo; expandir para o manifesto total de200 somente após revisão do primeiro lote, dentro da mesma autorização e orçamento. Contexto permanece disponível fora da amostra, mas só IDs aprovados são classificados. Entrada/contexto seguem limites já implementados; rejeições não são truncadas silenciosamente.

Lotes de até10 tentativas e deadline240s, preservando35s antes de nova chamada (timeout do provedor25s e margem para persistência). Cada execução termina sem iniciar trabalho que exceda essa janela e devolve pendências. Não há execução paga por GET nem por cookie administrativo; apenas credencial própria do worker. Sem agendamento automático enquanto piloto não for aceito.

Antes da aplicação real: PostgreSQL15.8 isolado, schema/ACL reais somente leitura, confirmação de objetos ausentes e snapshot de definições/contagens das fontes. Migration aditiva não muda fontes. Testar roles, orçamento concorrente, leases/CAS, exclusão administrativa e conclusão. Configurar chave/segredo privados apenas em Production; preservar envs admin/reset.

Validar50 classificações e cobertura parcial no painel, revisar minimização/temas e custo por usage; falhas ou baixa qualidade interrompem ampliação. Testar filtros/exportações e acesso negado a usuário comum. Relatórios devem ser apresentados como amostra parcial; não inferir estatística representativa do histórico inteiro.

Atualização15/10: GPT-6 Luna indisponível na conta do cliente (GET404/catalogo200 sem modelo). Usuário aprovou GPT-5.4 nano, que responde200. Rates/versão/metadados/leitura adaptados ao modelo selecionado; nano usa reservaUS$0,01e saída1200. Migration validada em PostgreSQL15.8 e aplicada, fontes preservadas;22 testes/typecheck escopado/build passaram. Rollout e custos reais em docs/audits/2026-10-15-insights-pilot-rollout.md. Mantidos limites aprovados200/primeiras50/US$1 e sem cron/Hotmart/MCP remoto.
