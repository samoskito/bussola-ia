# Ajustes administrativos autorizados — desenho de 15/10/2026

Usuário autorizou corrigir os dois achados e repetir testes, sem migrations remotas/publicação. Destinatário futuro autorizado informado, suporte@palmup.com.br: registrar sua escolha não autoriza criar conta/enviar e-mail nesta rodada de correção local. Chave OpenAI presente em .env.local, conferida apenas como booleano; processamento/despesa continuam desativados. Sem API calls.

## Acesso com validade por IA

Substituir somente o contrato de edição de acesso por `{revision, access:[{agentType, enabled, expiresAt}], reason}`, com quatro entradas explícitas, únicas e válidas. Cadastro pode manter seleção/data comum. Backend rejeita payload antigo de edição para evitar uniformização acidental.

Cada IA terá checkbox e data próprios. Inicialização parte do acesso atual por IA; editar uma preserva as demais. Revisão mostra antes/depois por IA. Datas existentes vencidas podem ser preservadas; revogação não altera vigência de outra IA. SQL/demo mantêm auditoria, locks/revisão e autorização; não reescrevem grants/timestamps inalterados sem necessidade.

Planos globais Todas/Ambas são materializados em grants individuais, preservando o acesso global efetivo e a validade das IAs não editadas. Para grants individuais sujeitos a limite global residual, materializar o menor vencimento global/individual ao remover esse limite evita reativação involuntária. Datas da interface devem representar esse limite efetivo.

Alternativas consideradas: bloquear escrita de contas mistas resolve só a contenção; manter confirmação de uniformização não resolve a gestão pedida. Escolhida edição por IA, já autorizada pelo usuário.

## Recuperação atômica independente do painel

Tentar sempre a RPC de consumo transacional, sem depender do modo/escrita do painel. Erros de rede, permissão ou execução não podem acionar atualização legada. Compatibilidade anterior à migration permite fallback somente em erro explícito e preciso de ausência da RPC.

Flag dedicada `PASSWORD_RESET_ATOMIC_REQUIRED=true`, fixada no rollout antes de ativar convites e preservada em qualquer desligamento do painel, faz ausência/cache da RPC falhar fechado. Ela não deve seguir as flags do painel; instalação remota e configuração ainda não são executadas nesta etapa. Com painel live/escrita ativos também não permitir ausência silenciosa mesmo se a flag tiver sido omitida.

Alternativas consideradas: detecção isolada de RPC não distingue schema cache desatualizado de instalação ausente; substituir o legado incondicionalmente quebraria produção sem migration. Escolhida tentativa RPC sempre + compatibilidade estrita antes da migration + exigência explícita após instalação.

## Validação

Regressões de contrato inválido, grants mistos, renovar/revogar uma IA, conversão global/limite residual, SQL transacional, reset com painel desativado/leitura/escrita, ausência RPC e falhas sem fallback. Suítes admin/Insights/MCP, typecheck escopado, PostgreSQL temporário sem rede, navegador somente com APIs interceptadas e build em cópia sem envs reais. Teste de senha real ficará com o destinatário após rollout autorizado.
