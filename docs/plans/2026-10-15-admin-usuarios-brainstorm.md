# Planejamento — Administração de usuários e acessos

Estado: brainstorming em 15/10/2026; desenho parcial, não é autorização para implementar ou alterar produção.

ClickUp: Geral → Bússola IA → [Planejamento — Administração de usuários e acessos](https://app.clickup.com/30916694/v/l/li/1400710000001966). Pasta 1400710000001427; lista 1400710000001966. Independente de Insights/OpenAI/MCP e da chave OpenAI.

## Escopo solicitado

Busca por nome/e-mail/telefone; consulta dos usuários e IAs efetivamente liberadas; criação de usuários para venda manual/bônus; edição cadastral e de acesso pelo front, com administração validada no servidor. Nenhum usuário foi alterado nesta etapa. Dois payloads de liberações pendentes ainda não recebidos.

## Achados no código

src/lib/agent-access.ts centraliza disponibilidade do agente, admin vitalício, expiração global, plano global Todas/Ambas e permissões individuais. Desabilitar linha individual não revoga plano global. Painel deve refletir efeito real. Perfil atual é autoatendimento, não API de administração de terceiros. CPF/endereço e fluxo Hotmart precisam verificação de schema/integração; usuário informa automação pronta, CLAUDE antigo diz futura. Nenhuma consulta nova ao banco nesta análise.

## Decisão aprovada

Hotmart pode enriquecer cadastro automaticamente com dados adicionais como CPF/endereço. Preservar liberação manual por bônus/venda direta. Troca de acesso proposta pela Hotmart deve aparecer para administrador aceitar ou manter manual. Identificação, idempotência e decisões concorrentes precisam desenho.

## Propostas a validar

Recomendado painel no app atual com API admin e regras centralizadas. Alternativas: ferramenta separada (mais manutenção) ou painel só leitura (não atende alterações). MVP proposto inclui busca/detalhe/criação/edição/liberação/renovação/revogação. Exclusão definitiva, promoção admin, edição de senha e operações em massa fora do MVP proposto, ainda não aprovado.

Regra aprovada em 15/10/2026, substituindo a pendência anterior: preencher automaticamente somente campos cadastrais vazios com dados válidos da Hotmart. Manter dados existentes e sinalizar divergências para revisão administrativa; eventos incompletos não apagam valores. Definir campos permitidos, retenção, validade padrão, onboarding/convite e eventos de cancelamento/reembolso. Não armazenar payload completo por padrão. Desenho ainda em planejamento.

## Integração direta Hotmart — escopo incluído

Usuário confirmou Hotmart → n8n → base e solicitou substituir por Hotmart → backend Bússola. Planejar mapeamento do fluxo atual, contrato oficial vigente, webhook autenticado, recebimento durável, idempotência, retries, eventos fora de ordem e correlação segura de identidade. Serviço de acesso compartilhado com painel, respeitando enriquecimento e revisão manual aprovados.

Validar equivalência, origem única de escrita e recuperação antes da transição para evitar concessões/convites/revogações duplicados. Troca de destino e desativação somente após testes, aceite e autorização de produção. Remover apenas fluxo comercial Hotmart do n8n; preservar demais fluxos, inclusive chats. Nenhuma configuração alterada. Lista passa a 15 tarefas, com quatro dependências na etapa Hotmart.

- [12 · Mapear fluxo Hotmart no n8n e contrato de eventos](https://app.clickup.com/t/17ty0uzrxqa)
- [13 · Projetar e implementar integração direta Hotmart no backend](https://app.clickup.com/t/17ty0uzrxqc)
- [14 · Validar equivalência e planejar migração do n8n](https://app.clickup.com/t/17ty0uzrxqd)
- [15 · Ativar Hotmart direta e encerrar fluxo comercial no n8n](https://app.clickup.com/t/17ty0uzrxqf)

## Tarefas

- [01 · Definir escopo e regras do painel administrativo](https://app.clickup.com/t/17ty0uzrxnn) — 17ty0uzrxnn
- [02 · Mapear schema e acesso efetivo das quatro IAs](https://app.clickup.com/t/17ty0uzrxnp) — 17ty0uzrxnp
- [03 · Conferir automação Hotmart e definir precedência do manual](https://app.clickup.com/t/17ty0uzrxnq) — 17ty0uzrxnq
- [04 · Desenhar busca e ficha administrativa do usuário](https://app.clickup.com/t/17ty0uzrxnr) — 17ty0uzrxnr
- [05 · Planejar criação de usuário e edição cadastral](https://app.clickup.com/t/17ty0uzrxnt) — 17ty0uzrxnt
- [06 · Projetar operações admin e trilha de auditoria](https://app.clickup.com/t/17ty0uzrxnu) — 17ty0uzrxnu
- [07 · Definir concessão, renovação e revogação por IA](https://app.clickup.com/t/17ty0uzrxnv) — 17ty0uzrxnv
- [08 · Analisar os dois payloads de liberação pendentes](https://app.clickup.com/t/17ty0uzrxnw) — 17ty0uzrxnw
- [09 · Definir validação e aceite antes de produção](https://app.clickup.com/t/17ty0uzrxnx) — 17ty0uzrxnx
- [10 · Consolidar decisões e plano de implementação aprovado](https://app.clickup.com/t/17ty0uzrxny) — 17ty0uzrxny
- [11 · Planejar enriquecimento cadastral e revisão de proposta Hotmart](https://app.clickup.com/t/17ty0uzrxp2) — 17ty0uzrxp2

