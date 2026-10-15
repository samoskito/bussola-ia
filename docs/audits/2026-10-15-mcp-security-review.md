# Revisão independente — Insights MCP remoto

Data: 15/10/2026. Escopo: leitura de código e documentação oficial; testes locais sintéticos. Nenhuma consulta de segredo, alteração de produção, migration remota, publicação ou chamada de modelo nesta revisão.

## Resultado

Não foi encontrado desvio de autorização explorável nos módulos OAuth/protocolo revisados. A conclusão cobre a implementação local; não comprova instalação no Claude, comportamento da Vercel ou configuração de produção. Os testes PostgreSQL e a validação integrada são registrados pelos responsáveis em seus respectivos artefatos.

Foram identificados e corrigidos durante a revisão:

- O middleware redirecionava a tela `/auth/insights-mcp` para o dashboard mesmo com sessão válida. Agora há exceção exata, com validação de sessão e papel atual dentro da página.
- Discovery precisava passar sem cookie pelo middleware. Os caminhos exatos foram liberados; continuam sujeitos à configuração do MCP nos handlers.
- Consentimento agora mostra o host de redirecionamento e envia proteção contra framing, cache e referer.
- Exemplos ficam desativados por padrão, separados dos agregados. `needsReview=false` não representa revisão humana nem anonimização; o modo opcional explicita isso e filtra itens em revisão.
- Todas as ferramentas passam a incluir cobertura numérica, evitando que os temas do piloto parcial pareçam representar toda a base.

## Controles examinados

- OAuth confidencial pré-cadastrado, segredo armazenado na configuração apenas como SHA-256, PKCE S256 e correspondência exata de client/resource/redirect/scope.
- Consentimento explícito POST, Origin exato, nonce assinado em cookie HttpOnly/Secure/Lax e associado ao usuário e pedido completo; consumo durável único no banco.
- Códigos e tokens opacos aleatórios; persistência apenas de hashes. Access token de 10 minutos e família de refresh com expiração absoluta de 30 dias.
- Locks transacionais serializam consumo/rotação. Reuso de code/refresh revoga a família e retorna NULL sem lançar exceção, preservando a escrita de revogação.
- Papel administrativo consultado no banco na emissão e em cada chamada MCP; resource, scope, cliente configurado, validade e revogação verificados no bearer.
- Tabelas OAuth com RLS, sem permissões anon/authenticated; RPC restrita a service role e com `search_path` explícito.
- Protocolo oficial SDK, transporte stateless, corpo limitado, host/origin verificados, respostas privadas e erros genéricos.
- Ferramentas projetam campos derivados explicitamente, sem SQL livre, URLs arbitrárias, IDs de origem, input/output bruto ou execução de classificação.
- Fonte central revalida papéis e hash/versões das classificações. As consultas não executam worker nem aumentam o lote de 200 mensagens/teto total de US$ 1.

## Evidência local independente

Executadas assertions contra `oauth-config.ts` e `oauth.ts`, usando apenas valores sintéticos e harness com `global.fetch` proibido: resource incorreto, redirect lookalike, PKCE plain/incorreto, scope extra, cliente desconhecido, parâmetro duplicado, consentimento de outro usuário/adulterado/expirado e segredo de cliente incorreto foram rejeitados; caminhos válidos foram aceitos. Resultado: passaram.

Revisados `oauth-server.ts`, `oauth-metadata.ts`, `protocol.ts`, `tools.ts`, rotas, migration OAuth, consentimento, middleware e a camada compartilhada Insights. Corrigido e relido: `invalid_client` agora usa challenge Basic, separado do challenge Bearer do resource server.

## Revisão adicional da navegação

O layout cliente de autenticação também desviava login/consentimento para o dashboard. A exceção exata nas duas páginas, a espera de `redirectReady`, `signIn({redirect:false})` e navegação de documento para o GET OAuth corrigem os desvios identificados. Navegar a rota API OAuth com `router.push` não preservava o contrato de documento/cookies esperado.

Encontrado por reprodução Node: `safeLoginRedirect('/x/..//evil.example')` e `safeLoginRedirect('/.%2e//evil.example')` retornavam `//evil.example` após normalização. O retorno era protocol-relative apesar da validação inicial. Corrigido pelo agente principal: revalidar o destino normalizado e sua origem. As duas instâncias desktop/mobile de LoginForm agora compartilham uma trava de navegação OAuth para evitar dois GETs de autorização sobrescrevendo o consentimento.

Sinalizado e corrigido pelo agente principal: `form-action 'self'` pode bloquear o 303 do POST de consentimento para o callback externo em Chrome. A restrição form-action foi removida, preservando `frame-ancestors 'none'`/DENY. A validação browser ainda precisa seguir até o callback externo durante a homologação. [Referência MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/form-action).

## Compatibilidade e limites para ativação

O Claude aceita cliente OAuth informado manualmente em conector personalizado, com secret para cliente confidencial; DCR não é obrigatório nessa modalidade. O callback hospedado é `https://claude.ai/api/mcp/auth_callback`. Exige discovery/401, resource igual à URL MCP informada, S256 e token endpoint form-urlencoded. Não anunciar DCR ou CIMD ausentes. A conexão real ainda precisa validar consentimento, consulta, refresh e revogação. [Autenticação oficial do Claude](https://claude.com/docs/connectors/building/authentication).

MCP 2025-11-25 admite pré-cadastro; DCR é opcional. Resource deve acompanhar autorização e token; bearer é validado em cada chamada, incluindo audience e escopo. [Especificação de autorização MCP](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization).

O conector remoto é acessado pela infraestrutura da Anthropic, inclusive no Desktop; requer HTTPS público alcançável. [Conectores personalizados](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).

Antes de ativar: confirmar testes concorrentes SQL/RLS, suite integrada com SDK, discovery e callback HTTPS no domínio exato, e configuração manual do cliente no Claude. Manter exemplos desativados até revisão/autorização específica. SQL aditivo e configuração preparados não significam aplicados; nenhum escopo Hotmart foi revisado ou alterado.
