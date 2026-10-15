# Handoff — painel de usuários local

## Atualização posterior: preparação da persistência real

Usuário testou demo e aprovou inicialmente; prioridade confirmada: terminar painel antes de focar Hotmart direta. A seção original abaixo descreve a entrega demo, agora complementada por um caminho real PREPARADO E DESATIVADO.

- Adaptador RPC para users/acessos/auditoria e duas migrations `20261015000001_admin_users.sql` e `20261015000002_admin_invitations.sql`. Migrações não reescrevem cadastros, mas criam índice único de e-mail trim/lower; duplicidades abortam antes da criação. Em operação, as RPCs alteram fontes e auditoria na mesma transação, verificam admin atual e revisão por snapshot completo, incluindo mudanças externas/n8n.
- Flags `ADMIN_USERS_LIVE_ENABLED`, `ADMIN_USERS_WRITES_ENABLED`, `ADMIN_USERS_EMAIL_ENABLED` todas false no exemplo. Modo live só com opt-in; sem alteração nos envs existentes. Demo continua ativo localmente.
- Convites reais preparados por SMTP/Brevo: origem fixa `ADMIN_USERS_APP_URL`, token em fragmento (`/auth/first-access#token=...`), hash, 1h, reemissão/consumo único e cooldown. E-mail falho não é tratado como enviado; aceitação pelo provedor não prova entrega. Senha nova substitui anterior se houver, sem mudar acesso às IAs; UI exige motivo/revisão.
- Verificação barata do convite antes do bcrypt; fingerprint invalida convite após mudança independente de senha. Edição/reuso de e-mail invalida tokens legados. Recuperação existente passa a usar consumo atômico compartilhado somente quando live+writes ativos; resolve disputa entre convite e reset antigo. Fluxo legado original permanece quando não ativado.
- Datas inclusivas de acesso em America/Sao_Paulo alinhadas entre painel/SQL e helper dos chats. Sem mudança no contrato n8n.
- Testes SQL reais em Docker já instalado, postgres17-alpine: container temporário, sem rede, portas ou volumes; removido ao final. Duas migrations aplicadas somente ao schema sintético. Verificados permissões, duplicidades, rollback inicial, revogação global/parcial, snapshots externos, concorrência de revisão e de definição/reset de senha, uso único e auditoria sem tokens.
- Suíte administrativa expandida; typecheck de todos os caminhos tocados sem diagnósticos (14 legados globais). Regressão Insights e navegador demo desktop/mobile passaram. PostgreSQL isolado não equivale à validação do Supabase real/SMTP/produção; não declarar painel real concluído/publicado.

### Bloqueio concreto de ativação

Auditoria GET-only de 15/10/2026 (`scripts/audit-admin-users-readonly.cjs`, relatório `docs/audits/2026-10-15-admin-users-readonly.json`): schema UUID/date necessário existe; 1699 usuários, 5 grupos de e-mails duplicados por trim/lower e 1 e-mail vazio. Nenhuma conta alterada e nenhum e-mail/hash pessoal salvo no relatório. Políticas, triggers, constraints e privilégios não auditados via Data API. Presença de configurações SMTP/Brevo confirmada sem expor valores; entrega não testada.

Usuário não tem Supabase separado de teste. Ambiente PostgreSQL temporário resolveu validação da lógica SQL local; ainda falta revisar identidades antes de aplicar índice/migrations, verificar schema completo/backup e definir destinatário de teste autorizado, origem HTTPS e publicação. Não unir/apagar/renomear contas automaticamente. Migração atual abortará com duplicidades. Não pedir autorização de aplicação antes de resolver esse pré-requisito e revisar plano concreto.

