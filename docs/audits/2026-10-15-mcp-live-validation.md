# MCP real autenticado — validação local

Em 15/10/2026, implementação preparada com delegação: GPT-6.1 Sol em OAuth e protocolo; GPT-6 Astra na revisão independente; integração/login/consentimento e revisão final pelo orquestrador. Claude na conta do Samuel primeiro, ChatGPT depois. Preparação não publicada e migration OAuth não aplicada ao banco real.

## Evidência

- `npm run test:mcp`: **22/22 passaram**, incluindo seis testes demo, seis do protocolo real com SDK oficial, oito OAuth e dois de continuação segura do login. O teste HTTP demo exige loopback; a primeira execução no sandbox teve EACCES e a repetição autorizada fora dessa restrição passou. Nenhum dado real ou modelo pago usado nesses testes.
- `node --test tests/insights/*.test.cjs`: **26/26 passaram**.
- `node --test tests/admin-users/*.test.cjs`: **42/42 passaram**.
- `node tests/mcp/oauth-postgres.cjs`: migration em PostgreSQL 15.8 isolado, sem rede/portas/mounts, com dados sintéticos. Passaram schema/RLS/permissões, nonce e code únicos, vínculos client/resource/redirect/PKCE, expirações, papel admin, revogação e concorrência de exchange/refresh. Container removido ao terminar.
- Typecheck: nenhum diagnóstico nos módulos/rotas MCP, login, contexto, helper, layout ou middleware alterados. Persistem os **14 erros legados** conhecidos fora deste escopo; build não substitui essa checagem porque o projeto ignora erros de tipos no build.
- Dois builds de produção isolados passaram, sem copiar `.env` ou backups e com Supabase/JWT sintéticos e integrações desligadas. O segundo inclui as correções de contexto/layout/continuação de login. Após essa fotografia, houve apenas a remoção da constante CSP `form-action 'self'`, registrada abaixo; nenhum comportamento de dados/OAuth foi alterado. O build apresenta aviso conhecido do Supabase realtime e Browserslist antigo.

## Revisão e correções

Discovery e consentimento precisaram exceções exatas no middleware. A página revalida sessão/role atual, bloqueia framing e não permite cache/referrer. O layout cliente não deve desviar consentimento/login para dashboard. O login retoma a rota OAuth por navegação de documento, com um único responsável mesmo com formulários responsivos duplicados. O destino local é validado novamente após normalização para rejeitar `/x/..//host` e variantes.

`form-action 'self'` foi removido da CSP do consentimento porque pode bloquear o 303 legítimo para Claude. `frame-ancestors 'none'` e `X-Frame-Options: DENY` permanecem; o POST continua com destino fixo, Origin exato e nonce/CSRF. O callback externo no navegador real continua parte da homologação no Claude, não comprovado por testar somente o header Location.

OAuth usa segredos separados, códigos/tokens aleatórios opacos com hashes persistidos, consentimento durável único, access de 10 minutos, code de 2 minutos e refresh de até 30 dias absolutos. Replays revogam a família. Metadados não anunciam DCR/CIMD ausentes; cliente privado é pré-cadastrado. Falhas de configuração/banco fecham acesso. Não existe ferramenta que escreva usuários, acessos ou mensagens.

## Limites atuais

Leitor real integrado em código; conexões reais Claude/ChatGPT ainda não realizadas. MCP desabilitado por padrão. Exemplos textuais também desabilitados por padrão, aguardando revisão específica. Não presumir que um resumo sem `needsReview` tenha aprovação humana ou anonimato. Todas as ferramentas informam cobertura da amostra e limitações de contagem. Não houve chamada OpenAI, ampliação do piloto de 200 mensagens ou cron; Hotmart não foi alterada.

As tabelas novas têm escrita operacional de autenticação (consentimento/tokens), necessária para login, replay e revogação. “Somente leitura” descreve o acesso do conector aos dados de negócio, não ausência dessas gravações OAuth. Não há tela de administração de grants nem limpeza automática; o roteiro registra revogação e retenção operacional. Ainda é necessário aplicar a migration específica, configurar segredos/clientes e publicar, depois homologar HTTPS/login/consentimento/refresh/revogação no Claude.

Referências de implementação: [revisão independente](2026-10-15-mcp-security-review.md), [design](../plans/2026-10-15-insights-mcp-live-design.md), [ativação](../plans/2026-10-15-insights-mcp-release.md).
