# Handoff — painel de usuários local

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