ClickUp: [preparação local concluída](https://app.clickup.com/t/17ty0uzry31), [revisão de identidades impedindo ativação](https://app.clickup.com/t/17ty0uzry32), [validação/ativação futura](https://app.clickup.com/t/17ty0uzry33). Implementação Hotmart direta espera conclusão/aceite do painel; nenhum webhook n8n/Hotmart alterado.

Comandos: `npm run test:admin-users`, `npm run test:admin-users:postgres` (requer Docker; usa somente fixture isolada), `node tests/admin-users/typecheck.cjs`. Nenhum pacote instalado nesta etapa.

Entrega em 15/10/2026: demonstração local implementada. Não há persistência/alterações reais, migrations, envio de e-mail, Hotmart direta ou publicação. Plano independente de Insights/OpenAI/MCP.

Branch local: `codex/admin-users-demo`, criada a partir da base que contém a demonstração Insights/MCP. Sem push. O plano comercial/admin e o plano OpenAI/MCP continuam em listas ClickUp separadas.

## Abrir

```powershell
$env:ADMIN_USERS_MODE = 'demo'
node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3100
```

Abrir `http://localhost:3100/dashboard/users` com sessão administrativa existente. Menu admin: Usuários e acessos. Se usar 127.0.0.1 em vez de localhost, o cookie de sessão não é compartilhado entre hosts. O servidor desta entrega foi iniciado somente em loopback. Pode precisar reiniciar em outra sessão.

O módulo usa a autenticação existente: somente a verificação de sessão/papel atual pode ler o Supabase. Usuários, acessos e auditoria deste painel são todos fictícios, em memória do processo. Nenhum usuário/senha de teste criado no banco. Reiniciar/reciclar processo perde alterações demo; não suporta persistência entre instâncias. `ADMIN_USERS_MODE` padrão disabled; demo bloqueada em NODE_ENV production; live não implementado.

## Implementado

- 12 fixtures com e-mails .example, incluindo global Todas/Ambas, individual, expirado, sem acesso e admin vitalício.
- Busca nome/e-mail/telefone, filtros IA/situação, paginação, ficha com acesso efetivo e origem/validade.
- Cadastro de usuário comum e edição nome/e-mail/telefone; revisão antes/depois, motivo e histórico, validação de duplicidade.
- Seleção das quatro IAs e validade comum. Plano global vira Personalizado ao salvar; seleção inicial preserva permissões expiradas para renovação. Datas iguais preservadas; diferenças exigem confirmação. Admin vitalício não editável pela UI/acesso.
- APIs com autorização corrente no servidor, checagem de origem, campos permitidos e revisão otimista.
- Convite: gerar/copiar link, simular e-mail e abrir `/auth/update-password/demo`. Token hash, 1h exata, reemissão invalida anterior, edição de e-mail invalida token e consumo único. Nunca chamar forgot/reset-password reais pela demo. Senhas digitadas na tela fictícia não são transmitidas/persistidas; nenhuma credencial real é criada.
- Layout de autenticação permite abrir somente a tela demo específica mesmo logado, para prévia do admin. Restante do fluxo mantém redirecionamento existente.

## Validação

- `npm run test:admin-users`: 16 testes offline passaram, incluindo rotas/papel atual/origem, gates, expiração São Paulo, revisões, acesso e convites.
- `node tests/admin-users/typecheck.cjs`: zero diagnósticos no módulo/navegação/layout tocado; 14 erros globais legados permanecem.
- 18 testes Insights passaram como regressão.
- `tests/admin-users/browser.cjs`: Chrome desktop/mobile passou, criação/edição/revisão de acesso, seleção de expirados, filtros, convite/envio simulado, página pública demo/consumo único, bloqueio user e API503. Todas APIs interceptadas com sessão sintética e domínio offline; não prova login admin real.
- HTTP real local sem sessão: GET users/audit retornaram401 com no-store, sem lookup do banco após falta de cookie.
- Capturas `docs/audits/admin-users-demo-desktop.png` e `admin-users-demo-mobile.png` revisadas. Nenhum build de produção desta nova funcionalidade realizado; renderização dev/compilação de rotas e typecheck escopado verificados.

Para repetir navegador: definir `ADMIN_BROWSER_MODULES` como diretório de pacotes do runtime e `ADMIN_BROWSER_EXECUTABLE` como Chrome instalado; iniciar servidor demo e rodar `node tests/admin-users/browser.cjs`. A sessão falsa fica só no contexto do teste. Não existe bypass de autenticação na aplicação.

## Próximos passos

Integrar banco real somente após validar schema, necessidade de migration, atomicidade/auditoria e autorizar ativação. Fluxo real de primeiro acesso deve reaproveitar suporte SMTP/Brevo existente após revisar consumo transacional único, limites de emissão/envio e origem confiável dos links. Não basta trocar a flag: nenhum modo live existe neste módulo.

Aguardar payloads e export sanitizado do n8n para planejar Hotmart direta. Regras aprovadas: preencher somente campos vazios, preservar divergentes com revisão, preservar acesso manual até decisão admin. Não desativar n8n de chats; transição comercial deve evitar escrita/convites duplicados.

ClickUp: lista `1400710000001966`; [entrega demo concluída](https://app.clickup.com/t/17ty0uzrxy1). Demais tarefas reais permanecem abertas; documentação de planejamento em `2026-10-15-admin-usuarios-brainstorm.md` e design em `2026-10-15-admin-usuarios-design.md`.
