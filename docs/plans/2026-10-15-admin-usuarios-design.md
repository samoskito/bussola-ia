# Administração de usuários — demonstração local

Autorização em 15/10/2026: começar o painel com dados simulados e delegar implementação; integração Hotmart direta continua planejada, aguardando payloads/fluxo n8n. Não aplicar migrations, alterar usuários reais, enviar e-mails ou publicar.

## Decisões e escopo

Painel no aplicativo atual, independente de Insights/OpenAI/MCP. Somente admins: busca paginada por nome/e-mail/telefone, filtros por IA/acesso, ficha, criar usuário comum, editar cadastro, selecionar acesso das quatro IAs e validade, motivo e histórico. Não promover admins, excluir contas nem editar senhas de usuários neste painel.

Primeiro acesso aprovado pelo usuário: link temporário para o próprio usuário definir senha, enviado por e-mail e também disponível para o admin copiar. Na demonstração, geração e envio serão simulados com rota separada; nenhuma senha será persistida. Link de uma hora, uso único, reemissão invalida anterior; token só exposto no resultado da emissão, nunca no histórico/listagem.

Código existente tem recuperação por SMTP/fallback Brevo, hash SHA-256 de token e página de definição de senha. Isso comprova suporte no código, não entrega de e-mail ou configuração funcional atual. Não reutilizar endpoints reais na demonstração. Integração real exigirá revisão transacional do consumo e limitação de tentativas/envios.

## Arquitetura e segurança

`ADMIN_USERS_MODE=disabled` por padrão; modo `demo` rejeita ambiente production; não há modo live nesta entrega. Domínio puro em memória de processo, com fixtures fictícias e sem importar Supabase/mailer. Dados podem ser reiniciados ao reiniciar servidor; não é armazenamento persistente nem compartilhado entre instâncias.

APIs admin verificam sessão e nível atual no banco, somente leitura para autorização; checam origem de mutations e validam campos/revisão. Sem acesso direto do navegador à service role. Mudanças demo afetam exclusivamente memória local. Convite usa endpoint de demonstração, nunca reset real.

Acesso efetivo segue prioridade existente: disponibilidade do agente, admin vitalício, expiração global, plano Todas/Ambas e grants individuais. Ao retirar IA de plano global, converter para Personalizado preservando demais acessos; nenhuma promessa de revogação apenas pela linha individual. Atualizações atômicas em memória com revisão e auditoria mínima.

## Verificação e limites

Testar gates, autorização, busca, e-mail duplicado, permissões efetivas, expiração, revogação parcial de plano global, concorrência/revisão, histórico sem tokens e convites (expiração/reemissão/uso único). Verificar UI desktop/mobile e caminhos sem sessão. Testes de interface podem interceptar autorização em sessão sintética, sem provar login real. Não declarar produção/SMTP/Hotmart concluídos pela validação demo.

## Equipe

- GPT-6.1 Sol high: domínio/API demo.
- GPT-6.1 Sol medium: interface/navegação.
- GPT-6 Sol high: testes/revisão de regras.
- Agente principal: integração, revisão, validação e documentação/ClickUp.
